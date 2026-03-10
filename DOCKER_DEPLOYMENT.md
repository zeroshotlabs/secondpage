# Docker Deployment Guide for SecondPage.ai

This guide explains how to build and run SecondPage.ai as a fully self-contained Docker application with MySQL database included.

## Prerequisites

- Docker installed (version 20.10 or higher)
- Docker Compose installed (version 2.0 or higher)

## Quick Start (Recommended)

### 1. Create Environment File

Copy the example environment file and customize it:

```bash
cp env.example.txt .env
```

Edit `.env` with your preferred values:

```env
# Database Configuration
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=secondpage
MYSQL_USER=secondpage_user
MYSQL_PASSWORD=your_secure_password

# Application Configuration
APP_PORT=3000
JWT_SECRET=your_random_jwt_secret_key_here
SEARCH_PROVIDER=http

# Application Branding
VITE_APP_ID=secondpage-ai
VITE_APP_TITLE=SecondPage.ai
```

**Important:** Change the default passwords and JWT secret for production use!

### 2. Start Everything with Docker Compose

```bash
docker-compose up -d
```

This single command will:
- Start a MySQL 8.0 database container
- Initialize the database with required tables
- Build and start the SecondPage.ai application
- Set up networking between containers
- Create persistent storage for database data

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## What's Included

The Docker Compose setup includes:

1. **MySQL Database Container**
   - MySQL 8.0
   - Persistent data storage
   - Automatic initialization with schema
   - Health checks

2. **SecondPage.ai Application Container**
   - Node.js 22 runtime
   - Built application code
   - HTTP-based search scraper
   - Automatic database connection

3. **Docker Network**
   - Isolated network for secure communication
   - Containers can communicate by service name

4. **Persistent Volumes**
   - Database data persists across container restarts
   - No data loss when updating the application

## Environment Variables

### Database Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `secondpage_root_pass` |
| `MYSQL_DATABASE` | Database name | `secondpage` |
| `MYSQL_USER` | Application database user | `secondpage_user` |
| `MYSQL_PASSWORD` | Application database password | `secondpage_pass` |

### Application Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_PORT` | External port to expose | `3000` |
| `JWT_SECRET` | Secret for JWT token signing | `change-this-secret-in-production` |
| `SEARCH_PROVIDER` | Search backend (`http` or `llm`) | `http` |
| `VITE_APP_ID` | Application ID | `secondpage-ai` |
| `VITE_APP_TITLE` | Application title | `SecondPage.ai` |

## Search Provider Options

SecondPage.ai supports two search backends:

### 1. HTTP Scraper (Default - Real Results)

```env
SEARCH_PROVIDER=http
```

- Uses axios + cheerio to scrape real Google and Bing results
- Reliable and Docker-friendly
- No additional dependencies required
- May be rate-limited by search engines

### 2. LLM Generator (Demo/Testing)

```env
SEARCH_PROVIDER=llm
```

- Uses AI to generate realistic search results
- Faster and no rate limiting
- Good for demos and testing
- Not real search data

## Docker Compose Commands

### Start Services

```bash
docker-compose up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just the app
docker-compose logs -f app

# Just the database
docker-compose logs -f database
```

### Stop Services

```bash
docker-compose stop
```

### Stop and Remove Containers

```bash
docker-compose down
```

### Stop and Remove Everything (including data)

```bash
docker-compose down -v
```

**Warning:** This will delete all database data!

### Rebuild and Restart

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Check Service Status

```bash
docker-compose ps
```

## Database Management

### Access MySQL CLI

```bash
docker-compose exec database mysql -u secondpage_user -p
```

Enter the password from your `.env` file.

### Backup Database

```bash
docker-compose exec database mysqldump -u secondpage_user -p secondpage > backup.sql
```

### Restore Database

```bash
docker-compose exec -T database mysql -u secondpage_user -p secondpage < backup.sql
```

### View Database Tables

```bash
docker-compose exec database mysql -u secondpage_user -p -e "USE secondpage; SHOW TABLES;"
```

## Production Deployment

### Security Best Practices

1. **Change Default Passwords**
   ```env
   MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
   MYSQL_PASSWORD=$(openssl rand -base64 32)
   JWT_SECRET=$(openssl rand -base64 32)
   ```

2. **Don't Expose Database Port**
   
   Remove this line from `docker-compose.yml`:
   ```yaml
   ports:
     - "3306:3306"  # Remove this
   ```

3. **Use Nginx Reverse Proxy**

   Update `docker-compose.yml`:
   ```yaml
   app:
     ports:
       - "127.0.0.1:3000:3000"  # Only bind to localhost
   ```

   Configure Nginx:
   ```nginx
   server {
       listen 80;
       server_name secondpage.ai;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Enable SSL with Let's Encrypt**
   ```bash
   sudo certbot --nginx -d secondpage.ai
   ```

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  database:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Automatic Backups

Create a backup script `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T database mysqldump -u secondpage_user -p$MYSQL_PASSWORD secondpage > "backups/backup_$DATE.sql"
gzip "backups/backup_$DATE.sql"
# Keep only last 7 days
find backups/ -name "*.sql.gz" -mtime +7 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

## Troubleshooting

### Database Connection Failed

1. Check if database is healthy:
   ```bash
   docker-compose ps
   ```

2. Check database logs:
   ```bash
   docker-compose logs database
   ```

3. Verify credentials in `.env` file

### Application Won't Start

1. Check application logs:
   ```bash
   docker-compose logs app
   ```

2. Ensure database is ready:
   ```bash
   docker-compose ps database
   ```

3. Rebuild the application:
   ```bash
   docker-compose build --no-cache app
   docker-compose up -d app
   ```

### Port Already in Use

Change the port in `.env`:
```env
APP_PORT=8080
```

### Search Not Working

1. Check search provider setting:
   ```env
   SEARCH_PROVIDER=http
   ```

2. Check application logs:
   ```bash
   docker-compose logs app | grep -i search
   ```

3. For `http` provider, ensure outbound internet access

### Database Data Corruption

1. Stop services:
   ```bash
   docker-compose down
   ```

2. Remove corrupted volume:
   ```bash
   docker volume rm secondpage-ai_mysql_data
   ```

3. Restart (will reinitialize):
   ```bash
   docker-compose up -d
   ```

4. Restore from backup if available

## Monitoring

### View Resource Usage

```bash
docker stats
```

### Health Check Status

```bash
docker-compose ps
```

Look for "(healthy)" status.

### Application Health Endpoint

```bash
curl http://localhost:3000/api/health
```

## Updating the Application

1. Pull latest code:
   ```bash
   git pull
   ```

2. Rebuild and restart:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. Check logs:
   ```bash
   docker-compose logs -f app
   ```

## Complete Reset

To start fresh with a clean database:

```bash
docker-compose down -v
docker-compose up -d
```

**Warning:** This deletes all data!

## Support

For issues and questions, please open an issue on the project repository.

---

© 2025 Zero Shot Laboratories, Inc. All rights reserved.

