# SecondPage.ai

**Search Beyond The First Page**

SecondPage.ai aggregates search results from multiple pages across Google, Bing, DuckduckGo and Brace, intelligently ranks them, removes duplicates, and surfaces hidden gems otherwise missed by SEO.

Skip the SEO manipulation that puts the pages with the engine's own ads on top.

Search Engine Optimization optimizes, afterall, for the search engines.

![SecondPage.ai](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-proprietary-blue.svg)

## Features

- **Multi-Engine Aggregation**: Simultaneously search across Google and Bing
- **Configurable Page Selection**: Choose specific pages (2-10) from each search engine
- **Smart Ranking Algorithm**: Uses Borda count and frequency analysis
- **Duplicate Detection**: Automatically identifies and removes duplicate results
- **Real Search Results**: HTTP-based scraping for authentic search data
- **Modern UI**: Clean, responsive interface with real-time search
- **Docker Ready**: Fully containerized with database included

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd secondpage-ai
   ```

2. **Create environment file**
   ```bash
   cp env.example.txt .env
   # Edit .env with your settings
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   ```
   http://localhost:3000
   ```

That's it! The application and database are now running.

### Development Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up database**
   - Create a MySQL database
   - Update `DATABASE_URL` in your environment

3. **Push database schema**
   ```bash
   pnpm db:push
   ```

4. **Start development server**
   ```bash
   pnpm dev
   ```

## How It Works

### 1. Multi-Engine Aggregation

SecondPage.ai searches across Google and Bing simultaneously, collecting results from pages 2-10 (configurable) to give you comprehensive coverage beyond the first page.

### 2. Smart Ranking Algorithm

Results are ranked using a **Borda count** algorithm combined with appearance frequency analysis:

- **Base Score**: `(Total Results - Position + 1)`
- **Frequency Bonus**: `(Appearances - 1) × 5`
- **Final Score**: `Base Score + Frequency Bonus`

Results appearing in multiple search engines get bonus points, indicating higher relevance.

### 3. Duplicate Detection

Before ranking, duplicates are identified using:
- **URL Normalization**: Strips protocols, www, trailing slashes, and query parameters
- **Title Similarity**: Uses string similarity algorithm (85% threshold)
- **Merge Strategy**: Keeps highest-scoring version and combines appearance counts

## Architecture

### Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js 22, Express 4, tRPC 11
- **Database**: MySQL 8.0
- **Search**: HTTP scraping with axios + cheerio
- **Deployment**: Docker + Docker Compose

### Project Structure

```
secondpage-ai/
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Page components
│   │   ├── components/  # Reusable UI components
│   │   └── lib/     # tRPC client
├── server/          # Express backend
│   ├── services/    # Search scraping and ranking
│   ├── routers.ts   # tRPC API routes
│   └── db.ts        # Database helpers
├── drizzle/         # Database schema
├── docker-compose.yml  # Docker orchestration
├── Dockerfile       # Application container
└── init-db.sql      # Database initialization
```

## Configuration

### Search Provider

SecondPage.ai supports two search backends:

**HTTP Scraper (Default - Real Results)**
```env
SEARCH_PROVIDER=http
```
- Real search results from Google and Bing
- Reliable and Docker-friendly
- May be rate-limited

**LLM Generator (Demo/Testing)**
```env
SEARCH_PROVIDER=llm
```
- AI-generated search results
- Faster, no rate limiting
- Good for testing

### Environment Variables

See `env.example.txt` for all available configuration options.

## Documentation

- [Docker Deployment Guide](DOCKER_DEPLOYMENT.md) - Complete Docker setup and production deployment
- [Search Provider Configuration](SEARCH_PROVIDER_CONFIG.md) - How to switch between search backends

## API

### Search Endpoint

```typescript
// Execute search
trpc.search.execute.useMutation({
  query: "machine learning",
  engineConfigs: [
    { engine: "google", pages: [2, 3] },
    { engine: "bing", pages: [2, 3] }
  ]
})
```

### Response Format

```typescript
{
  searchId: string;
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    sourceEngine: string;
    originalPosition: number;
    originalPage: number;
    finalScore: number;
    appearances: number;
  }>;
  totalResults: number;
  uniqueResults: number;
  cached: boolean;
}
```

## Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm db:push      # Push database schema changes
pnpm lint         # Run linter
pnpm type-check   # Run TypeScript type checking
```

### Database Management

```bash
# Push schema changes
pnpm db:push

# Generate migrations
pnpm db:generate

# View database studio
pnpm db:studio
```

## Production Deployment

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed production deployment instructions, including:

- Security best practices
- Nginx reverse proxy setup
- SSL/TLS configuration
- Automatic backups
- Resource limits
- Monitoring

## Troubleshooting

### Search Not Working

1. Check `SEARCH_PROVIDER` environment variable
2. For `http` provider, ensure outbound internet access
3. Check logs for rate limiting errors

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Ensure database is running and accessible
3. Check database logs

### Docker Issues

```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Complete reset
docker-compose down -v
docker-compose up -d
```

## License

© 2025 Zero Shot Laboratories, Inc. All rights reserved.

This is proprietary software. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.

## Support

For issues and questions, please contact support or open an issue on the project repository.

---

**Built with ❤️ by Zero Shot Laboratories**

