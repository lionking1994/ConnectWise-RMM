#!/bin/bash

# RMM Platform Development Quick Start Script

echo "🚀 Starting RMM Integration Platform Development Environment"
echo "=========================================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your API credentials before running again"
    echo "   Required: ConnectWise and N-able API keys"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🔨 Building containers..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Show logs
echo "📋 Service Status:"
docker-compose ps

echo ""
echo "✅ Development environment started successfully!"
echo ""
echo "📌 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo "   Database:  localhost:5432"
echo ""
echo "📝 Default credentials:"
echo "   Username: admin"
echo "   Password: ChangeMe123!"
echo ""
echo "🔍 View logs: docker-compose logs -f"
echo "🛑 Stop all:  docker-compose down"
echo ""
