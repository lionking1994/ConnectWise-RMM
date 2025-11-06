# ✅ Production Deployment Checklist
## ConnectWise & N-able RMM Integration Platform

---

## 📋 Pre-Deployment Requirements

### 1. API Credentials ⚠️ **REQUIRED**
- [ ] ConnectWise API credentials obtained
  - [ ] Company ID
  - [ ] Public Key  
  - [ ] Private Key
  - [ ] Client ID
- [ ] N-able RMM API credentials obtained
  - [ ] API Key
  - [ ] API Secret
  - [ ] Partner Name (if using N-sight)
- [ ] Microsoft Teams webhook URL created
  - [ ] Incoming webhook configured in Teams channel
  - [ ] Webhook URL copied

### 2. Environment Setup
- [ ] Docker and Docker Compose installed on server
- [ ] PostgreSQL 15+ available (or use Docker container)
- [ ] Minimum 4GB RAM allocated
- [ ] Port 3000 (frontend) and 3001 (backend) available
- [ ] SSL certificates ready (for production)

---

## 🚀 Deployment Steps

### Step 1: Clone and Configure
```bash
# Clone the repository
git clone [repository-url]
cd ConnectWise-NRMM

# Copy environment template
cp env.example .env

# Edit .env file with your credentials
nano .env
```

### Step 2: Configure Critical Settings
Edit `.env` file and update these REQUIRED fields:
```env
# CRITICAL - Prevents duplicate tickets
PREVENT_DUPLICATE_TICKETS=true
UPDATE_ONLY_MODE=false  # Set to true if N-able creates CW tickets
CREATE_NEW_CW_TICKETS=false  # Set to false if using N-able's built-in

# ConnectWise Settings
CONNECTWISE_COMPANY_ID=YOUR_ACTUAL_COMPANY_ID
CONNECTWISE_PUBLIC_KEY=YOUR_ACTUAL_PUBLIC_KEY
CONNECTWISE_PRIVATE_KEY=YOUR_ACTUAL_PRIVATE_KEY
CW_DEFAULT_BOARD_NAME=Network Operations Center
CW_DEFAULT_BOARD_ID=YOUR_NOC_BOARD_ID  # Get from ConnectWise

# N-able Settings
NABLE_API_KEY=YOUR_ACTUAL_API_KEY
NABLE_API_SECRET=YOUR_ACTUAL_API_SECRET

# Teams Integration
MS_TEAMS_WEBHOOK_URL=YOUR_TEAMS_WEBHOOK_URL
```

### Step 3: Deploy with Docker
```bash
# Build and start containers
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Initialize Database
```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Create admin user
docker-compose exec backend npm run seed

# Default admin credentials will be displayed
# SAVE THESE CREDENTIALS!
```

### Step 5: Configure N-able Webhook
1. Log into N-able dashboard
2. Navigate to **Administration** → **Integrations** → **Webhooks**
3. Add new webhook:
   - **Name**: RMM Platform Integration
   - **URL**: `http://YOUR_SERVER_IP:3001/api/webhook/nable`
   - **Method**: POST
   - **Format**: JSON
   - **Events**: Select all alert types:
     - ✅ Disk Space Low
     - ✅ Service Stopped
     - ✅ CPU High
     - ✅ Memory High
     - ✅ Device Offline
     - ✅ Patch Required
4. Test webhook and save

### Step 6: Access and Test
1. Open browser to `http://YOUR_SERVER_IP:3000`
2. Login with admin credentials
3. Navigate to **Settings** → **API Credentials**
4. Test connections:
   - [ ] ConnectWise API Test → Should show "Connected"
   - [ ] N-able API Test → Should show "Connected"
   - [ ] Teams Test → Should send test message

---

## 🔧 Post-Deployment Configuration

### 1. Board Setup
- [ ] Go to **Board Management**
- [ ] Click "Sync from ConnectWise"
- [ ] Verify "Network Operations Center" is set as primary
- [ ] Enable monitoring for additional boards if needed

