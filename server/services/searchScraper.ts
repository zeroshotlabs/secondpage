import puppeteer, { Browser } from 'puppeteer';
import { ISearchProvider, RawSearchResult } from './ISearchProvider';

/**
 * Puppeteer-based search scraper
 * Scrapes actual search engine result pages using browser automation
 */
export class SearchScraper implements ISearchProvider {
  private browser: Browser | null = null;

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeGoogle(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]> {
    await this.initialize();
    const results: RawSearchResult[] = [];

    for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
      try {
        const pageResults = await this.scrapeGooglePage(query, pageNum);
        results.push(...pageResults);
        
        // Add delay between requests to avoid rate limiting
        await this.delay(2000 + Math.random() * 1000);
      } catch (error) {
        console.error(`Error scraping Google page ${pageNum}:`, error);
      }
    }

    return results;
  }

  private async scrapeGooglePage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    const results: RawSearchResult[] = [];

    try {
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Calculate start parameter (Google shows 10 results per page)
      const start = (pageNum - 1) * 10;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10`;
      
      console.log(`[Google] Scraping page ${pageNum}: ${url}`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // Wait a bit for dynamic content
      await this.delay(2000);
      
      // Wait for search results to load
      await page.waitForSelector('div#search', { timeout: 15000 });

      // Extract search results
      const pageResults = await page.evaluate((pageNum) => {
        const results: Array<{ title: string; url: string; snippet: string; position: number }> = [];
        
        // Select all search result containers
        const searchResults = document.querySelectorAll('div.g, div[data-sokoban-container]');
        
        searchResults.forEach((result, index) => {
          try {
            // Extract title
            const titleElement = result.querySelector('h3');
            const title = titleElement?.textContent?.trim() || '';
            
            // Extract URL
            const linkElement = result.querySelector('a');
            const url = linkElement?.href || '';
            
            // Extract snippet
            const snippetElement = result.querySelector('div[data-sncf], div.VwiC3b, div[style*="-webkit-line-clamp"]');
            const snippet = snippetElement?.textContent?.trim() || '';
            
            if (title && url && url.startsWith('http')) {
              results.push({
                title,
                url,
                snippet,
                position: index + 1,
              });
            }
          } catch (e) {
            // Skip invalid results
          }
        });
        
        return results;
      }, pageNum);

      // Add metadata
      pageResults.forEach((result) => {
        results.push({
          ...result,
          page: pageNum,
          engine: 'google',
        });
      });

    } catch (error) {
      console.error(`Error in scrapeGooglePage: ${error}`);
    } finally {
      await page.close();
    }

    return results;
  }

  async scrapeBing(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]> {
    await this.initialize();
    const results: RawSearchResult[] = [];

    for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
      try {
        const pageResults = await this.scrapeBingPage(query, pageNum);
        results.push(...pageResults);
        
        // Add delay between requests
        await this.delay(2000 + Math.random() * 1000);
      } catch (error) {
        console.error(`Error scraping Bing page ${pageNum}:`, error);
      }
    }

    return results;
  }

  private async scrapeBingPage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    const results: RawSearchResult[] = [];

    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Calculate first parameter (Bing shows 10 results per page, first starts at 1)
      const first = (pageNum - 1) * 10 + 1;
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10`;
      
      console.log(`[Bing] Scraping page ${pageNum}: ${url}`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // Wait a bit for dynamic content
      await this.delay(2000);
      
      // Wait for search results
      await page.waitForSelector('#b_results', { timeout: 15000 });

      // Extract search results
      const pageResults = await page.evaluate((pageNum) => {
        const results: Array<{ title: string; url: string; snippet: string; position: number }> = [];
        
        // Select all organic search results
        const searchResults = document.querySelectorAll('li.b_algo');
        
        searchResults.forEach((result, index) => {
          try {
            // Extract title
            const titleElement = result.querySelector('h2 a');
            const title = titleElement?.textContent?.trim() || '';
            
            // Extract URL
            const url = titleElement?.getAttribute('href') || '';
            
            // Extract snippet
            const snippetElement = result.querySelector('p, .b_caption p');
            const snippet = snippetElement?.textContent?.trim() || '';
            
            if (title && url && url.startsWith('http')) {
              results.push({
                title,
                url,
                snippet,
                position: index + 1,
              });
            }
          } catch (e) {
            // Skip invalid results
          }
        });
        
        return results;
      }, pageNum);

      // Add metadata
      pageResults.forEach((result) => {
        results.push({
          ...result,
          page: pageNum,
          engine: 'bing',
        });
      });

    } catch (error) {
      console.error(`Error in scrapeBingPage: ${error}`);
    } finally {
      await page.close();
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let scraperInstance: SearchScraper | null = null;

export async function getSearchScraper(): Promise<SearchScraper> {
  if (!scraperInstance) {
    scraperInstance = new SearchScraper();
    await scraperInstance.initialize();
  }
  return scraperInstance;
}

export async function closeSearchScraper(): Promise<void> {
  if (scraperInstance) {
    await scraperInstance.close();
    scraperInstance = null;
  }
}

