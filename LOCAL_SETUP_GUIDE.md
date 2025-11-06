# ConnectWise-NRMM Local Development Setup Guide

## 📋 Overview
This guide explains how to run the ConnectWise-NRMM project with:
- ✅ **Databases** (PostgreSQL & Redis) running in **Docker containers**
- ✅ **Backend** running **locally** with Node.js
- ✅ **Frontend** running **locally** with React

## 🔧 Prerequisites

1. **Docker & Docker Compose** - For running database containers
2. **Node.js 18+** - For running backend and frontend locally
3. **NVM (Node Version Manager)** - If using NVM to manage Node.js versions

## 🚀 Quick Start

### Step 1: Clone and Setup Environment

```bash
# Clone the repository (if not already done)
cd /home/ubuntu/Downloads/ConnectWise-NRMM

# Copy environment configuration
cp env.example .env

# Create symlink for backend to access .env
cd backend
ln -sf ../.env .env
cd ..
```

### Step 2: Start Database Containers

```bash
# Create a database-only docker compose file if not exists
cat > docker-compose.db.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: rmm-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-rmm_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-rmm_password}
      POSTGRES_DB: ${DB_NAME:-rmm_platform}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/src/database/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-rmm_user} -d ${DB_NAME:-rmm_platform}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: rmm-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
EOF

# Start database containers
docker compose -f docker-compose.db.yml up -d

# Wait for databases to be ready
sleep 10

# Verify databases are running
docker ps | grep -E "rmm-postgres|rmm-redis"
```

### Step 3: Setup Backend

```bash
cd backend

# If using NVM, load it first
source ~/.nvm/nvm.sh

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed initial data (creates admin user)
npm run seed:minimal
```

**Default Admin Credentials:**
- Email: `admin@rmm-platform.com`
- Password: `ChangeMe123!`
- ⚠️ **IMPORTANT:** Change this password after first login!

### Step 4: Start Backend Server

```bash
# In the backend directory
cd backend
source ~/.nvm/nvm.sh

# Option 1: Run with nodemon (auto-restart on changes)
npm run dev

# Option 2: If the main server has issues, use the test server
npx ts-node src/test-server.ts

# Option 3: Run the compiled JavaScript
npm run build
npm start
```

The backend will be available at: **http://localhost:3001**

### Step 5: Setup and Start Frontend

Open a new terminal:

```bash
cd frontend

# If using NVM
source ~/.nvm/nvm.sh

# Install dependencies (use legacy-peer-deps if needed)
npm install --legacy-peer-deps

# Start the development server
npm run build

npx serve -s build

# If port 3000 is busy, it will use 3002 or prompt for another port
```

The frontend will be available at: **http://localhost:3000** (or **http://localhost:3002**)

## 🔍 Verification

### Check All Services

```bash
# Check backend health
curl http://localhost:3001/health

# Check frontend (should return HTML)
curl -s http://localhost:3000 | head -5

# Check database connection
docker exec rmm-postgres pg_isready -U rmm_user -d rmm_platform

# Check Redis
docker exec rmm-redis redis-cli ping
```

### Expected Response from Backend Health Check
```json
{
  "status": "healthy",
  "timestamp": "2025-10-29T10:00:00.000Z",
  "uptime": 123
}
```

## 🛠️ Troubleshooting

### Backend Issues

#### Problem: Backend hangs during startup
```bash
# The backend might hang at "AppDataSource loaded"
# Solution: Kill the process and try the test server instead
pkill -f "nodemon.*index.ts"
cd backend
npx ts-node src/test-server.ts
```

#### Problem: Database connection errors
```bash
# Check if .env file exists in backend directory
ls -la backend/.env

# Verify database is running
docker ps | grep postgres

# Test database connection manually
docker exec -it rmm-postgres psql -U rmm_user -d rmm_platform -c "SELECT 1;"
```

#### Problem: Port 3001 already in use
```bash
# Find what's using the port
lsof -i :3001

# Kill the process if needed
kill -9 <PID>
```

### Frontend Issues

