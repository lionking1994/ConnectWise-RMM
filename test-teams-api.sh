#!/bin/bash

BACKEND_URL="http://localhost:3001"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  MS TEAMS INTEGRATION TEST SUITE${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 1. Check current Teams configuration
echo -e "${YELLOW}1. Current Teams Configuration:${NC}"
curl -s "$BACKEND_URL/api/settings/notifications" | python3 -c "
import json, sys
data = json.load(sys.stdin)
teams = data.get('teams', {})
print(f\"  Enabled: {teams.get('enabled', False)}\")
print(f\"  Webhook URL: {'*' * 20 if teams.get('webhookUrl') else 'Not configured'}\")
print(f\"  Channels: {teams.get('channels', {})}\")
"

echo ""
echo -e "${YELLOW}2. Test Teams Connection:${NC}"
# Test the Teams webhook configuration
curl -X POST "$BACKEND_URL/api/notifications/test/teams" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test",
    "title": "🔧 Integration Test",
    "message": "Testing MS Teams integration from ConnectWise-NRMM",
    "priority": "info"
  }' 2>/dev/null | python3 -m json.tool

echo ""
echo -e "${YELLOW}3. Simulate Ticket Action from Teams:${NC}"
# Simulate a Teams action (like clicking a button on an adaptive card)
curl -X POST "$BACKEND_URL/api/webhooks/teams/action" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "action": {
      "verb": "execute_script",
      "data": {
        "ticketId": "TEST-001",
        "scriptName": "disk_cleanup",
        "deviceId": "TEST-DEVICE"
      }
    },
    "from": {
      "name": "Test User",
      "id": "test@example.com"
    }
  }' 2>/dev/null | python3 -m json.tool

echo ""
echo -e "${YELLOW}4. Test Teams Command (Slash command):${NC}"
# Simulate a Teams slash command
curl -X POST "$BACKEND_URL/api/webhooks/teams/command" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "/ticket-note TEST-001 This is a test note from Teams",
    "from": {
      "name": "Test User",
      "id": "test@example.com"
    },
    "conversation": {
      "id": "test-channel"
    }
  }' 2>/dev/null | python3 -m json.tool

echo ""
echo -e "${GREEN}✓ Tests completed. Check your Teams channel for notifications!${NC}"
