#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:3001"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}    TICKET SYNC DEBUG TEST SCRIPT${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 1. Check backend health
echo -e "${YELLOW}1. Checking backend health...${NC}"
HEALTH=$(curl -s "$BACKEND_URL/health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    echo "   Response: $HEALTH"
else
    echo -e "${RED}✗ Backend is not running at $BACKEND_URL${NC}"
    echo "   Please start the backend first: cd backend && npm run dev"
    exit 1
fi
echo ""

# 2. Get current ticket count
echo -e "${YELLOW}2. Getting current ticket count...${NC}"
TICKETS=$(curl -s "$BACKEND_URL/api/tickets" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        cw_tickets = [t for t in data if t.get('source', '').lower() == 'connectwise']
        nable_tickets = [t for t in data if t.get('source', '').lower() == 'nable']
        print(f'Total: {len(data)}, ConnectWise: {len(cw_tickets)}, N-able: {len(nable_tickets)}')
        for t in cw_tickets[:3]:
            print(f'  - CW Ticket: {t.get(\"ticketNumber\", \"N/A\")} (External ID: {t.get(\"externalId\", \"N/A\")})')
    else:
        print('Response is not an array')
except Exception as e:
    print(f'Error parsing response: {e}')
" 2>/dev/null)

echo -e "${GREEN}Current tickets in system:${NC} $TICKETS"
echo ""

# 3. Test sync endpoint with credentials check
echo -e "${YELLOW}3. Testing ConnectWise credentials...${NC}"
SETTINGS=$(curl -s "$BACKEND_URL/api/settings" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    cw = data.get('connectwise', {})
    if cw.get('apiUrl') and cw.get('companyId'):
        print(f'ConnectWise configured: URL={cw[\"apiUrl\"]}, Company={cw[\"companyId\"]}')
    else:
        print('ConnectWise not configured')
except:
    print('Could not get settings')
" 2>/dev/null)

echo "   $SETTINGS"
echo ""

# 4. Trigger sync with timing
echo -e "${YELLOW}4. Triggering ConnectWise sync...${NC}"
echo "   Calling POST /api/tickets/sync..."
START_TIME=$(date +%s)

SYNC_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/tickets/sync" \
  -H "Content-Type: application/json" 2>/dev/null)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "   Sync completed in ${DURATION} seconds"
echo ""

# Parse sync response
echo -e "${YELLOW}5. Sync Response:${NC}"
echo "$SYNC_RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        print(f'✅ SUCCESS: {data.get(\"message\", \"Sync completed\")}')
        print(f'   Ticket Count: {data.get(\"ticketCount\", \"N/A\")}')
    else:
        print(f'❌ FAILED: {data.get(\"message\", \"Unknown error\")}')
        if 'error' in data:
            print(f'   Error: {data[\"error\"]}')
except Exception as e:
    print(f'⚠️  Could not parse response: {e}')
    print(f'   Raw response: {sys.stdin.read()}')
" <<< "$SYNC_RESPONSE"
echo ""

# 5. Get updated ticket count
echo -e "${YELLOW}6. Getting updated ticket count...${NC}"
sleep 1  # Wait a moment for database updates
UPDATED_TICKETS=$(curl -s "$BACKEND_URL/api/tickets" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        cw_tickets = [t for t in data if t.get('source', '').lower() == 'connectwise']
        nable_tickets = [t for t in data if t.get('source', '').lower() == 'nable']
        print(f'Total: {len(data)}, ConnectWise: {len(cw_tickets)}, N-able: {len(nable_tickets)}')
        
        # Show recent tickets with external IDs
        recent_cw = sorted([t for t in cw_tickets if t.get('externalId')], 
                          key=lambda x: x.get('updatedAt', ''), reverse=True)[:3]
        if recent_cw:
            print('   Recent ConnectWise tickets:')
            for t in recent_cw:
                print(f'     - {t.get(\"ticketNumber\", \"N/A\")} | CW ID: {t.get(\"externalId\", \"N/A\")} | {t.get(\"title\", \"No title\")[:50]}')
    else:
        print('Response is not an array')
except Exception as e:
    print(f'Error parsing response: {e}')
" 2>/dev/null)

echo -e "${GREEN}Updated tickets:${NC} $UPDATED_TICKETS"
echo ""

# 6. Test with sync parameter
echo -e "${YELLOW}7. Testing GET with sync=true parameter...${NC}"
SYNC_GET=$(curl -s "$BACKEND_URL/api/tickets?sync=true" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        print(f'Received {len(data)} tickets')
    else:
        print('Response is not an array')
except:
    print('Error parsing response')
" 2>/dev/null)

echo "   $SYNC_GET"
echo ""

# 7. Check backend logs for errors
echo -e "${YELLOW}8. Recent backend sync logs (if available):${NC}"
if [ -f "backend/logs/combined.log" ]; then
    echo "   Last 5 sync-related log entries:"
    grep -i "sync\|connectwise\|ticket" backend/logs/combined.log | tail -5 | while read line; do
        echo "     $line"
    done
else
    echo "   Log file not found at backend/logs/combined.log"
fi
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}         SYNC TEST COMPLETE${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${BLUE}Debug Tips:${NC}"
echo "1. Check browser console for [TICKETS DEBUG] messages"
echo "2. Ensure ConnectWise credentials are saved in Settings"
echo "3. Check backend logs: tail -f backend/logs/combined.log"
echo "4. Verify ConnectWise API is accessible from this server"
echo ""