#### Problem: Dependency conflicts
```bash
# Use legacy peer deps
npm install --legacy-peer-deps
```

#### Problem: Port 3000 already in use
```bash
# The React dev server will automatically use 3002
# Or you can specify a different port
PORT=3002 npm start
```

### Database Issues

#### Problem: PostgreSQL version mismatch
```bash
# Stop containers and remove volumes
docker compose -f docker-compose.db.yml down -v

# Start fresh
docker compose -f docker-compose.db.yml up -d
```

## 📁 Project Structure

```
ConnectWise-NRMM/
├── backend/
│   ├── src/
│   │   ├── index.ts         # Main backend entry point
│   │   ├── test-server.ts   # Simplified test server
│   │   ├── database/        # Database configurations
│   │   ├── entities/        # TypeORM entities
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── middleware/      # Express middleware
│   ├── package.json
│   └── .env (symlink)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   └── services/        # API services
│   └── package.json
├── docker-compose.db.yml     # Database-only Docker setup
├── docker-compose.yml        # Full Docker setup (not used)
└── .env                      # Environment variables
```

## 🔄 Daily Development Workflow

### Starting Services

```bash
# 1. Start databases
cd /home/ubuntu/Downloads/ConnectWise-NRMM
docker compose -f docker-compose.db.yml up -d

# 2. Start backend (new terminal)
cd backend
source ~/.nvm/nvm.sh
npm run dev

# 3. Start frontend (new terminal)
cd frontend
source ~/.nvm/nvm.sh
npm start
```

### Stopping Services

```bash
# Stop frontend: Ctrl+C in frontend terminal

# Stop backend: Ctrl+C in backend terminal

# Stop databases
docker compose -f docker-compose.db.yml down

# Stop databases and remove data
docker compose -f docker-compose.db.yml down -v
```

## 📊 Monitoring

### View Logs

```bash
# Backend logs
tail -f backend/logs/combined.log

# Docker container logs
docker logs -f rmm-postgres
docker logs -f rmm-redis

# Frontend logs are in the terminal where npm start is running
```

### Check Resource Usage

```bash
# Docker containers
docker stats

# Node.js processes
ps aux | grep node
```

## 🔐 Security Notes

1. **Change default passwords** immediately after setup
2. **Never commit .env files** to version control
3. **Use strong passwords** for database users
4. **Configure CORS properly** for production
5. **Enable SSL/TLS** for production deployments

## 📝 Environment Variables

Key environment variables in `.env`:

```env
# Database
DB_USER=rmm_user
DB_PASSWORD=rmm_password
DB_NAME=rmm_platform
DATABASE_URL=postgresql://rmm_user:rmm_password@localhost:5432/rmm_platform

# Application
NODE_ENV=development
BACKEND_PORT=3001
FRONTEND_PORT=3000
JWT_SECRET=your-secret-key-change-in-production

# API URLs
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001

# External APIs (configure as needed)
CONNECTWISE_API_URL=https://api-na.myconnectwise.net
NABLE_API_URL=https://api.narmm.com
```

## 🚢 Production Deployment

For production deployment:

1. Use proper process managers (PM2, systemd)
2. Set `NODE_ENV=production`
3. Use reverse proxy (nginx, Apache)
4. Enable SSL certificates
5. Use production database passwords
6. Configure firewall rules
7. Set up monitoring and logging

## 📚 Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🆘 Common Commands Reference

```bash
# Database
docker exec -it rmm-postgres psql -U rmm_user -d rmm_platform  # Access PostgreSQL
docker exec -it rmm-redis redis-cli                              # Access Redis

# Backend
npm run dev          # Start with nodemon
npm run build        # Compile TypeScript
npm run migrate      # Run database migrations
npm run seed:minimal # Seed initial data

# Frontend  
npm start            # Start development server
npm run build        # Create production build
npm test             # Run tests

# Docker
docker compose -f docker-compose.db.yml logs -f  # View logs
docker compose -f docker-compose.db.yml restart  # Restart containers
docker compose -f docker-compose.db.yml ps       # List containers
```

---

**Last Updated:** October 29, 2025  
**Version:** 1.0.0
