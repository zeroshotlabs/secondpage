import { nanoid } from 'nanoid';
import { getSearchProvider } from './searchProviderFactory';
import { RawSearchResult } from './ISearchProvider';
import { ResultRanker, RankedResult } from './resultRanker';
import { createSearch, createSearchResults, getSearchById, getSearchResults, createEngineStats } from '../db';
import { InsertSearch, InsertSearchResult, InsertEngineStat } from '../../drizzle/schema';

export interface EngineConfig {
  engine: string;
  pages: number[];
}

export interface EngineTiming {
  engine: string;
  durationMs: number;
  success: boolean;
  resultCount: number;
  errorMessage?: string | null;
}

export interface SearchRequest {
  query: string;
  engineConfigs: EngineConfig[];
  userId?: string;
}

export interface SearchResponse {
  searchId: string;
  query: string;
  results: RankedResult[];
  duplicates: RankedResult[];
  totalResults: number;
  uniqueResults: number;
  engines: string[];
  pageRange: { start: number; end: number };
  cached: boolean;
}

export class SearchOrchestrator {
  private ranker: ResultRanker;
  private cacheExpiryMinutes: number = 60;

  constructor() {
    this.ranker = new ResultRanker();
  }

  private async getCachedSearch(
    query: string,
    pageStart: number,
    pageEnd: number,
    engines: string[]
  ): Promise<string | null> {
    return null;
  }

  async executeSearch(request: SearchRequest): Promise<SearchResponse> {
    const { query, engineConfigs, userId } = request;

    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }
    if (engineConfigs.length === 0) {
      throw new Error('At least one search engine must be configured');
    }

    for (const config of engineConfigs) {
      if (config.pages.length === 0) {
        throw new Error(`Engine ${config.engine} must have at least one page`);
      }
      for (const page of config.pages) {
        if (page < 1 || page > 10) {
          throw new Error(`Page numbers must be between 1-10`);
        }
      }
    }

    const engines = engineConfigs.map(c => c.engine);
    const allPages = engineConfigs.flatMap(c => c.pages);
    const pageStart = Math.min(...allPages);
    const pageEnd = Math.max(...allPages);

    // Generate searchId early so engine stats can reference it
    const searchId = nanoid();

