import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { ISearchProvider, RawSearchResult } from './ISearchProvider';

// Rotate user agents to reduce fingerprinting
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

const DEBUG_DIR = '/tmp/scrape-debug';

export class SearchScraperHTTP implements ISearchProvider {
  private client: AxiosInstance;
  private braveApiKey: string | null;
  private googleApiKey: string | null;
  private googleCseId: string | null;
  // braveCache is declared near fetchBraveAPIBatch

  constructor() {
    this.braveApiKey = process.env.BRAVE_API_KEY || null;
    this.googleApiKey = process.env.GOOGLE_API_KEY || null;
    this.googleCseId = process.env.GOOGLE_CSE_ID || null;
    this.client = axios.create({
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    try { fs.mkdirSync(DEBUG_DIR, { recursive: true }); } catch (_) {}
  }

  async initialize(): Promise<void> {
    const engines: string[] = [];
    if (this.googleApiKey && this.googleCseId) {
      engines.push('google (CSE API)');
    } else {
      engines.push('google (scrape — unreliable from servers)');
    }
    engines.push('bing');
    engines.push('duckduckgo (may be blocked from datacenter IPs)');
    if (this.braveApiKey) {
      engines.push('brave (API)');
    } else {
      engines.push('brave (scrape)');
    }
    console.log(`[HTTP] Search scraper initialized — engines: ${engines.join(', ')}`);
    console.log(`[HTTP] Debug HTML saved to ${DEBUG_DIR}/`);
  }

  private getHeaders(referer?: string): Record<string, string> {
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    return {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...(referer ? { 'Referer': referer } : {}),
    };
  }

  private saveDebugResponse(engine: string, pageNum: number, status: number, body: string, resultCount: number): void {
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = body.trimStart().startsWith('{') ? 'json' : 'html';
      const filename = `${engine}_p${pageNum}_${resultCount}results_${status}_${ts}.${ext}`;
      const filepath = path.join(DEBUG_DIR, filename);
      const meta = `<!-- engine=${engine} page=${pageNum} status=${status} results=${resultCount} time=${new Date().toISOString()} -->\n`;
      fs.writeFileSync(filepath, meta + body, 'utf-8');
      console.log(`[HTTP/${engine}] Debug saved: ${filename} (${(body.length / 1024).toFixed(1)}KB)`);
    } catch (err: any) {
      console.warn(`[HTTP/${engine}] Failed to save debug file: ${err.message}`);
    }
  }

  private logHtmlDiagnostics(engine: string, pageNum: number, $: cheerio.CheerioAPI, resultCount: number): void {
    const title = $('title').text().trim();
    const bodyLen = $.html().length;
    const h3Count = $('h3').length;
    const linkCount = $('a[href^="http"]').length;

    console.log(`[HTTP/${engine}] Page ${pageNum} diagnostics: title="${title.slice(0, 80)}" bodySize=${(bodyLen / 1024).toFixed(1)}KB h3s=${h3Count} links=${linkCount} results=${resultCount}`);

    const text = $.text().toLowerCase();
    if (text.includes('captcha') || text.includes('unusual traffic') || text.includes('are you a robot')) {
      console.warn(`[HTTP/${engine}] CAPTCHA/bot-check detected on page ${pageNum}`);
    }
    if (text.includes('botnet') || text.includes('anomaly')) {
      console.warn(`[HTTP/${engine}] Bot/anomaly detection triggered on page ${pageNum} — this IP may be flagged`);
    }
    if (text.includes('blocked') || text.includes('forbidden') || text.includes('access denied')) {
      console.warn(`[HTTP/${engine}] Access blocked on page ${pageNum}`);
    }
  }

  async search(query: string, engine: string, pages: number[]): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    for (const page of pages) {
      try {
        let pageResults: RawSearchResult[] = [];

        switch (engine) {
          case 'google':
            pageResults = (this.googleApiKey && this.googleCseId)
              ? await this.searchGoogleCSE(query, page)
              : await this.scrapeGooglePage(query, page);
            break;
          case 'bing':
            pageResults = await this.scrapeBingPage(query, page);
            break;
          case 'duckduckgo':
            pageResults = await this.scrapeDuckDuckGoPage(query, page);
            break;
          case 'brave':
            pageResults = this.braveApiKey
              ? await this.searchBraveAPI(query, page)
              : await this.scrapeBravePage(query, page);
            break;
          default:
            console.warn(`[HTTP] Unknown engine: ${engine}`);
        }

        results.push(...pageResults);

        // Stagger requests to avoid rate limiting
        if (pages.indexOf(page) < pages.length - 1) {
          await this.delay(1500 + Math.random() * 1000);
        }
      } catch (error: any) {
        console.error(`[HTTP] Error searching ${engine} page ${page}: ${error.message}`);
      }
    }

    return results;
  }

