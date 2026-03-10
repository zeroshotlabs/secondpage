import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { SearchOrchestrator } from "./services/searchOrchestrator";
import { getSearchesByUser } from "./db";

const searchOrchestrator = new SearchOrchestrator();

const ENGINE_API_STATUS: Record<string, boolean> = {
  google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
  bing: true,
  duckduckgo: true,
  brave: !!process.env.BRAVE_API_KEY,
};

export const appRouter = router({
  system: systemRouter,

  search: router({
    // Engine availability (which have API keys configured)
    engineStatus: publicProcedure.query(() => ENGINE_API_STATUS),

    // Scrape a single engine (no DB save, for live streaming)
    scrapeEngine: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(500),
          engine: z.enum(['google', 'bing', 'duckduckgo', 'brave']),
          pages: z.array(z.number().int().min(1).max(10)).min(1),
        })
      )
      .mutation(async ({ input }) => {
        return await searchOrchestrator.scrapeEngine(input.query, input.engine, input.pages);
      }),

    // Rank, dedup, and save pre-scraped results (with optional engine timings)
    rankAndSave: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(500),
          engineConfigs: z.array(
            z.object({
              engine: z.enum(['google', 'bing', 'duckduckgo', 'brave']),
              pages: z.array(z.number().int().min(1).max(10)).min(1),
            })
          ).min(1),
          rawResults: z.array(z.object({
            title: z.string(),
            url: z.string(),
            snippet: z.string(),
            page: z.number(),
            position: z.number(),
            engine: z.string(),
          })),
          engineTimings: z.array(z.object({
            engine: z.string(),
            durationMs: z.number(),
            success: z.boolean(),
            resultCount: z.number(),
            errorMessage: z.string().nullable().optional(),
          })).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await searchOrchestrator.rankAndSaveResults({
          query: input.query,
          engineConfigs: input.engineConfigs,
          rawResults: input.rawResults,
          userId: ctx.user?.id,
          engineTimings: input.engineTimings,
        });
      }),

    // Execute a new search (legacy - scrape + rank in one call)
    execute: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(500),
          engineConfigs: z.array(
            z.object({
              engine: z.enum(['google', 'bing', 'duckduckgo', 'brave']),
              pages: z.array(z.number().int().min(1).max(10)).min(1),
            })
          ).min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id;

        const result = await searchOrchestrator.executeSearch({
          query: input.query,
          engineConfigs: input.engineConfigs,
          userId,
        });

        return result;
      }),

    // Get search by ID
    getById: publicProcedure
      .input(z.object({ searchId: z.string() }))
      .query(async ({ input }) => {
        const result = await searchOrchestrator.getSearchById(input.searchId);

        if (!result) {
          throw new Error('Search not found');
        }

        return result;
      }),

    // Get user's search history (works for both authenticated and anonymous users)
    history: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
      .query(async ({ input, ctx }) => {
        const userId = ctx.user?.id;
        if (!userId) return [];

        const searches = await getSearchesByUser(userId, input.limit);

        return searches.map(search => ({
          id: search.id,
          query: search.query,
          pageStart: search.pageStart,
          pageEnd: search.pageEnd,
          engines: JSON.parse(search.engines),
          createdAt: search.createdAt,
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