### 2. Automation Rules
- [ ] Navigate to **Automation** → **Rules**
- [ ] Review default rules:
  - Disk Space → Cleanup Script
  - Service Down → Restart Service
  - High CPU → Performance Optimization
- [ ] Adjust thresholds as needed
- [ ] Enable rules one by one

### 3. Script Templates
- [ ] Go to **Scripts** → **Templates**
- [ ] Import MSP script library
- [ ] Test each script in non-production first:
  ```powershell
  # Test mode (no changes)
  .\cleanup-disk.ps1 -WhatIf
  ```

### 4. Teams Commands Setup
- [ ] In Teams channel, test commands:
  ```
  /ticket 12345
  /note 12345 "Test note"
  /close 12345 "Test closure"
  ```
- [ ] Verify notes sync to ConnectWise

### 5. User Management
- [ ] Create technician accounts
- [ ] Assign appropriate roles:
  - Admin: Full system access
  - Technician: Ticket and automation access
  - Viewer: Read-only access
- [ ] Share Teams commands guide with team

---

## 🧪 Validation Tests

### Test 1: Ticket Sync
- [ ] Create test ticket in ConnectWise
- [ ] Verify it appears in platform within 5 minutes
- [ ] Add note in platform
- [ ] Confirm note appears in ConnectWise

### Test 2: Alert Processing
- [ ] Trigger test alert in N-able (non-critical)
- [ ] Verify ticket updates (not duplicates)
- [ ] Check automation rule triggers
- [ ] Confirm Teams notification received

### Test 3: Script Execution
- [ ] Select test device
- [ ] Run "disk cleanup" script
- [ ] Verify output captured
- [ ] Check ticket updated with results

### Test 4: Teams Integration
- [ ] Send test command: `/ticket TEST-001`
- [ ] Add note via Teams
- [ ] Verify bi-directional sync

---

## 🔒 Security Checklist

- [ ] Change default admin password
- [ ] Update JWT_SECRET in .env
- [ ] Configure firewall rules:
  ```bash
  # Allow only necessary ports
  ufw allow 3000/tcp  # Frontend
  ufw allow 3001/tcp  # Backend API
  ```
- [ ] Enable SSL/TLS (use reverse proxy)
- [ ] Set up backup schedule
- [ ] Configure log rotation

---

## 📊 Monitoring Setup

### Health Checks
```bash
# API Health
curl http://localhost:3001/health

# Database Connection
docker-compose exec backend npm run db:test

# Service Status
docker-compose ps
```

### Log Monitoring
```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres
```

### Metrics Dashboard
- Access at: `http://localhost:3000/admin/metrics`
- Monitor:
  - [ ] Ticket processing rate
  - [ ] Script success rate
  - [ ] API response times
  - [ ] Error rates

---

## 🚨 Troubleshooting

### Issue: Duplicate Tickets
**Solution**: Set `UPDATE_ONLY_MODE=true` in .env

### Issue: Scripts Not Executing
**Solution**: Check N-able API permissions include script execution

### Issue: Teams Commands Not Working
**Solution**: Verify webhook URL and bot permissions

### Issue: Tickets Not Syncing
**Solution**: Check board IDs match between CW and platform

---

## 📞 Support Contacts

- **Technical Issues**: Check logs first, then contact support
- **API Questions**: Refer to vendor documentation
- **Platform Support**: Create issue in GitHub repository

---

## ✅ Final Verification

- [ ] All API connections green
- [ ] Test ticket created and processed
- [ ] Automation rules active
- [ ] Teams integration working
- [ ] Users created and trained
- [ ] Backup configured
- [ ] Monitoring active

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: 1.0.0
**Status**: ⬜ Testing | ⬜ Production

---

## 📝 Notes

_Add any deployment-specific notes here:_

_______________________________________________
_______________________________________________
_______________________________________________

