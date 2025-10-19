# 🚀 Quick Start Guide - ConnectWise & N-able RMM Integration

## Prerequisites
- Docker & Docker Compose installed
- ConnectWise PSA account with API access
- N-able RMM account with API credentials

## Step 1: Environment Setup

### Windows Users:
```powershell
# Run the setup script to create .env file
.\setup-env.ps1

# Edit the .env file with your credentials
notepad .env
```

### Linux/Mac Users:
```bash
# Run the setup script to create .env file
chmod +x setup-env.sh
./setup-env.sh

# Edit the .env file with your credentials
nano .env  # or vim .env
```

## Step 2: Update Required Credentials

Open `.env` file and update these critical settings:

### ConnectWise Credentials:
```env
CONNECTWISE_COMPANY_ID=your_actual_company_id
CONNECTWISE_PUBLIC_KEY=your_actual_public_key
CONNECTWISE_PRIVATE_KEY=your_actual_private_key
CONNECTWISE_CLIENT_ID=your_actual_client_id
```

### N-able RMM Credentials:
```env
NABLE_API_KEY=your_actual_api_key
NABLE_API_SECRET=your_actual_api_secret
```

### Security Settings (IMPORTANT):
```env
JWT_SECRET=generate_a_random_32_character_string_here
DB_PASSWORD=use_a_strong_password_for_production
```

## Step 3: Start the Application

### Development Mode:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Mode:
```bash
# Build and start for production
docker-compose -f docker-compose.prod.yml up -d --build
```

## Step 4: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health

## Step 5: Initial Setup

1. **Create Admin User** (first time only):
```bash
docker-compose exec backend npm run seed
```

2. **Default Login**:
   - Email: `admin@example.com`
   - Password: `admin123` (change immediately!)

## Step 6: Configure Integrations

### In ConnectWise:
1. Go to System → Setup Tables → Integrations
2. Create new API member
3. Copy the public/private keys to `.env`
4. Set up webhook callbacks to: `http://your-domain:3001/api/webhooks/connectwise`

### In N-able RMM:
1. Go to Administration → API Access
2. Generate API credentials
3. Copy to `.env` file
4. Configure webhook endpoint: `http://your-domain:3001/api/webhooks/nable`

## Step 7: Test the Integration

1. **Test ConnectWise Connection**:
```bash
curl http://localhost:3001/api/test/connectwise
```

2. **Test N-able Connection**:
```bash
curl http://localhost:3001/api/test/nable
```

3. **Send Test Notification**:
```bash
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"channel": "email", "recipient": "your-email@example.com"}'
```

## Common Issues & Solutions

### Issue: Cannot connect to database
**Solution**: Ensure Docker is running and ports 5432 (PostgreSQL) and 6379 (Redis) are not in use.

### Issue: API authentication fails
**Solution**: Double-check your API credentials in `.env` file. Ensure no extra spaces or quotes.

### Issue: Frontend cannot connect to backend
**Solution**: Check that both containers are running: `docker-compose ps`

### Issue: Webhooks not receiving
**Solution**: Ensure your server is accessible from the internet or use ngrok for testing.

## Next Steps

1. **Create Automation Rules**: Go to http://localhost:3000/automation
2. **Configure Notifications**: Settings → Notifications
3. **Add Team Members**: Settings → Users
4. **Set Up Monitoring**: View Analytics dashboard
5. **Review Audit Logs**: Check system activity

## Support

- Check logs: `docker-compose logs [service-name]`
- Database access: `docker-compose exec postgres psql -U rmm_user -d rmm_integration`
- Redis CLI: `docker-compose exec redis redis-cli`

## Security Checklist

- [ ] Changed default admin password
- [ ] Updated JWT_SECRET to random string
- [ ] Set strong DB_PASSWORD
- [ ] Configured SSL certificates (production)
- [ ] Set up firewall rules
- [ ] Enabled rate limiting
- [ ] Configured backup strategy

## Useful Commands

```bash
# View all running containers
docker-compose ps

# Restart a specific service
docker-compose restart backend

# Run database migrations
docker-compose exec backend npm run migrate

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Backup database
docker-compose exec postgres pg_dump -U rmm_user rmm_integration > backup.sql

# Restore database
docker-compose exec -T postgres psql -U rmm_user rmm_integration < backup.sql
```

## Ready to Go! 🎉

Your ConnectWise & N-able RMM Integration Platform is now ready. Start by creating your first automation rule and watch the magic happen!


