# PowerShell script to run both backend and frontend in development mode

Write-Host "Starting ConnectWise-Nable RMM Integration Platform..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "Error: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Running setup script to create .env file..." -ForegroundColor Yellow
    .\setup-env.ps1
}

Write-Host ""
Write-Host "Starting Backend Server..." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray

# Start backend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; Write-Host 'Backend Server' -ForegroundColor Cyan; Write-Host 'Running on http://localhost:3001' -ForegroundColor Yellow; npm run dev"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

Write-Host "Starting Frontend Server..." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray

# Start frontend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host 'Frontend Server' -ForegroundColor Cyan; Write-Host 'Running on http://localhost:3000' -ForegroundColor Yellow; npm start"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Backend API: http://localhost:3001" -ForegroundColor Yellow
Write-Host "  API Health: http://localhost:3001/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop the servers, close the PowerShell windows" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Green


