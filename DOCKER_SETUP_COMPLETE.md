# Docker Compose Setup for ConnectWise-NRMM

## 🚀 Current Status

The project is now running with Docker Compose! Here's the setup:

### ✅ What's Running

1. **PostgreSQL 15** - Database container (port 5432) - ✅ Healthy
2. **Redis 7** - Cache container (port 6379) - ✅ Healthy  
3. **Backend** - Node.js application (port 3001) - ⚠️ Main server has issues, using test server
4. **Frontend** - React application (port 3000) - 🔄 Starting up

## 📋 Docker Compose Files

### 1. `docker-compose.dev.yml` (Development Setup)
- Uses node:18-alpine images directly
- Installs dependencies inside containers
- Runs development servers
- Hot reload enabled with volume mounts

### 2. `docker-compose.db.yml` (Database Only)
- Just PostgreSQL and Redis
- Useful for running backend/frontend locally

## 🔧 How to Use

### Start All Services
```bash
# Development mode (recommended)
docker compose -f docker-compose.dev.yml up -d

# Production mode (builds Dockerfiles)
docker compose up -d
```

### Check Status
```bash
# View all containers
docker ps

# Check logs
docker logs rmm-backend -f
docker logs rmm-frontend -f
docker logs rmm-postgres
docker logs rmm-redis
```

### Stop Services
```bash
# Stop containers
docker compose -f docker-compose.dev.yml down

# Stop and remove data
docker compose -f docker-compose.dev.yml down -v
```

## 🔍 Known Issues & Solutions

### Backend Issue
The main backend server (`src/index.ts`) hangs during initialization. This appears to be related to the module loading sequence.

**Workaround**: Use the test server instead:
```bash
docker exec -it rmm-backend sh
pkill node
npx ts-node src/test-server.ts
```

### Frontend Startup Time
The frontend takes several minutes to start because it:
1. Installs all dependencies
2. Compiles TypeScript
3. Starts webpack dev server

**Solution**: Be patient, it will start after 3-5 minutes.

## 🌐 Access Points

Once everything is running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📝 Default Credentials

**Admin User**:
- Email: `admin@rmm-platform.com`
- Password: `ChangeMe123!`

**Database**:
- User: `rmm_user`
- Password: `rmm_password`
- Database: `rmm_platform`

## 🛠️ Troubleshooting

### Check if services are ready
```bash
# Backend health check
curl http://localhost:3001/health

# Frontend check
curl -I http://localhost:3000

# Database check
docker exec rmm-postgres pg_isready

# Redis check
docker exec rmm-redis redis-cli ping
```

### Restart a specific service
```bash
docker restart rmm-backend
docker restart rmm-frontend
```

### Execute commands inside containers
```bash
# Backend shell
docker exec -it rmm-backend sh

# Run migrations manually
docker exec rmm-backend npm run migrate

# Create admin user
docker exec rmm-backend npm run seed:minimal
```

## 📊 Monitoring

### Real-time logs
```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker logs -f rmm-backend --tail 100
```

### Resource usage
```bash
docker stats
```

## 🔄 Development Workflow

1. **Make code changes** - Files are mounted as volumes
2. **Backend** - Nodemon will auto-restart on changes
3. **Frontend** - React dev server will hot-reload
4. **Database changes** - Run migrations:
   ```bash
   docker exec rmm-backend npm run migrate
   ```

## 🚢 Production Deployment

For production, use the main `docker-compose.yml` which:
- Builds optimized Docker images
- Uses nginx for frontend
- Includes health checks
- Has proper security settings

```bash
# Build and start production
docker compose build
docker compose up -d
```

## 📚 File Structure

```
ConnectWise-NRMM/
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development setup
├── docker-compose.db.yml       # Database only
├── backend/
│   ├── Dockerfile             # Backend production image
│   └── src/
│       ├── index.ts          # Main server (has issues)
│       └── test-server.ts    # Simplified server (works)
└── frontend/
    ├── Dockerfile             # Frontend production image
    └── src/
        └── App.tsx           # Main React app
```

## ✨ Next Steps

1. **Fix the main backend server** - Debug why `index.ts` hangs
2. **Configure external APIs** - Add ConnectWise and N-able credentials
3. **Set up SSL/TLS** - For production use
4. **Configure email** - For notifications
5. **Set up monitoring** - Add Prometheus/Grafana

---

**Status**: The project is running in Docker containers. Frontend may take a few more minutes to be fully ready.
**Updated**: October 29, 2025
