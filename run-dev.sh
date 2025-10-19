#!/bin/bash

# Bash script to run both backend and frontend in development mode

echo -e "\033[32mStarting ConnectWise-Nable RMM Integration Platform...\033[0m"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "\033[31mError: Node.js is not installed!\033[0m"
    echo -e "\033[33mPlease install Node.js from https://nodejs.org/\033[0m"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "\033[36mNode.js version: $NODE_VERSION\033[0m"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "\033[33mWarning: .env file not found!\033[0m"
    echo -e "\033[33mRunning setup script to create .env file...\033[0m"
    ./setup-env.sh
fi

echo ""
echo -e "\033[32mStarting Backend Server...\033[0m"
echo "----------------------------------------"

# Start backend in background
(cd backend && npm run dev) &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

echo -e "\033[32mStarting Frontend Server...\033[0m"
echo "----------------------------------------"

# Start frontend in background
(cd frontend && npm start) &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo -e "\033[32m============================================\033[0m"
echo -e "\033[32mBoth servers are starting!\033[0m"
echo ""
echo -e "\033[36mAccess the application at:\033[0m"
echo -e "\033[33m  Frontend: http://localhost:3000\033[0m"
echo -e "\033[33m  Backend API: http://localhost:3001\033[0m"
echo -e "\033[33m  API Health: http://localhost:3001/health\033[0m"
echo ""
echo -e "\033[90mPress Ctrl+C to stop both servers\033[0m"
echo -e "\033[32m============================================\033[0m"

# Function to handle cleanup
cleanup() {
    echo ""
    echo -e "\033[33mStopping servers...\033[0m"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "\033[32mServers stopped.\033[0m"
    exit 0
}

# Set up trap to catch Ctrl+C
trap cleanup INT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID


