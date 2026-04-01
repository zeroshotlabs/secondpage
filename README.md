# SecondPage.ai

**Search Beyond The First Page**

SecondPage.ai aggregates search results from multiple pages across Bing, DuckDuckGo, Brave, and Google, intelligently ranks them, removes duplicates, and surfaces hidden gems buried beyond page one.

Skip the SEO manipulation that puts the pages with the engine's own ads on top. Search Engine Optimization optimizes, after all, for the search engines.

**Contributions welcome! Pull requests and suggestions encouraged.**

![SecondPage.ai](https://img.shields.io/badge/status-active-success.svg)

## Features

- **Multi-Engine Aggregation**: Simultaneously search across Bing, DuckDuckGo, Brave, and Google
- **Configurable Page Selection**: Choose specific pages (2-10) from each search engine
- **Smart Ranking Algorithm**: Uses Borda count and frequency analysis
- **Duplicate Detection**: Automatically identifies and removes duplicate results
- **REST API**: OpenAPI 3.0 spec at `/api-v1/openapi.json`
- **Modern UI**: Clean, responsive interface with real-time search
- **Docker Ready**: Fully containerized with database included

## Quick Start

### Using Docker (Recommended)

```bash
git clone https://github.com/nicholasgriffintn/secondpage.ai.git
cd secondpage.ai
cp .env.example .env
# Edit .env with your settings (at minimum, set passwords and BRAVE_API_KEY)
docker-compose up -d
```

Open http://localhost:3000 — the application and database are now running.

### Development Setup

```bash
pnpm install
# Create a MySQL database, then set DATABASE_URL in .env
pnpm db:push
pnpm dev
```

## How It Works

### 1. Multi-Engine Aggregation

SecondPage.ai searches across multiple engines simultaneously, collecting results from pages 2-10 (configurable) to surface content beyond the first page.

### 2. Smart Ranking Algorithm

Results are ranked using a **Borda count** algorithm combined with appearance frequency:

- **Base Score**: `(Total Results - Position + 1)`
- **Frequency Bonus**: `(Appearances - 1) × 5`

Results appearing in multiple engines get bonus points, indicating higher relevance.

### 3. Duplicate Detection

Duplicates are identified using URL normalization and title similarity (85% threshold), then merged to combine appearance counts.

## Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Node.js 22, Express 4, tRPC 11 |
| Database | MySQL 8.0 (Drizzle ORM) |
| Search | Brave API, HTTP scraping (axios + cheerio) |
| Deployment | Docker, AWS App Runner |

```
secondpage-ai/
├── client/              # React frontend
│   └── src/
│       ├── pages/       # Page components (Home, Search, About)
│       ├── components/  # UI components (shadcn/ui)
│       └── lib/         # tRPC client, utilities
├── server/              # Express backend
│   ├── _core/           # Server setup, context, env
│   ├── services/        # Search scraping, ranking, orchestration
│   ├── routers.ts       # tRPC API routes
│   ├── apiV1.ts         # REST API v1 + OpenAPI spec
│   └── db.ts            # Database helpers
├── drizzle/             # Database schema and migrations
├── shared/              # Shared types between client/server
├── docker-compose.yml
├── Dockerfile
└── init-db.sql
```

## REST API (v1)

All endpoints require `X-API-Key` header except the OpenAPI spec.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api-v1/openapi.json` | OpenAPI 3.0 specification |
| POST | `/api-v1/search` | Execute a search |
| GET | `/api-v1/search/{id}` | Fetch previous search by ID |
| GET | `/api-v1/engines` | List available search engines |

### Example

```bash
curl -X POST https://secondpage.ai/api-v1/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"query": "machine learning", "engines": ["bing", "brave"]}'
```

## Configuration

### Search Engines

| Engine | Type | Setup |
|--------|------|-------|
| Brave | API | Set `BRAVE_API_KEY` ([get free key](https://api.search.brave.com/)) |
| Google | API | Set `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` |
| Bing | Scraping | Works out of the box |
| DuckDuckGo | Scraping | Works out of the box (may be blocked from datacenter IPs) |

### Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string |
| `SEARCH_PROVIDER` | `http` (real results) or `llm` (demo/testing) |
| `BRAVE_API_KEY` | Brave Search API key |
| `API_KEY` | Key for REST API v1 authentication |
| `CANONICAL_HOST` | Hostname for redirect (e.g., `secondpage.ai`) |

## Development Scripts

```bash
pnpm dev       # Start development server with HMR
pnpm build     # Build for production (vite + esbuild)
pnpm start     # Start production server
pnpm check     # TypeScript type checking
pnpm test      # Run tests
pnpm db:push   # Generate and run database migrations
```

## Production Deployment

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for Docker-based production deployment with nginx, TLS, backups, and monitoring.

## Troubleshooting

**Search returning empty results?**
- Ensure outbound internet access from the server
- Check `BRAVE_API_KEY` is set for Brave engine
- Bing/DDG scraping may be blocked from datacenter IPs

**Database connection errors?**
- Verify `DATABASE_URL` format: `mysql://user:pass@host:3306/dbname`
- Ensure MySQL is running and accessible

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built by [Zero Shot Laboratories](https://zsl.ai)**