## ConnectWise & N-able RMM Integration Platform

---

## 📋 Pre-Deployment Requirements

### 1. API Credentials ⚠️ **REQUIRED**
- [ ] ConnectWise API credentials obtained
  - [ ] Company ID
  - [ ] Public Key  
  - [ ] Private Key
  - [ ] Client ID
- [ ] N-able RMM API credentials obtained
  - [ ] API Key
  - [ ] API Secret
  - [ ] Partner Name (if using N-sight)
- [ ] Microsoft Teams webhook URL created
  - [ ] Incoming webhook configured in Teams channel
  - [ ] Webhook URL copied

### 2. Environment Setup
- [ ] Docker and Docker Compose installed on server
- [ ] PostgreSQL 15+ available (or use Docker container)
- [ ] Minimum 4GB RAM allocated
- [ ] Port 3000 (frontend) and 3001 (backend) available
- [ ] SSL certificates ready (for production)

---

## 🚀 Deployment Steps

### Step 1: Clone and Configure
```bash
# Clone the repository
git clone [repository-url]
cd ConnectWise-NRMM

# Copy environment template
cp env.example .env

# Edit .env file with your credentials
nano .env
```

### Step 2: Configure Critical Settings
Edit `.env` file and update these REQUIRED fields:
```env
# CRITICAL - Prevents duplicate tickets
PREVENT_DUPLICATE_TICKETS=true
UPDATE_ONLY_MODE=false  # Set to true if N-able creates CW tickets
CREATE_NEW_CW_TICKETS=false  # Set to false if using N-able's built-in

# ConnectWise Settings
CONNECTWISE_COMPANY_ID=YOUR_ACTUAL_COMPANY_ID
CONNECTWISE_PUBLIC_KEY=YOUR_ACTUAL_PUBLIC_KEY
CONNECTWISE_PRIVATE_KEY=YOUR_ACTUAL_PRIVATE_KEY
CW_DEFAULT_BOARD_NAME=Network Operations Center
CW_DEFAULT_BOARD_ID=YOUR_NOC_BOARD_ID  # Get from ConnectWise

# N-able Settings
NABLE_API_KEY=YOUR_ACTUAL_API_KEY
NABLE_API_SECRET=YOUR_ACTUAL_API_SECRET

# Teams Integration
MS_TEAMS_WEBHOOK_URL=YOUR_TEAMS_WEBHOOK_URL
```

### Step 3: Deploy with Docker
```bash
# Build and start containers
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Initialize Database
```bash
# Run database migrations
docker-compose exec backend npm run migrate

# Create admin user
docker-compose exec backend npm run seed

# Default admin credentials will be displayed
# SAVE THESE CREDENTIALS!
```

### Step 5: Configure N-able Webhook
1. Log into N-able dashboard
2. Navigate to **Administration** → **Integrations** → **Webhooks**
3. Add new webhook:
   - **Name**: RMM Platform Integration
   - **URL**: `http://YOUR_SERVER_IP:3001/api/webhook/nable`
   - **Method**: POST
   - **Format**: JSON
   - **Events**: Select all alert types:
     - ✅ Disk Space Low
     - ✅ Service Stopped
     - ✅ CPU High
     - ✅ Memory High
     - ✅ Device Offline
     - ✅ Patch Required
4. Test webhook and save

### Step 6: Access and Test
1. Open browser to `http://YOUR_SERVER_IP:3000`
2. Login with admin credentials
3. Navigate to **Settings** → **API Credentials**
4. Test connections:
   - [ ] ConnectWise API Test → Should show "Connected"
   - [ ] N-able API Test → Should show "Connected"
   - [ ] Teams Test → Should send test message

---

## 🔧 Post-Deployment Configuration

### 1. Board Setup
- [ ] Go to **Board Management**
- [ ] Click "Sync from ConnectWise"
- [ ] Verify "Network Operations Center" is set as primary
- [ ] Enable monitoring for additional boards if needed

