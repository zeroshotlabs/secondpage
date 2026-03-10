import type { Express, Request, Response, NextFunction } from "express";
import { ENV } from "./_core/env";
import { SearchOrchestrator } from "./services/searchOrchestrator";
import { getSearchesByUser, getSearchById as dbGetSearchById } from "./db";

const orchestrator = new SearchOrchestrator();

const VALID_ENGINES = ['google', 'bing', 'duckduckgo', 'brave'] as const;

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!ENV.apiKey) {
    res.status(503).json({ error: "API not configured — set API_KEY in environment" });
    return;
  }

  const key = req.headers["x-api-key"];
  if (!key || key !== ENV.apiKey) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }

  next();
}

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SecondPage.ai API",
    description: "Search aggregation API — query multiple search engines, rank and deduplicate results using Borda count scoring.",
    version: "1.0.0",
  },
  servers: [{ url: "/api-v1" }],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    schemas: {
      SearchResult: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", format: "uri" },
          snippet: { type: "string" },
          sourceEngine: { type: "string", enum: ["google", "bing", "duckduckgo", "brave"] },
          originalPosition: { type: "integer", description: "Position within the engine's results page" },
          originalPage: { type: "integer", description: "Which page of engine results this came from" },
          finalScore: { type: "integer", description: "Borda count score (higher = better)" },
          appearances: { type: "integer", description: "Number of engines that returned this result" },
        },
      },
      Duplicate: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", format: "uri" },
          snippet: { type: "string" },
          sourceEngine: { type: "string" },
          finalScore: { type: "integer" },
          duplicateOf: { type: "string", description: "URL of the canonical result" },
        },
      },
      SearchResponse: {
        type: "object",
        properties: {
          searchId: { type: "string", description: "Unique ID — use to fetch this search later" },
          query: { type: "string" },
          engines: { type: "array", items: { type: "string" } },
          pageRange: {
            type: "object",
            properties: { start: { type: "integer" }, end: { type: "integer" } },
          },
          totalResults: { type: "integer" },
          uniqueResults: { type: "integer" },
          cached: { type: "boolean" },
          results: { type: "array", items: { $ref: "#/components/schemas/SearchResult" } },
          duplicates: { type: "array", items: { $ref: "#/components/schemas/Duplicate" } },
        },
      },
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
    },
  },
  paths: {
    "/search": {
      post: {
        operationId: "executeSearch",
        summary: "Execute a search",
        description: "Scrape selected engines, rank and deduplicate results, persist to database, and return ranked results.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string", minLength: 1, maxLength: 500, description: "Search query" },
                  engines: {
                    type: "array",
                    items: { type: "string", enum: ["google", "bing", "duckduckgo", "brave"] },
                    description: "Engines to query (default: bing, duckduckgo, brave)",
                  },
                  pageStart: { type: "integer", minimum: 1, maximum: 10, default: 2, description: "First result page to scrape" },
                  pageEnd: { type: "integer", minimum: 1, maximum: 10, default: 4, description: "Last result page to scrape" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Search results", content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResponse" } } } },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Invalid or missing API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/search/{id}": {
      get: {
        operationId: "getSearch",
        summary: "Get a previous search by ID",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Search ID returned from POST /search" },
        ],
        responses: {
          "200": { description: "Search results", content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResponse" } } } },
          "404": { description: "Search not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/engines": {
      get: {
        operationId: "listEngines",
        summary: "List available search engines",
        description: "Returns which engines are configured and available. Engines requiring API keys show false if the key is not set.",
        responses: {
          "200": {
            description: "Engine availability",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    engines: {
                      type: "object",
                      properties: {
                        google: { type: "boolean" },
                        bing: { type: "boolean" },
                        duckduckgo: { type: "boolean" },
                        brave: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function registerApiRoutes(app: Express) {
  // OpenAPI spec — served without auth so clients can discover the API
  app.get("/api-v1/openapi.json", (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // All other /api-v1 routes require X-API-Key header
  app.use("/api-v1", requireApiKey);

  // POST /api-v1/search — execute a full search (scrape + rank + save)
  app.post("/api-v1/search", async (req: Request, res: Response) => {
    try {
      const { query, engines, pageStart, pageEnd } = req.body;

      if (!query || typeof query !== "string" || query.trim().length === 0) {
        res.status(400).json({ error: "query is required (string, non-empty)" });
        return;
      }

      if (query.length > 500) {
        res.status(400).json({ error: "query must be 500 characters or less" });
        return;
      }

      // Default engines: all available
      const requestedEngines: string[] = engines && Array.isArray(engines)
        ? engines.filter((e: string) => VALID_ENGINES.includes(e as any))
        : ['bing', 'duckduckgo', 'brave'];

      if (requestedEngines.length === 0) {
        res.status(400).json({ error: `engines must include at least one of: ${VALID_ENGINES.join(', ')}` });
        return;
      }

      const start = typeof pageStart === "number" ? Math.max(1, Math.min(pageStart, 10)) : 2;
      const end = typeof pageEnd === "number" ? Math.max(start, Math.min(pageEnd, 10)) : 4;

      const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

      const engineConfigs = requestedEngines.map(engine => ({
        engine,
        pages,
      }));

      const result = await orchestrator.executeSearch({
        query: query.trim(),
        engineConfigs,
      });

      res.json({
        searchId: result.searchId,
        query: result.query,
        engines: result.engines,
        pageRange: result.pageRange,
        totalResults: result.totalResults,
        uniqueResults: result.uniqueResults,
        cached: result.cached,
        results: result.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          sourceEngine: r.sourceEngine,
          originalPosition: r.originalPosition,
          originalPage: r.originalPage,
          finalScore: r.finalScore,
          appearances: r.appearances,
        })),
        duplicates: result.duplicates.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          sourceEngine: r.sourceEngine,
          finalScore: r.finalScore,
          duplicateOf: r.duplicateOf,
        })),
      });
    } catch (err: any) {
      console.error("[API v1] Search error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // GET /api-v1/search/:id — fetch a previous search by ID
  app.get("/api-v1/search/:id", async (req: Request, res: Response) => {
    try {
      const result = await orchestrator.getSearchById(req.params.id);

      if (!result) {
        res.status(404).json({ error: "Search not found" });
        return;
      }

      res.json({
        searchId: result.searchId,
        query: result.query,
        engines: result.engines,
        pageRange: result.pageRange,
        totalResults: result.totalResults,
        uniqueResults: result.uniqueResults,
        results: result.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          sourceEngine: r.sourceEngine,
          originalPosition: r.originalPosition,
          originalPage: r.originalPage,
          finalScore: r.finalScore,
          appearances: r.appearances,
        })),
        duplicates: result.duplicates.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          sourceEngine: r.sourceEngine,
          finalScore: r.finalScore,
          duplicateOf: r.duplicateOf,
        })),
      });
    } catch (err: any) {
      console.error("[API v1] Get search error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // GET /api-v1/engines — list available search engines
  app.get("/api-v1/engines", (_req: Request, res: Response) => {
    res.json({
      engines: {
        google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID),
        bing: true,
        duckduckgo: true,
        brave: !!process.env.BRAVE_API_KEY,
      },
    });
  });
}
