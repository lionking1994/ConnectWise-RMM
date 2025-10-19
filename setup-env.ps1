# PowerShell script to create .env file for ConnectWise-Nable RMM Integration

Write-Host "Creating .env file for ConnectWise-Nable RMM Integration..." -ForegroundColor Green

$envContent = @"
# Database Configuration
DB_PASSWORD=rmm_secure_pass_2024
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rmm_integration
DB_USER=rmm_user

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_change_this_in_production_2024
JWT_EXPIRY=7d

# ConnectWise API Configuration
CONNECTWISE_API_URL=https://api-na.myconnectwise.net/v4_6_release/apis/3.0
CONNECTWISE_COMPANY_ID=your_company_id
CONNECTWISE_PUBLIC_KEY=your_public_key
CONNECTWISE_PRIVATE_KEY=your_private_key
CONNECTWISE_CLIENT_ID=your_client_id
CONNECTWISE_WEBHOOK_SECRET=your_webhook_secret

# N-able RMM API Configuration
NABLE_API_URL=https://api.narmm.com/v1
NABLE_API_KEY=your_nable_api_key
NABLE_API_SECRET=your_nable_api_secret

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=RMM Integration <noreply@yourdomain.com>

# Slack Configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#rmm-alerts

# Microsoft Teams Configuration
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/YOUR/WEBHOOK/URL

# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
FRONTEND_API_URL=http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Webhook Configuration
WEBHOOK_SECRET=your_webhook_secret_key_2024
WEBHOOK_TIMEOUT=30000

# Automation Settings
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=5000
AUTOMATION_BATCH_SIZE=10
AUTOMATION_CONCURRENCY=5
SCRIPT_TIMEOUT_MS=300000
"@

# Write the content to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host ".env file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Please update the following in your .env file:" -ForegroundColor Yellow
Write-Host "1. ConnectWise API credentials (CONNECTWISE_*)" -ForegroundColor Yellow
Write-Host "2. N-able RMM API credentials (NABLE_*)" -ForegroundColor Yellow
Write-Host "3. SMTP settings for email notifications" -ForegroundColor Yellow
Write-Host "4. Slack/Teams webhook URLs if using those integrations" -ForegroundColor Yellow
Write-Host "5. Change JWT_SECRET to a secure random string" -ForegroundColor Yellow
Write-Host "6. Change DB_PASSWORD for production use" -ForegroundColor Yellow
Write-Host ""
Write-Host "To edit the file, run: notepad .env" -ForegroundColor Cyan