    const cachedSearchId = await this.getCachedSearch(query, pageStart, pageEnd, engines);
    if (cachedSearchId) {
      const cachedResults = await getSearchResults(cachedSearchId);
      const rankedResults = cachedResults.map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet || '',
        sourceEngine: r.sourceEngine,
        originalPosition: r.originalPosition,
        originalPage: r.originalPage,
        finalScore: r.finalScore,
        isDuplicate: r.isDuplicate === 1,
        duplicateOf: r.duplicateOf || undefined,
        appearances: r.appearances,
      }));

      const uniqueResults = rankedResults.filter(r => !r.isDuplicate);
      const duplicateResults = rankedResults.filter(r => r.isDuplicate);

      return {
        searchId: cachedSearchId,
        query,
        results: uniqueResults,
        duplicates: duplicateResults,
        totalResults: rankedResults.length,
        uniqueResults: uniqueResults.length,
        engines,
        pageRange: { start: pageStart, end: pageEnd },
        cached: true,
      };
    }

    // Perform fresh search with timing
    const scraper = await getSearchProvider();
    const allRawResults: RawSearchResult[] = [];
    const perfStats: InsertEngineStat[] = [];

    const scrapePromises = engineConfigs.map(async (config) => {
      const start = Date.now();
      try {
        const results = await scraper.search(query, config.engine, config.pages);
        perfStats.push({
          id: nanoid(),
          searchId,
          engine: config.engine,
          durationMs: Date.now() - start,
          success: 1,
          resultCount: results.length,
          errorMessage: null,
        });
        return results;
      } catch (err: any) {
        perfStats.push({
          id: nanoid(),
          searchId,
          engine: config.engine,
          durationMs: Date.now() - start,
          success: 0,
          resultCount: 0,
          errorMessage: err.message || 'Unknown error',
        });
        return [];
      }
    });

    const scrapeResults = await Promise.all(scrapePromises);
    scrapeResults.forEach(results => allRawResults.push(...results));

    const rankedResults = this.ranker.rankResults(allRawResults);
    const uniqueResults = this.ranker.getUniqueResults(rankedResults);

    const searchRecord: InsertSearch = {
      id: searchId,
      query,
      pageStart,
      pageEnd,
      engines: JSON.stringify(engines),
      userId: userId || null,
    };

    await createSearch(searchRecord);

    const resultRecords: InsertSearchResult[] = rankedResults.map(result => ({
      id: nanoid(),
      searchId,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      sourceEngine: result.sourceEngine,
      originalPosition: result.originalPosition,
      originalPage: result.originalPage,
      finalScore: result.finalScore,
      isDuplicate: result.isDuplicate ? 1 : 0,
      duplicateOf: result.duplicateOf || null,
      appearances: result.appearances,
    }));

    await createSearchResults(resultRecords);

    // Save engine stats (non-blocking)
    createEngineStats(perfStats).catch(err =>
      console.warn('[SearchOrchestrator] Failed to save engine stats:', err)
    );

    const duplicateResults = rankedResults.filter(r => r.isDuplicate);

    return {
      searchId,
      query,
      results: uniqueResults,
      duplicates: duplicateResults,
      totalResults: rankedResults.length,
      uniqueResults: uniqueResults.length,
      engines,
      pageRange: { start: pageStart, end: pageEnd },
      cached: false,
    };
  }

  async scrapeEngine(query: string, engine: string, pages: number[]): Promise<RawSearchResult[]> {
    const scraper = await getSearchProvider();
    return await scraper.search(query, engine, pages);
  }

  async rankAndSaveResults(request: {
    query: string;
    engineConfigs: EngineConfig[];
    rawResults: RawSearchResult[];
    userId?: string;
    engineTimings?: EngineTiming[];
  }): Promise<SearchResponse> {
    const { query, engineConfigs, rawResults, userId, engineTimings } = request;
    const engines = engineConfigs.map(c => c.engine);
    const allPages = engineConfigs.flatMap(c => c.pages);
    const pageStart = Math.min(...allPages);
    const pageEnd = Math.max(...allPages);

    const rankedResults = this.ranker.rankResults(rawResults);
    const uniqueResults = this.ranker.getUniqueResults(rankedResults);
    const duplicateResults = rankedResults.filter(r => r.isDuplicate);

    const searchId = nanoid();
    await createSearch({
      id: searchId,
      query,
      pageStart,
      pageEnd,
      engines: JSON.stringify(engines),
      userId: userId || null,
    });

    const resultRecords: InsertSearchResult[] = rankedResults.map(result => ({
      id: nanoid(),
      searchId,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      sourceEngine: result.sourceEngine,
      originalPosition: result.originalPosition,
      originalPage: result.originalPage,
      finalScore: result.finalScore,
      isDuplicate: result.isDuplicate ? 1 : 0,
      duplicateOf: result.duplicateOf || null,
      appearances: result.appearances,
    }));

    await createSearchResults(resultRecords);

    // Save engine timings if provided (non-blocking)
    if (engineTimings && engineTimings.length > 0) {
      const stats: InsertEngineStat[] = engineTimings.map(t => ({
        id: nanoid(),
        searchId,
        engine: t.engine,
        durationMs: t.durationMs,
        success: t.success ? 1 : 0,
        resultCount: t.resultCount,
        errorMessage: t.errorMessage || null,
      }));
      createEngineStats(stats).catch(err =>
        console.warn('[SearchOrchestrator] Failed to save engine stats:', err)
      );
    }

    return {
      searchId,
      query,
      results: uniqueResults,
      duplicates: duplicateResults,
      totalResults: rankedResults.length,
      uniqueResults: uniqueResults.length,
      engines,
      pageRange: { start: pageStart, end: pageEnd },
      cached: false,
    };
  }

  async getSearchById(searchId: string): Promise<SearchResponse | null> {
    const search = await getSearchById(searchId);
    if (!search) {
      return null;
    }

    const results = await getSearchResults(searchId);
    const rankedResults = results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet || '',
      sourceEngine: r.sourceEngine,
      originalPosition: r.originalPosition,
      originalPage: r.originalPage,
      finalScore: r.finalScore,
      isDuplicate: r.isDuplicate === 1,
      duplicateOf: r.duplicateOf || undefined,
      appearances: r.appearances,
    }));

    const uniqueResults = rankedResults.filter(r => !r.isDuplicate);
    const duplicateResults = rankedResults.filter(r => r.isDuplicate);
    const engines = JSON.parse(search.engines) as string[];

    return {
      searchId: search.id,
      query: search.query,
      results: uniqueResults,
      duplicates: duplicateResults,
      totalResults: rankedResults.length,
      uniqueResults: uniqueResults.length,
      engines,
      pageRange: { start: search.pageStart, end: search.pageEnd },
      cached: true,
    };
  }
}
