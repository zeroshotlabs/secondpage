import { ISearchProvider } from './ISearchProvider';
import { SearchScraperHTTP } from './searchScraperHTTP';
import { SearchScraperAPI } from './searchScraperAPI';

/**
 * Search provider types:
 * - 'http': Real search via HTTP scraping + APIs (Google, Bing, DuckDuckGo, Brave)
 * - 'llm':  AI-generated results for testing
 */
export type SearchProviderType = 'http' | 'llm';

/**
 * Supported search engines.
 * For Brave API: set BRAVE_API_KEY env var.
 */
export const SUPPORTED_ENGINES = ['google', 'bing', 'duckduckgo', 'brave'] as const;
export type SearchEngine = typeof SUPPORTED_ENGINES[number];

const SEARCH_PROVIDER: SearchProviderType =
  (process.env.SEARCH_PROVIDER as SearchProviderType) || 'http';

let providerInstance: ISearchProvider | null = null;

/**
 * Get the configured search provider instance
 * This allows switching between Puppeteer scraping and LLM generation
 * via environment variable or configuration change
 */
export async function getSearchProvider(): Promise<ISearchProvider> {
  if (!providerInstance) {
    if (SEARCH_PROVIDER === 'http') {
      console.log('[SearchProvider] Using HTTP-based web scraper');
      const scraper = new SearchScraperHTTP();
      await scraper.initialize();
      providerInstance = scraper;
    } else {
      console.log('[SearchProvider] Using LLM-based search generator');
      providerInstance = new SearchScraperAPI();
    }
  }
  return providerInstance;
}

/**
 * Get the current search provider type
 */
export function getSearchProviderType(): SearchProviderType {
  return SEARCH_PROVIDER;
}

/**
 * Reset the provider instance (useful for testing or configuration changes)
 */
export async function resetSearchProvider(): Promise<void> {
  if (providerInstance) {
    await providerInstance.close();
    providerInstance = null;
  }
}

