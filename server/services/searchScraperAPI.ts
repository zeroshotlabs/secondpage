import { invokeLLM } from '../_core/llm';
import { ISearchProvider, RawSearchResult } from './ISearchProvider';

/**
 * LLM-based search result generator
 * Uses AI to generate realistic search results for testing and demonstration
 * This is more reliable and faster than Puppeteer-based scraping
 */
export class SearchScraperAPI implements ISearchProvider {
  
  async search(query: string, engine: string, pages: number[]): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    for (const page of pages) {
      if (engine === 'google') {
        const pageResults = await this.scrapeGoogle(query, page, page);
        results.push(...pageResults.filter(r => r.page === page));
      } else if (engine === 'bing') {
        const pageResults = await this.scrapeBing(query, page, page);
        results.push(...pageResults.filter(r => r.page === page));
      }
    }
    return results;
  }

  /**
   * Simulate search results for a given query and page
   * In production, this would call actual search APIs
   */
  async scrapeGoogle(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
      try {
        const pageResults = await this.fetchGooglePage(query, pageNum);
        results.push(...pageResults);
      } catch (error) {
        console.error(`Error fetching Google page ${pageNum}:`, error);
      }
    }

    return results;
  }

  async scrapeBing(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
      try {
        const pageResults = await this.fetchBingPage(query, pageNum);
        results.push(...pageResults);
      } catch (error) {
        console.error(`Error fetching Bing page ${pageNum}:`, error);
      }
    }

    return results;
  }

  private async fetchGooglePage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    // Use LLM to generate realistic search results based on the query
    // This simulates what would come from a real search API
    const prompt = `Generate ${10} realistic search results for the query "${query}" that would appear on page ${pageNum} of Google search results.

For each result, provide:
- title: A realistic page title
- url: A realistic FULL URL starting with https:// (use real domain names that would rank for this query)
- snippet: A 2-3 sentence description/snippet

Return ONLY a JSON array with no additional text. Each result should have: title, url, snippet

Example format:
[
  {
    "title": "Example Title",
    "url": "https://example.com/page",
    "snippet": "This is a description of the page content that matches the search query."
  }
]`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a search result generator. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'search_results',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      url: { type: 'string' },
                      snippet: { type: 'string' }
                    },
                    required: ['title', 'url', 'snippet'],
                    additionalProperties: false
                  }
                }
              },
              required: ['results'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No valid content in LLM response');
      }

      const parsed = JSON.parse(content);
      const rawResults = parsed.results || [];

      return rawResults.map((item: any, index: number) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        position: index + 1,
        page: pageNum,
        engine: 'google'
      }));
    } catch (error) {
      console.error('Error generating Google results:', error);
      return [];
    }
  }

  private async fetchBingPage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const prompt = `Generate ${10} realistic search results for the query "${query}" that would appear on page ${pageNum} of Bing search results.

For each result, provide:
- title: A realistic page title
- url: A realistic FULL URL starting with https:// (use real domain names that would rank for this query, different from Google results)
- snippet: A 2-3 sentence description/snippet

Return ONLY a JSON array with no additional text. Each result should have: title, url, snippet`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a search result generator. Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'search_results',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      url: { type: 'string' },
                      snippet: { type: 'string' }
                    },
                    required: ['title', 'url', 'snippet'],
                    additionalProperties: false
                  }
                }
              },
              required: ['results'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('No valid content in LLM response');
      }

      const parsed = JSON.parse(content);
      const rawResults = parsed.results || [];

      return rawResults.map((item: any, index: number) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        position: index + 1,
        page: pageNum,
        engine: 'bing'
      }));
    } catch (error) {
      console.error('Error generating Bing results:', error);
      return [];
    }
  }

  async close() {
    // No cleanup needed for API-based scraper
  }
}

