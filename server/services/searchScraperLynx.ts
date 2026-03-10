import { exec } from 'child_process';
import { promisify } from 'util';
import { ISearchProvider, RawSearchResult } from './ISearchProvider';

const execAsync = promisify(exec);

/**
 * Lynx-based search scraper
 * Uses the Lynx text browser to scrape real search results from Google and Bing
 * Much faster and more reliable than Puppeteer for text extraction
 */
export class SearchScraperLynx implements ISearchProvider {
  async initialize(): Promise<void> {
    // No initialization needed for Lynx
    console.log('[Lynx] Search scraper initialized');
  }

  async search(query: string, engine: string, pages: number[]): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    for (const page of pages) {
      try {
        if (engine === 'google') {
          const pageResults = await this.scrapeGooglePage(query, page);
          results.push(...pageResults);
        } else if (engine === 'bing') {
          const pageResults = await this.scrapeBingPage(query, page);
          results.push(...pageResults);
        }
        
        // Add delay between requests to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        console.error(`[Lynx] Error scraping ${engine} page ${page}:`, error);
      }
    }

    return results;
  }

  private async scrapeGooglePage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    
    try {
      // Calculate start parameter (Google shows 10 results per page)
      const start = (pageNum - 1) * 10;
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10&hl=en`;
      
      console.log(`[Lynx/Google] Scraping page ${pageNum}: ${url}`);
      
      // Use lynx to dump the page content
      const { stdout } = await execAsync(`lynx -dump -nolist -accept_all_cookies "${url}"`);
      
      // Parse the lynx output
      const lines = stdout.split('\n');
      let currentResult: Partial<RawSearchResult> | null = null;
      let position = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for URLs (they typically start with http)
        if (line.startsWith('http') && !line.includes('google.com') && !line.includes('gstatic.com')) {
          // If we have a previous result, save it
          if (currentResult && currentResult.title && currentResult.url) {
            results.push({
              title: currentResult.title,
              url: currentResult.url,
              snippet: currentResult.snippet || '',
              page: pageNum,
              position: ++position,
              engine: 'google'
            });
          }
          
          // Start a new result
          currentResult = {
            url: line,
            title: '',
            snippet: ''
          };
        }
        // Look for potential titles (non-empty lines after URL)
        else if (currentResult && !currentResult.title && line.length > 10 && line.length < 200) {
          currentResult.title = line;
        }
        // Look for snippets (longer text blocks)
        else if (currentResult && currentResult.title && !currentResult.snippet && line.length > 20) {
          currentResult.snippet = line;
        }
      }
      
      // Save the last result
      if (currentResult && currentResult.title && currentResult.url) {
        results.push({
          title: currentResult.title,
          url: currentResult.url,
          snippet: currentResult.snippet || '',
          page: pageNum,
          position: ++position,
          engine: 'google'
        });
      }
      
      console.log(`[Lynx/Google] Found ${results.length} results on page ${pageNum}`);
    } catch (error) {
      console.error(`[Lynx/Google] Error scraping page ${pageNum}:`, error);
    }
    
    return results;
  }

  private async scrapeBingPage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    
    try {
      // Calculate first parameter (Bing shows 10 results per page, first starts at 1)
      const first = (pageNum - 1) * 10 + 1;
      const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10`;
      
      console.log(`[Lynx/Bing] Scraping page ${pageNum}: ${url}`);
      
      // Use lynx to dump the page content
      const { stdout } = await execAsync(`lynx -dump -nolist -accept_all_cookies "${url}"`);
      
      // Parse the lynx output
      const lines = stdout.split('\n');
      let currentResult: Partial<RawSearchResult> | null = null;
      let position = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for URLs (they typically start with http)
        if (line.startsWith('http') && !line.includes('bing.com') && !line.includes('microsoft.com')) {
          // If we have a previous result, save it
          if (currentResult && currentResult.title && currentResult.url) {
            results.push({
              title: currentResult.title,
              url: currentResult.url,
              snippet: currentResult.snippet || '',
              page: pageNum,
              position: ++position,
              engine: 'bing'
            });
          }
          
          // Start a new result
          currentResult = {
            url: line,
            title: '',
            snippet: ''
          };
        }
        // Look for potential titles (non-empty lines after URL)
        else if (currentResult && !currentResult.title && line.length > 10 && line.length < 200) {
          currentResult.title = line;
        }
        // Look for snippets (longer text blocks)
        else if (currentResult && currentResult.title && !currentResult.snippet && line.length > 20) {
          currentResult.snippet = line;
        }
      }
      
      // Save the last result
      if (currentResult && currentResult.title && currentResult.url) {
        results.push({
          title: currentResult.title,
          url: currentResult.url,
          snippet: currentResult.snippet || '',
          page: pageNum,
          position: ++position,
          engine: 'bing'
        });
      }
      
      console.log(`[Lynx/Bing] Found ${results.length} results on page ${pageNum}`);
    } catch (error) {
      console.error(`[Lynx/Bing] Error scraping page ${pageNum}:`, error);
    }
    
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    // No cleanup needed for Lynx
    console.log('[Lynx] Search scraper closed');
  }
}

