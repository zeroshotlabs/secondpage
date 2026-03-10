/**
 * Interface for search providers
 * Allows switching between different search implementations (scraping, API, LLM-generated, etc.)
 */

export interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  page: number;
  engine: string;
}

export interface ISearchProvider {
  /**
   * Initialize the search provider
   */
  initialize?(): Promise<void>;

  /**
   * Search for the given query on specified engine and pages
   */
  search(query: string, engine: string, pages: number[]): Promise<RawSearchResult[]>;

  /**
   * Search Google for the given query across specified pages (legacy method)
   */
  scrapeGoogle?(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]>;

  /**
   * Search Bing for the given query across specified pages (legacy method)
   */
  scrapeBing?(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]>;

  /**
   * Clean up resources
   */
  close(): Promise<void>;
}