  // ─── Google Custom Search API ─────────────────────────────────────────

  private async searchGoogleCSE(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const start = (pageNum - 1) * 10 + 1; // CSE uses 1-based start

    const rangeEnd = start + 9;
    console.log(`[HTTP/Google CSE] Searching page ${pageNum} (results ${start}-${rangeEnd})`);

    const response = await this.client.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: this.googleApiKey,
        cx: this.googleCseId,
        q: query,
        start,
        num: 10,
        gl: 'us',
        hl: 'en',
      },
      headers: {
        'Accept': 'application/json',
      },
    });

    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);

    if (response.status !== 200) {
      console.warn(`[HTTP/Google CSE] Got status ${response.status}: ${body.slice(0, 300)}`);
      this.saveDebugResponse('google-cse', pageNum, response.status, body, 0);
      return results;
    }

    const items = response.data?.items || [];
    items.forEach((item: any, i: number) => {
      results.push({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
        page: pageNum,
        position: i + 1,
        engine: 'google',
      });
    });

    if (results.length > 0) {
      console.log(`[HTTP/Google CSE] Page ${pageNum}: ${results.length} results (${start}-${start + results.length - 1})`);
    } else {
      console.log(`[HTTP/Google CSE] Page ${pageNum}: 0 results`);
    }
    return results;
  }

  // ─── Google (scrape fallback) ─────────────────────────────────────────

  private async scrapeGooglePage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const start = (pageNum - 1) * 10;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${start}&num=10&hl=en&gl=us`;

    const rangeStart = start + 1;
    const rangeEnd = start + 10;
    console.log(`[HTTP/Google] Scraping page ${pageNum} (results ${rangeStart}-${rangeEnd}, note: often blocked from server IPs)`);

    const response = await this.client.get(url, {
      headers: this.getHeaders('https://www.google.com/'),
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data);

    if (response.status !== 200) {
      console.warn(`[HTTP/Google] Got status ${response.status}`);
      this.saveDebugResponse('google', pageNum, response.status, html, 0);
      return results;
    }

    // Detect JS-only response (Google requires JS from server IPs)
    if (html.includes('/httpservice/retry/enablejs') || html.includes('<noscript>')) {
      console.warn(`[HTTP/Google] Page requires JavaScript — scraping not possible from this IP. Set GOOGLE_API_KEY and GOOGLE_CSE_ID for reliable results.`);
      this.saveDebugResponse('google', pageNum, response.status, html, 0);
      return results;
    }

    const $ = cheerio.load(html);
    let position = 0;

    $('div.g, div[data-sokoban-container], div[data-hveid]').each((_, element) => {
      try {
        const $el = $(element);
        if ($el.parents('div.g').length > 0 && $el.is('div.g')) return;

        const title = $el.find('h3').first().text().trim();
        if (!title) return;

        let href = $el.find('a[href^="http"]').first().attr('href') || '';
        if (!href || href.includes('google.com/search') || href.includes('google.com/url')) {
          const cite = $el.find('cite').first().text().trim();
          if (cite && cite.startsWith('http')) href = cite;
        }
        if (!href || !href.startsWith('http')) return;
        if (href.includes('google.com')) return;

        const snippet = (
          $el.find('div[data-sncf]').first().text() ||
          $el.find('div.VwiC3b').first().text() ||
          $el.find('div[style*="-webkit-line-clamp"]').first().text() ||
          $el.find('span.aCOpRe').first().text() ||
          ''
        ).trim();

        results.push({
          title,
          url: href,
          snippet,
          page: pageNum,
          position: ++position,
          engine: 'google',
        });
      } catch (_) { /* skip */ }
    });

    if (results.length > 0) {
      console.log(`[HTTP/Google] Page ${pageNum}: ${results.length} results (${rangeStart}-${rangeStart + results.length - 1})`);
    } else {
      console.log(`[HTTP/Google] Page ${pageNum}: 0 results`);
    }
    this.logHtmlDiagnostics('Google', pageNum, $, results.length);
    this.saveDebugResponse('google', pageNum, response.status, html, results.length);

    return results;
  }

  // ─── Bing ─────────────────────────────────────────────────────────────

  private decodeBingUrl(href: string): string {
    try {
      const urlObj = new URL(href);
      const uParam = urlObj.searchParams.get('u');
      if (uParam && uParam.startsWith('a1')) {
        const decoded = Buffer.from(uParam.slice(2), 'base64').toString('utf-8');
        if (decoded.startsWith('http')) return decoded;
      }
    } catch (_) { /* not a redirect URL */ }
    return href;
  }

  private async scrapeBingPage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const first = (pageNum - 1) * 10 + 1;
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${first}&count=10`;

    const rangeEnd = first + 9;
    console.log(`[HTTP/Bing] Scraping page ${pageNum} (results ${first}-${rangeEnd})`);

    const response = await this.client.get(url, {
      headers: this.getHeaders('https://www.bing.com/'),
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data);

    if (response.status !== 200) {
      console.warn(`[HTTP/Bing] Got status ${response.status}`);
      this.saveDebugResponse('bing', pageNum, response.status, html, 0);
      return results;
    }

    const $ = cheerio.load(html);
    let position = 0;

    $('li.b_algo').each((_, element) => {
      try {
        const $el = $(element);
        const titleEl = $el.find('h2 a').first();
        const title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';

        if (href.includes('bing.com/ck/a')) {
          href = this.decodeBingUrl(href);
        }

        const snippet = (
          $el.find('div.b_caption p').first().text() ||
          $el.find('p').first().text() ||
          ''
        ).trim();

        if (title && href && href.startsWith('http')) {
          results.push({
            title,
            url: href,
            snippet,
            page: pageNum,
            position: ++position,
            engine: 'bing',
          });
        }
      } catch (_) { /* skip */ }
    });

    if (results.length > 0) {
      console.log(`[HTTP/Bing] Page ${pageNum}: ${results.length} results (${first}-${first + results.length - 1})`);
    } else {
      console.log(`[HTTP/Bing] Page ${pageNum}: 0 results`);
    }

    if (results.length === 0) {
      this.logHtmlDiagnostics('Bing', pageNum, $, 0);
      this.saveDebugResponse('bing', pageNum, response.status, html, 0);
    }

    return results;
  }

  // ─── DuckDuckGo ───────────────────────────────────────────────────────

  private async scrapeDuckDuckGoPage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    const ddgOffset = (pageNum - 1) * 30;
    const rangeStart = ddgOffset + 1;
    const rangeEnd = ddgOffset + 30;
    console.log(`[HTTP/DDG] Scraping page ${pageNum} (results ${rangeStart}-${rangeEnd})`);

    // Use html.duckduckgo.com — more scraper-friendly than the main site
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const params: Record<string, string> = { q: query };
    if (pageNum > 1) {
      params.s = String((pageNum - 1) * 30);
      params.dc = String((pageNum - 1) * 30 + 1);
    }

    const response = pageNum === 1
      ? await this.client.get(url, {
          headers: this.getHeaders(),
        })
      : await this.client.post('https://html.duckduckgo.com/html/', new URLSearchParams(params).toString(), {
          headers: {
            ...this.getHeaders('https://html.duckduckgo.com/'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

    const html = typeof response.data === 'string' ? response.data : String(response.data);

    if (response.status !== 200) {
      console.warn(`[HTTP/DDG] Got status ${response.status}`);
      this.saveDebugResponse('ddg', pageNum, response.status, html, 0);
      return results;
    }

    // Detect botnet/anomaly detection — DDG flags datacenter IPs
    if (html.includes('cc=botnet') || html.includes('anomaly.js') || html.includes('challenge-form')) {
      console.warn(`[HTTP/DDG] Bot detection triggered on page ${pageNum} — this server IP is flagged by DDG. Results unavailable.`);
      this.saveDebugResponse('ddg', pageNum, response.status, html, 0);
      return results;
    }

    const $ = cheerio.load(html);
    let position = 0;

    $('.result').each((_, element) => {
      try {
        const $el = $(element);
        const titleEl = $el.find('a.result__a').first();
        const title = titleEl.text().trim();
        let href = titleEl.attr('href') || '';

        // DDG uses redirect URLs: //duckduckgo.com/l/?uddg=<encoded_url>
        if (href.includes('duckduckgo.com/l/?uddg=')) {
          try {
            const fullUrl = href.startsWith('//') ? 'https:' + href : href;
            const uddg = new URL(fullUrl).searchParams.get('uddg');
            if (uddg) href = uddg;
          } catch (_) { /* use original */ }
        }

        if (!title || !href || !href.startsWith('http')) return;
        if (href.includes('duckduckgo.com')) return;

        const snippet = $el.find('.result__snippet').text().trim() || '';

        results.push({
          title,
          url: href,
          snippet,
          page: pageNum,
          position: ++position,
          engine: 'duckduckgo',
        });
      } catch (_) { /* skip */ }
    });

    if (results.length > 0) {
      console.log(`[HTTP/DDG] Page ${pageNum}: ${results.length} results (${rangeStart}-${rangeStart + results.length - 1})`);
    } else {
      console.log(`[HTTP/DDG] Page ${pageNum}: 0 results`);
    }

    if (results.length === 0) {
      this.logHtmlDiagnostics('DDG', pageNum, $, 0);
      this.saveDebugResponse('ddg', pageNum, response.status, html, 0);
    }

    return results;
  }

  // ─── Brave Search API ─────────────────────────────────────────────────

  private braveCache: { query: string; results: RawSearchResult[] } | null = null;

  private async fetchBraveAPIBatch(query: string, requestedPages: number[]): Promise<RawSearchResult[]> {
    // Brave free tier: offset max 9, count max 20. We make two calls to maximize coverage:
    //   Call 1: offset=0, count=20 → results 1-20 (pages 1-2)
    //   Call 2: offset=9, count=20 → results 10-29 (pages 2-3, overlapping)
    // After dedup we get up to ~29 unique results ≈ 3 pages.
    const maxPage = Math.max(...requestedPages);
    const calls: { offset: number; count: number }[] = [{ offset: 0, count: 20 }];
    if (maxPage > 2) {
      calls.push({ offset: 9, count: 20 });
    }

    const allRaw: { title: string; url: string; snippet: string }[] = [];
    const seenUrls = new Set<string>();

    for (const call of calls) {
      console.log(`[HTTP/Brave API] Fetching offset=${call.offset}, count=${call.count}`);
      try {
        const response = await this.client.get('https://api.search.brave.com/res/v1/web/search', {
          params: {
            q: query,
            count: call.count,
            offset: call.offset,
            search_lang: 'en',
            country: 'us',
          },
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': this.braveApiKey!,
          },
        });

        const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        if (response.status !== 200) {
          console.warn(`[HTTP/Brave API] Got status ${response.status}: ${body.slice(0, 300)}`);
          this.saveDebugResponse('brave-api', call.offset, response.status, body, 0);
          continue;
        }

        const webResults = response.data?.web?.results || [];
        for (const r of webResults) {
          const url = r.url || '';
          if (!seenUrls.has(url)) {
            seenUrls.add(url);
            allRaw.push({ title: r.title || '', url, snippet: r.description || '' });
          }
        }
      } catch (err: any) {
        console.error(`[HTTP/Brave API] Fetch error (offset=${call.offset}): ${err.message}`);
      }
    }

    // Assign page numbers (10 results per page)
    const results: RawSearchResult[] = allRaw.map((r, i) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      page: Math.floor(i / 10) + 1,
      position: (i % 10) + 1,
      engine: 'brave',
    }));

    const totalPages = Math.ceil(results.length / 10);
    console.log(`[HTTP/Brave API] Fetched ${results.length} unique results across ${totalPages} pages (results 1-${results.length})`);
    if (maxPage > totalPages) {
      console.warn(`[HTTP/Brave API] Requested up to page ${maxPage} but free tier only yields ${totalPages} pages (~${results.length} results)`);
    }
    return results;
  }

  private async searchBraveAPI(query: string, pageNum: number): Promise<RawSearchResult[]> {
    // Lazy-fetch all pages on first call, cache for subsequent page requests
    if (!this.braveCache || this.braveCache.query !== query) {
      // We don't know all requested pages here, so fetch max (3 pages worth)
      const allResults = await this.fetchBraveAPIBatch(query, [1, 2, 3]);
      this.braveCache = { query, results: allResults };
    }
    const pageResults = this.braveCache.results.filter(r => r.page === pageNum);
    if (pageResults.length > 0) {
      const rangeStart = (pageNum - 1) * 10 + 1;
      const rangeEnd = rangeStart + pageResults.length - 1;
      console.log(`[HTTP/Brave API] Page ${pageNum}: ${pageResults.length} results (${rangeStart}-${rangeEnd})`);
    } else {
      console.log(`[HTTP/Brave API] Page ${pageNum}: 0 results (free tier limit reached)`);
    }
    return pageResults;
  }

  // ─── Brave Search (HTML scrape fallback) ──────────────────────────────

  private async scrapeBravePage(query: string, pageNum: number): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const offset = (pageNum - 1) * 10;
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&offset=${offset}`;

    console.log(`[HTTP/Brave] Scraping page ${pageNum}`);

    const response = await this.client.get(url, {
      headers: this.getHeaders('https://search.brave.com/'),
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data);

    if (response.status !== 200) {
      console.warn(`[HTTP/Brave] Got status ${response.status}`);
      this.saveDebugResponse('brave', pageNum, response.status, html, 0);
      return results;
    }

    const $ = cheerio.load(html);
    let position = 0;

    $('#results .snippet, .result').each((_, element) => {
      try {
        const $el = $(element);
        const titleEl = $el.find('.snippet-title, .result-header a, a.heading').first();
        const title = titleEl.text().trim();
        const href = titleEl.attr('href') || $el.find('a[href^="http"]').first().attr('href') || '';
        const snippet = (
          $el.find('.snippet-description, .result-snippet, .snippet-content').first().text() || ''
        ).trim();

        if (title && href && href.startsWith('http') && !href.includes('brave.com')) {
          results.push({
            title,
            url: href,
            snippet,
            page: pageNum,
            position: ++position,
            engine: 'brave',
          });
        }
      } catch (_) { /* skip */ }
    });

    console.log(`[HTTP/Brave] Found ${results.length} results on page ${pageNum}`);

    if (results.length === 0) {
      this.logHtmlDiagnostics('Brave', pageNum, $, 0);
      this.saveDebugResponse('brave', pageNum, response.status, html, 0);
    }

    return results;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    console.log('[HTTP] Search scraper closed');
  }
}
