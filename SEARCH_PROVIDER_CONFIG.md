# Search Provider Configuration

SecondPage.ai supports two different search backend implementations that can be switched via configuration.

## Available Providers

### 1. LLM-based Generator (Default)
- **Type**: `llm`
- **Description**: Uses AI (LLM) to generate realistic search results
- **Pros**: 
  - Fast and reliable
  - No rate limiting issues
  - No browser automation overhead
  - Works consistently
- **Cons**: 
  - Generated results (not real search data)
  - Best for demos and testing
- **Use Case**: Development, testing, demonstrations

### 2. Puppeteer Web Scraper
- **Type**: `puppeteer`
- **Description**: Uses browser automation to scrape actual search engine pages
- **Pros**: 
  - Real search results from Google and Bing
  - Authentic data
- **Cons**: 
  - Slower (requires page loading and navigation)
  - Prone to timeouts and rate limiting
  - Requires Chromium/Chrome installation
  - May break if search engines change their HTML structure
- **Use Case**: Production with real data needs

## Configuration

### Method 1: Environment Variable (Recommended)

Set the `SEARCH_PROVIDER` environment variable:

```bash
# Use LLM-based generator (default)
SEARCH_PROVIDER=llm

# Use Puppeteer scraper
SEARCH_PROVIDER=puppeteer
```

### Method 2: Code Configuration

Edit `server/services/searchProviderFactory.ts`:

```typescript
const SEARCH_PROVIDER: SearchProviderType = 'llm'; // or 'puppeteer'
```

## Switching Providers

1. **Update environment variable** or edit the factory file
2. **Restart the development server**: `pnpm dev`
3. The new provider will be used for all subsequent searches

## Implementation Details

All search providers implement the `ISearchProvider` interface:

```typescript
interface ISearchProvider {
  scrapeGoogle(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]>;
  scrapeBing(query: string, pageStart: number, pageEnd: number): Promise<RawSearchResult[]>;
  close(): Promise<void>;
}
```

### Files

- `server/services/ISearchProvider.ts` - Interface definition
- `server/services/searchProviderFactory.ts` - Provider factory and configuration
- `server/services/searchScraperAPI.ts` - LLM-based implementation
- `server/services/searchScraper.ts` - Puppeteer-based implementation
- `server/services/searchOrchestrator.ts` - Uses the configured provider

## Default Configuration

By default, SecondPage.ai uses the **LLM-based generator** for:
- Faster response times
- Better reliability
- No external dependencies on search engines
- Consistent demo experience

To use real search data in production, switch to the Puppeteer provider.

