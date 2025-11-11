#!/bin/bash

# Configuration
BACKEND_URL="http://localhost:3001"
TEAMS_WEBHOOK_URL="YOUR_TEAMS_WEBHOOK_URL_HERE"  # You need to set this

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Testing MS Teams Integration${NC}"
echo "================================"
echo ""

# 1. Test sending a notification via backend API
echo -e "${GREEN}1. Testing Teams notification through backend API:${NC}"
curl -X POST "$BACKEND_URL/api/notifications/teams/test" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "🔔 Test notification from ConnectWise-NRMM Integration",
    "title": "Integration Test",
    "color": "0076D7",
    "facts": [
      {"name": "Test Type", "value": "Manual Test"},
      {"name": "Timestamp", "value": "'$(date -u +"%Y-%m-%d %H:%M:%S UTC")'"},
      {"name": "Environment", "value": "Development"}
    ]
  }' | python3 -m json.tool

echo ""
echo -e "${GREEN}2. Testing Teams alert for ticket creation:${NC}"
# Simulate a ticket creation that should trigger Teams notification
curl -X POST "$BACKEND_URL/api/webhooks/nable" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TEAMS-TEST-'$(date +%s)'",
    "eventType": "alert.created",
    "alertType": "DISK_SPACE_LOW",
    "severity": "CRITICAL",
    "message": "Critical: Disk space at 95% on C: drive",
    "deviceId": "TEST-DEVICE-01",
    "deviceName": "Test-Server",
    "clientName": "Test Client",
    "diskPercent": 95,
    "driveLetter": "C:",
    "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }'

echo ""
echo -e "${GREEN}3. Testing Teams adaptive card for ticket:${NC}"
curl -X POST "$BACKEND_URL/api/notifications/teams/ticket" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "TEST-12345",
    "title": "Test Ticket - Disk Space Alert",
    "priority": "High",
    "status": "Open",
    "client": "Test Client",
    "device": "TEST-SERVER-01",
    "description": "Disk space critical on C: drive (95% used)",
    "actions": [
      {"type": "execute_script", "title": "Run Disk Cleanup", "scriptId": "disk_cleanup"},
      {"type": "add_note", "title": "Add Note"},
      {"type": "close_ticket", "title": "Close Ticket"}
    ]
  }' | python3 -m json.tool

echo ""
echo -e "${YELLOW}Check your Teams channel for the notifications!${NC}"
