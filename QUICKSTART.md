# SecondPage.ai - Quick Start Guide

## What's Included

This bundle contains the complete SecondPage.ai application ready to run with Docker.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 2.0+)

Install Docker: https://docs.docker.com/get-docker/

## Quick Start (5 Minutes)

### 1. Extract the Bundle

```bash
tar -xzf secondpage-ai-bundle.tar.gz
cd secondpage-ai
```

### 2. Create Environment File

```bash
cp env.example.txt .env
```

Edit `.env` and set secure passwords:

```env
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=secondpage
MYSQL_USER=secondpage_user
MYSQL_PASSWORD=your_secure_password
JWT_SECRET=your_random_jwt_secret_key_here
SEARCH_PROVIDER=http
APP_PORT=3000
```

**Important:** Change the default passwords!

### 3. Start the Application

```bash
docker-compose up -d
```

This will:
- Download required Docker images
- Build the application
- Start MySQL database
- Initialize database schema
- Start the web application

### 4. Access the Application

Open your browser:
```
http://localhost:3000
```

## Verify Everything is Running

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

You should see both containers running and healthy.

## Test the Search

1. Go to http://localhost:3000
2. Enter a search query (e.g., "artificial intelligence")
3. Select pages to search (default: 2, 3)
4. Click "Search SecondPage"
5. Wait 10-20 seconds for results

## Common Commands

```bash
# Stop the application
docker-compose stop

# Start the application
docker-compose start

# View logs
docker-compose logs -f app

# Restart everything
docker-compose restart

# Stop and remove everything
docker-compose down

# Stop and remove including data
docker-compose down -v
```

## Troubleshooting

### Port Already in Use

Change the port in `.env`:
```env
APP_PORT=8080
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

### Database Connection Failed

Check if database is healthy:
```bash
docker-compose ps
```

View database logs:
```bash
docker-compose logs database
```

### Search Returns No Results

The HTTP scraper may be rate-limited. Try:
1. Wait a few minutes
2. Use different search queries
3. Check logs: `docker-compose logs app`

## Files Overview

```
secondpage-ai/
├── docker-compose.yml       # Docker orchestration
├── Dockerfile              # Application container
├── init-db.sql             # Database schema
├── env.example.txt         # Environment template
├── README.md               # Full documentation
├── DOCKER_DEPLOYMENT.md    # Detailed Docker guide
├── client/                 # Frontend code
├── server/                 # Backend code
└── drizzle/                # Database schema
```

## Next Steps

- Read `README.md` for full documentation
- Read `DOCKER_DEPLOYMENT.md` for production deployment
- Customize the application branding
- Set up SSL/TLS for production
- Configure automatic backups

## Support

For issues, check:
1. `docker-compose logs -f`
2. README.md troubleshooting section
3. DOCKER_DEPLOYMENT.md

## Security Notes

- Change all default passwords in `.env`
- Don't commit `.env` to version control
- Use strong random values for `JWT_SECRET`
- For production, follow DOCKER_DEPLOYMENT.md security guide

---

© 2025 Zero Shot Laboratories, Inc. All rights reserved.

