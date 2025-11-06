# ConnectWise & N-able RMM Integration Platform

A **production-ready** automation platform that bridges ConnectWise PSA and N-able RMM, enabling automated ticket remediation, real-time monitoring, and intelligent workflow automation for Managed Service Providers (MSPs).

## 🎯 Project Status: READY FOR DEPLOYMENT

✅ **All core features implemented and tested**
✅ **Docker containerized for easy deployment**
✅ **API integrations complete (ConnectWise & N-able)**
✅ **Microsoft Teams & Email notifications working**
✅ **Script output capture and parsing implemented**
✅ **Production-ready with error handling & retry logic**

## 🚀 Features

### Core Functionality
- **Bi-directional Integration**: Seamless sync between ConnectWise tickets and N-able RMM alerts
- **Automated Remediation**: Execute predefined scripts based on alert conditions  
- **Script Output Bridge**: Captures and parses outputs from sfc /scannow, patches, disk cleanup, etc.
- **Intelligent Rules Engine**: Custom automation rules with condition-based triggers
- **Real-time Updates**: WebSocket-based live updates for tickets and automation status
- **Comprehensive Dashboard**: Analytics, metrics, and performance monitoring

### Key Components
- **Ticket Management**: Automatic creation, updates, and closure of tickets
- **Script Execution**: Run remediation scripts on remote devices with output capture
- **Notification System**: Microsoft Teams, Email, and future Slack support
- **Audit Logging**: Complete history of all actions and changes
- **Role-Based Access**: Admin, Technician, and Viewer roles
- **API Credential Management**: Secure storage and testing of API keys

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+
- ConnectWise PSA account with API access
- N-able RMM account with API credentials

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/connectwise-nable-integration.git
cd connectwise-nable-integration
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# ConnectWise Configuration
CONNECTWISE_API_URL=https://api-na.myconnectwise.net/v4_6_release/apis/3.0
CONNECTWISE_COMPANY_ID=your_company_id
CONNECTWISE_PUBLIC_KEY=your_public_key
CONNECTWISE_PRIVATE_KEY=your_private_key

# N-able Configuration
NABLE_API_URL=https://api.narmm.com/v1
NABLE_API_KEY=your_api_key
NABLE_API_SECRET=your_api_secret

# Database Configuration
DB_PASSWORD=secure_password_here
JWT_SECRET=your_jwt_secret_key
```

### 3. Start with Docker Compose
```bash
docker-compose up -d
```

### 4. Run Database Migrations
```bash
docker-compose exec backend npm run migrate
```

### 5. Create Admin User
```bash
docker-compose exec backend npm run seed
```

### 6. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api-docs

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript, Material-UI
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull (Redis-based)
- **Real-time**: Socket.IO
- **Container**: Docker

### Project Structure
```
├── backend/
│   ├── src/
│   │   ├── entities/       # Database entities
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utility functions
│   │   └── index.ts        # Entry point
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── contexts/       # React contexts
│   │   └── App.tsx         # Main app component
│   └── Dockerfile
└── docker-compose.yml
```

## 📖 Usage

### Creating Automation Rules

1. Navigate to **Automation** → **Rules**
2. Click **Create New Rule**
3. Define conditions:
   - Alert type matching
   - Severity levels
   - Device criteria
4. Configure actions:
   - Run scripts
   - Update tickets
   - Send notifications
5. Set execution parameters:
   - Retry attempts
   - Timeout settings
   - Continue on error

### Example Automation Rule
```json
{
  "name": "Auto-resolve disk space alerts",
  "conditions": {
    "all": [
      {"field": "alertType", "operator": "equals", "value": "DiskSpace"},
      {"field": "severity", "operator": "in", "value": ["Warning", "Error"]}
    ]
  },
  "actions": [
    {
      "type": "run_script",
      "parameters": {
        "scriptId": "DISK_CLEANUP",
        "parameters": {"threshold": 20}
      }
    },
    {
      "type": "update_ticket",
      "parameters": {
        "updates": {"status": "in_progress"}
      }
    }
  ]
}
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - User logout

### Tickets
- `GET /api/tickets` - List tickets
- `GET /api/tickets/:id` - Get ticket details
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id` - Update ticket
- `POST /api/tickets/:id/notes` - Add note

### Automation
- `GET /api/automation/rules` - List rules
- `POST /api/automation/rules` - Create rule
- `PUT /api/automation/rules/:id` - Update rule
- `POST /api/automation/execute/:ruleId` - Manual execution
- `GET /api/automation/history` - Execution history

### Analytics
- `GET /api/analytics/dashboard-stats` - Dashboard statistics
- `GET /api/analytics/ticket-trends` - Ticket trends
- `GET /api/analytics/automation-metrics` - Automation metrics

## 🔒 Security

- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- Input validation and sanitization
- Encrypted credentials storage
- Audit logging for compliance

## 🧪 Testing

### Quick Test Commands

#### Test API Connections
```bash
cd backend
npm run test:apis
```

#### Test Full Workflow
```bash
cd backend
npm run test:workflow
```

#### Run All Integration Tests
```bash
cd backend
npm run test:integration
```

### Manual Testing

#### Test ConnectWise Connection
```bash
curl -X POST http://localhost:3001/api/settings/test-connection/connectwise \
  -H "Content-Type: application/json" \
  -d '{"url": "YOUR_URL", "companyId": "YOUR_ID", "publicKey": "YOUR_KEY", "privateKey": "YOUR_SECRET", "clientId": "YOUR_CLIENT_ID"}'
```

#### Test N-able Connection
```bash
curl -X POST http://localhost:3001/api/settings/test-connection/nable \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.systemmonitor.us", "accessKey": "YOUR_API_KEY"}'
```

#### Simulate Alert Webhook
```bash
curl -X POST http://localhost:3001/api/webhooks/nable \
  -H "Content-Type: application/json" \
  -d '{"alertType": "DISK_SPACE_LOW", "deviceId": "TEST-001", "severity": "HIGH", "cwTicketNumber": "T20240101-0001"}'
```

### Test Documentation
- **[Complete Testing Guide](TESTING_GUIDE.md)** - Detailed workflow testing instructions
- **[test-full-workflow.sh](test-full-workflow.sh)** - Automated workflow test script
- **[test-api-connections.js](test-api-connections.js)** - API connection test suite

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Metrics Endpoint
```bash
curl http://localhost:3001/metrics
```

### Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 🚀 Deployment

### Production Deployment
1. Update environment variables for production
2. Build Docker images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```
3. Deploy to your container orchestration platform (Kubernetes, ECS, etc.)

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use strong passwords and secrets
- Configure SSL/TLS certificates
- Set up proper backup strategies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in GitHub
- Contact: support@yourcompany.com
- Documentation: https://docs.yourcompany.com

## 🔄 Changelog

### Version 1.0.0 (2024-10-16)
- Initial release
- ConnectWise PSA integration
- N-able RMM integration
- Automation rules engine
- Real-time dashboard
- Multi-channel notifications

## 🙏 Acknowledgments

- ConnectWise for their comprehensive API
- N-able for RMM capabilities
- The open-source community for amazing tools and libraries



5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in GitHub
- Contact: support@yourcompany.com
- Documentation: https://docs.yourcompany.com

## 🔄 Changelog

### Version 1.0.0 (2024-10-16)
- Initial release
- ConnectWise PSA integration
- N-able RMM integration
- Automation rules engine
- Real-time dashboard
- Multi-channel notifications

## 🙏 Acknowledgments

- ConnectWise for their comprehensive API
- N-able for RMM capabilities
- The open-source community for amazing tools and libraries


