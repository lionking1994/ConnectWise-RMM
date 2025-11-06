# Docker Setup Guide for RMM Integration Platform

## Prerequisites
- Docker Desktop installed and running
- Git
- At least 4GB of free RAM
- Ports 3000, 3001, and 5432 available

## Quick Start

### 1. Clone and Setup Environment
```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd ConnectWise-NRMM

# Copy environment template
cp env.example .env

# Edit .env with your API credentials
# Required: ConnectWise and N-able API keys
```

### 2. Start Development Environment

#### Windows (PowerShell):
```powershell
.\start-dev.ps1
```

#### Linux/Mac:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

#### Manual Docker Compose:
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## First Time Setup

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Wait for database initialization** (about 30 seconds)

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

4. **Login with default credentials:**
   - Username: `admin`
   - Password: `ChangeMe123!`
   - ⚠️ **IMPORTANT:** Change this password immediately!

## Database Management

### Run Migrations
```bash
docker-compose exec backend npm run migrate
```

### Seed Database (Development)
```bash
# Minimal seed (just admin user)
docker-compose exec backend npm run seed:minimal

# Full development seed (sample data)
docker-compose exec backend npm run seed

# Add API credentials
docker-compose exec backend npm run seed:credentials
```

### Access PostgreSQL
```bash
docker-compose exec postgres psql -U rmm_user -d rmm_platform
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors
```bash
# Ensure database is healthy
docker-compose ps

# Recreate database
docker-compose down -v  # Warning: This deletes all data!
docker-compose up -d
```

### Port conflicts
If ports are already in use, modify the ports in `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "3002:3001"  # Change 3002 to any available port
  frontend:
    ports:
      - "3003:3000"  # Change 3003 to any available port
```

## Production Deployment

### 1. Prepare Production Environment
```bash
# Copy and edit production environment file
cp env.example .env.prod
# Edit .env.prod with production credentials

# Use production docker-compose
docker-compose -f docker-compose.prod.yml up -d
```

### 2. SSL Configuration
Create `nginx.conf` for SSL:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://frontend:3000;
    }
    
    location /api {
        proxy_pass http://backend:3001;
    }
}
```

### 3. Backup Strategy
```bash
# Backup database
docker-compose exec postgres pg_dump -U rmm_user rmm_platform > backup.sql

# Restore database
docker-compose exec -T postgres psql -U rmm_user rmm_platform < backup.sql
```

## Environment Variables

### Required Variables
- `CONNECTWISE_API_URL` - ConnectWise API endpoint
- `CONNECTWISE_COMPANY_ID` - Your company ID
- `CONNECTWISE_PUBLIC_KEY` - API public key
- `CONNECTWISE_PRIVATE_KEY` - API private key
- `NABLE_API_URL` - N-able API endpoint
- `NABLE_API_KEY` - N-able API key
- `MS_TEAMS_WEBHOOK_URL` - Teams webhook for notifications

### Optional Variables
- `SMTP_HOST` - Email server
- `SMTP_PORT` - Email port
- `SMTP_USER` - Email username
- `SMTP_PASS` - Email password

## Development Tips

### Watch Backend Logs
```bash
docker-compose logs -f backend
```

### Restart Single Service
```bash
docker-compose restart backend
```

### Execute Commands in Container
```bash
# Run TypeScript file
docker-compose exec backend npx ts-node src/test-file.ts

# Install new package
docker-compose exec backend npm install package-name
```

### Reset Everything
```bash
# Stop and remove everything (including data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Wait 30s for DB to initialize, check `docker-compose logs postgres` |
| "Port already in use" | Change ports in docker-compose.yml or stop conflicting service |
| "Module not found" | Run `docker-compose exec backend npm install` |
| "Permission denied" | On Linux/Mac, run `chmod +x start-dev.sh` |
| "Space issues" | Run `docker system prune -a` to clean up Docker |

## Support

For issues specific to Docker setup:
1. Check container logs: `docker-compose logs [service-name]`
2. Verify environment variables in `.env`
3. Ensure all required ports are free
4. Check Docker Desktop resources (minimum 4GB RAM recommended)
