# 🚀 Docker Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- 4GB RAM available
- Ports 3000, 3001, and 5432 free

## 1. Quick Setup (5 minutes)

### Step 1: Clone & Configure
```bash
# Clone repository
git clone <your-repo-url>
cd ConnectWise-NRMM

# Create environment file
cp env.example .env
```

### Step 2: Edit .env file
Add your API credentials:
```env
# Required for production
CONNECTWISE_COMPANY_ID=YOUR_COMPANY
CONNECTWISE_PUBLIC_KEY=YOUR_KEY
CONNECTWISE_PRIVATE_KEY=YOUR_KEY
NABLE_API_KEY=YOUR_KEY
MS_TEAMS_WEBHOOK_URL=YOUR_WEBHOOK

# For testing, you can leave defaults
```

### Step 3: Start Everything
```bash
# Start all services
docker-compose up -d

# Watch the logs
docker-compose logs -f
```

### Step 4: Access Application
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Login: `admin` / `ChangeMe123!`

## 2. What Gets Created

### Database Tables (Automatic)
✅ users - User management
✅ tickets - Ticket tracking
✅ scripts - Remediation scripts
✅ script_executions - Script run history
✅ alert_script_mappings - Alert to script rules
✅ board_configurations - ConnectWise boards
✅ escalation_chains - Escalation rules
✅ automation_rules - Automation workflows
✅ notifications - Alert notifications
✅ api_credentials - API key storage
✅ webhook_events - Webhook history
✅ audit_logs - Activity tracking

### Sample Data (Automatic)
- 3 users (admin, tech1, viewer)
- 5 remediation scripts:
  - Disk Cleanup
  - Service Restart
  - System Health Check
  - Network Reset
  - Windows Update
- 2 alert mappings
- 1 NOC board configuration
- 1 escalation chain

## 3. Common Commands

### Container Management
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a service
docker-compose restart backend

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Database Commands
```bash
# Run migrations (creates tables)
docker-compose exec backend npm run migrate

# Seed database
docker-compose exec backend npm run seed

# Access PostgreSQL
docker-compose exec postgres psql -U rmm_user -d rmm_platform
```

### Troubleshooting
```bash
# Reset everything (WARNING: Deletes data!)
docker-compose down -v
docker-compose up -d

# Rebuild after code changes
docker-compose build backend
docker-compose up -d backend

# Check container status
docker-compose ps
```

## 4. Quick Verification

### Check if everything is running:
```bash
docker-compose ps
```

You should see:
```
NAME                STATUS
rmm-postgres        Up (healthy)
rmm-backend         Up
rmm-frontend        Up
```

### Check database tables:
```bash
docker-compose exec postgres psql -U rmm_user -d rmm_platform -c "\dt"
```

### Test the API:
```bash
curl http://localhost:3001/health
```

## 5. Next Steps

1. **Configure API Keys**
   - Add real ConnectWise credentials to .env
   - Add real N-able credentials to .env
   - Configure Teams webhook URL

2. **Set Up Alert Mappings**
   - Login to http://localhost:3000
   - Go to Alert Management
   - Create mappings for your alerts

3. **Add Custom Scripts**
   - Go to Script Manager
   - Add your remediation scripts
   - Test execution

4. **Configure Boards**
   - Go to Board Management
   - Add your ConnectWise boards
   - Set NOC as primary

## 6. Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Enable SSL (add nginx.conf)
# Set NODE_ENV=production
# Use strong passwords
# Enable backups
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "relation does not exist" | Run `docker-compose exec backend npm run migrate` |
| Port already in use | Change port in docker-compose.yml |
| Cannot connect to database | Wait 30 seconds for PostgreSQL to start |
| Module not found | Run `docker-compose build --no-cache backend` |

## Support Files

- `docker-compose.yml` - Development configuration
- `docker-compose.prod.yml` - Production configuration  
- `env.example` - Environment template
- `backend/src/database/seed.ts` - Sample data
- `backend/src/database/migrate.ts` - Database setup