### 2. Automation Rules
- [ ] Navigate to **Automation** → **Rules**
- [ ] Review default rules:
  - Disk Space → Cleanup Script
  - Service Down → Restart Service
  - High CPU → Performance Optimization
- [ ] Adjust thresholds as needed
- [ ] Enable rules one by one

### 3. Script Templates
- [ ] Go to **Scripts** → **Templates**
- [ ] Import MSP script library
- [ ] Test each script in non-production first:
  ```powershell
  # Test mode (no changes)
  .\cleanup-disk.ps1 -WhatIf
  ```

### 4. Teams Commands Setup
- [ ] In Teams channel, test commands:
  ```
  /ticket 12345
  /note 12345 "Test note"
  /close 12345 "Test closure"
  ```
- [ ] Verify notes sync to ConnectWise

### 5. User Management
- [ ] Create technician accounts
- [ ] Assign appropriate roles:
  - Admin: Full system access
  - Technician: Ticket and automation access
  - Viewer: Read-only access
- [ ] Share Teams commands guide with team

---

## 🧪 Validation Tests

### Test 1: Ticket Sync
- [ ] Create test ticket in ConnectWise
- [ ] Verify it appears in platform within 5 minutes
- [ ] Add note in platform
- [ ] Confirm note appears in ConnectWise

### Test 2: Alert Processing
- [ ] Trigger test alert in N-able (non-critical)
- [ ] Verify ticket updates (not duplicates)
- [ ] Check automation rule triggers
- [ ] Confirm Teams notification received

### Test 3: Script Execution
- [ ] Select test device
- [ ] Run "disk cleanup" script
- [ ] Verify output captured
- [ ] Check ticket updated with results

### Test 4: Teams Integration
- [ ] Send test command: `/ticket TEST-001`
- [ ] Add note via Teams
- [ ] Verify bi-directional sync

---

## 🔒 Security Checklist

- [ ] Change default admin password
- [ ] Update JWT_SECRET in .env
- [ ] Configure firewall rules:
  ```bash
  # Allow only necessary ports
  ufw allow 3000/tcp  # Frontend
  ufw allow 3001/tcp  # Backend API
  ```
- [ ] Enable SSL/TLS (use reverse proxy)
- [ ] Set up backup schedule
- [ ] Configure log rotation

---

## 📊 Monitoring Setup

### Health Checks
```bash
# API Health
curl http://localhost:3001/health

# Database Connection
docker-compose exec backend npm run db:test

# Service Status
docker-compose ps
```

### Log Monitoring
```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres
```

### Metrics Dashboard
- Access at: `http://localhost:3000/admin/metrics`
- Monitor:
  - [ ] Ticket processing rate
  - [ ] Script success rate
  - [ ] API response times
  - [ ] Error rates

---

## 🚨 Troubleshooting

### Issue: Duplicate Tickets
**Solution**: Set `UPDATE_ONLY_MODE=true` in .env

### Issue: Scripts Not Executing
**Solution**: Check N-able API permissions include script execution

### Issue: Teams Commands Not Working
**Solution**: Verify webhook URL and bot permissions

### Issue: Tickets Not Syncing
**Solution**: Check board IDs match between CW and platform

---

## 📞 Support Contacts

- **Technical Issues**: Check logs first, then contact support
- **API Questions**: Refer to vendor documentation
- **Platform Support**: Create issue in GitHub repository

---

## ✅ Final Verification

- [ ] All API connections green
- [ ] Test ticket created and processed
- [ ] Automation rules active
- [ ] Teams integration working
- [ ] Users created and trained
- [ ] Backup configured
- [ ] Monitoring active

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: 1.0.0
**Status**: ⬜ Testing | ⬜ Production

---

## 📝 Notes

_Add any deployment-specific notes here:_

_______________________________________________
_______________________________________________
_______________________________________________

