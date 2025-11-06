#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}       CONNECTWISE-NABLE RMM AUTOMATION - FULL WORKFLOW TEST                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configuration
BACKEND_URL="http://localhost:3001"
TIMESTAMP=$(date +%s)
TICKET_NUMBER="T$(date +%Y%m%d)-${TIMESTAMP: -4}"
DEVICE_ID="TEST-DEVICE-${TIMESTAMP: -4}"

# Function to check service
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f -o /dev/null "$url/health" 2>/dev/null; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not running${NC}"
        return 1
    fi
}

# Function to send webhook
send_webhook() {
    local alert_type=$1
    local severity=$2
    local message=$3
    
    echo -e "${YELLOW}📡 Sending $alert_type webhook...${NC}"
    
    response=$(curl -s -X POST "$BACKEND_URL/api/webhooks/nable" \
        -H "Content-Type: application/json" \
        -d '{
            "alertType": "'$alert_type'",
            "deviceId": "'$DEVICE_ID'",
            "deviceName": "TestServer-'$TIMESTAMP'",
            "customerId": "TEST-CUSTOMER",
            "severity": "'$severity'",
            "message": "'$message'",
            "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
            "cwTicketNumber": "'$TICKET_NUMBER'",
            "cwTicketId": "'$TIMESTAMP'"
        }')
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✅ Webhook processed successfully${NC}"
        echo "   Response: $response"
    else
        echo -e "${RED}❌ Webhook failed${NC}"
        echo "   Response: $response"
        return 1
    fi
}

# Function to check ticket status
check_ticket() {
    echo -e "${YELLOW}🔍 Checking ticket status...${NC}"
    
    response=$(curl -s "$BACKEND_URL/api/tickets?number=$TICKET_NUMBER")
    
    if echo "$response" | grep -q "$TICKET_NUMBER"; then
        echo -e "${GREEN}✅ Ticket found in system${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  Ticket not found (this is expected if testing webhook processing only)${NC}"
    fi
}

# Function to check automation history
check_automation() {
    echo -e "${YELLOW}🤖 Checking automation history...${NC}"
    
    response=$(curl -s "$BACKEND_URL/api/automation/history?deviceId=$DEVICE_ID")
    
    if echo "$response" | grep -q "success\|completed"; then
        echo -e "${GREEN}✅ Automation executed${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  No automation history yet${NC}"
    fi
}

# Main test flow
echo -e "${BLUE}Step 1: Checking Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! check_service "$BACKEND_URL" "Backend API"; then
    echo -e "${RED}Please start the backend: cd backend && npm run dev${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Test Disk Space Alert${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Simulating: N-able detects disk space issue and creates ConnectWise ticket $TICKET_NUMBER"
echo ""

send_webhook "DISK_SPACE_LOW" "HIGH" "Drive C: is 95% full (4.5 GB free of 100 GB)"

echo ""
echo -e "${BLUE}Step 3: Waiting for Automation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Waiting 5 seconds for automation to process..."
sleep 5

echo ""
echo -e "${BLUE}Step 4: Verify Ticket Update${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_ticket

echo ""
echo -e "${BLUE}Step 5: Check Automation Results${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_automation

echo ""
echo -e "${BLUE}Step 6: Test Service Stopped Alert${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Simulating: Critical service stopped"
echo ""

TICKET_NUMBER="T$(date +%Y%m%d)-${TIMESTAMP: -3}"
send_webhook "SERVICE_STOPPED" "CRITICAL" "Windows Update service (wuauserv) has stopped"

echo ""
echo -e "${BLUE}Step 7: Test Duplicate Prevention${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending same alert again to test duplicate prevention..."
echo ""

send_webhook "SERVICE_STOPPED" "CRITICAL" "Windows Update service (wuauserv) has stopped - DUPLICATE TEST"

echo ""
echo -e "${BLUE}Step 8: Check Logs for Duplicate Prevention${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "backend/logs/combined.log" ]; then
    echo "Recent log entries:"
    tail -n 20 backend/logs/combined.log | grep -E "duplicate|prevent|existing ticket" || echo "No duplicate prevention messages found in logs"
else
    echo -e "${YELLOW}Log file not found. Check if backend is configured for file logging.${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                          TEST COMPLETE!                                        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Test Summary:"
echo "  • Ticket Number: $TICKET_NUMBER"
echo "  • Device ID: $DEVICE_ID"
echo ""
echo "Next Steps:"
echo "  1. Check the UI at http://localhost:3000/tickets"
echo "  2. Review automation rules at http://localhost:3000/automation"
echo "  3. Check Teams channel for notifications (if configured)"
echo "  4. Review full logs: tail -f backend/logs/combined.log"
echo ""
echo -e "${YELLOW}Note: Some features may show as 'not found' if using mock data or if ConnectWise/N-able APIs are not fully configured.${NC}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}       CONNECTWISE-NABLE RMM AUTOMATION - FULL WORKFLOW TEST                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Configuration
BACKEND_URL="http://localhost:3001"
TIMESTAMP=$(date +%s)
TICKET_NUMBER="T$(date +%Y%m%d)-${TIMESTAMP: -4}"
DEVICE_ID="TEST-DEVICE-${TIMESTAMP: -4}"

# Function to check service
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f -o /dev/null "$url/health" 2>/dev/null; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not running${NC}"
        return 1
    fi
}

# Function to send webhook
send_webhook() {
    local alert_type=$1
    local severity=$2
    local message=$3
    
    echo -e "${YELLOW}📡 Sending $alert_type webhook...${NC}"
    
    response=$(curl -s -X POST "$BACKEND_URL/api/webhooks/nable" \
        -H "Content-Type: application/json" \
        -d '{
            "alertType": "'$alert_type'",
            "deviceId": "'$DEVICE_ID'",
            "deviceName": "TestServer-'$TIMESTAMP'",
            "customerId": "TEST-CUSTOMER",
            "severity": "'$severity'",
            "message": "'$message'",
            "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
            "cwTicketNumber": "'$TICKET_NUMBER'",
            "cwTicketId": "'$TIMESTAMP'"
        }')
    
    if echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✅ Webhook processed successfully${NC}"
        echo "   Response: $response"
    else
        echo -e "${RED}❌ Webhook failed${NC}"
        echo "   Response: $response"
        return 1
    fi
}

# Function to check ticket status
check_ticket() {
    echo -e "${YELLOW}🔍 Checking ticket status...${NC}"
    
    response=$(curl -s "$BACKEND_URL/api/tickets?number=$TICKET_NUMBER")
    
    if echo "$response" | grep -q "$TICKET_NUMBER"; then
        echo -e "${GREEN}✅ Ticket found in system${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  Ticket not found (this is expected if testing webhook processing only)${NC}"
    fi
}

# Function to check automation history
check_automation() {
    echo -e "${YELLOW}🤖 Checking automation history...${NC}"
    
    response=$(curl -s "$BACKEND_URL/api/automation/history?deviceId=$DEVICE_ID")
    
    if echo "$response" | grep -q "success\|completed"; then
        echo -e "${GREEN}✅ Automation executed${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    else
        echo -e "${YELLOW}⚠️  No automation history yet${NC}"
    fi
}

# Main test flow
echo -e "${BLUE}Step 1: Checking Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! check_service "$BACKEND_URL" "Backend API"; then
    echo -e "${RED}Please start the backend: cd backend && npm run dev${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Test Disk Space Alert${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Simulating: N-able detects disk space issue and creates ConnectWise ticket $TICKET_NUMBER"
echo ""

send_webhook "DISK_SPACE_LOW" "HIGH" "Drive C: is 95% full (4.5 GB free of 100 GB)"

echo ""
echo -e "${BLUE}Step 3: Waiting for Automation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Waiting 5 seconds for automation to process..."
sleep 5

echo ""
echo -e "${BLUE}Step 4: Verify Ticket Update${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_ticket

echo ""
echo -e "${BLUE}Step 5: Check Automation Results${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
check_automation

echo ""
echo -e "${BLUE}Step 6: Test Service Stopped Alert${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Simulating: Critical service stopped"
echo ""

TICKET_NUMBER="T$(date +%Y%m%d)-${TIMESTAMP: -3}"
send_webhook "SERVICE_STOPPED" "CRITICAL" "Windows Update service (wuauserv) has stopped"

echo ""
echo -e "${BLUE}Step 7: Test Duplicate Prevention${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Sending same alert again to test duplicate prevention..."
echo ""

send_webhook "SERVICE_STOPPED" "CRITICAL" "Windows Update service (wuauserv) has stopped - DUPLICATE TEST"

echo ""
echo -e "${BLUE}Step 8: Check Logs for Duplicate Prevention${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "backend/logs/combined.log" ]; then
    echo "Recent log entries:"
    tail -n 20 backend/logs/combined.log | grep -E "duplicate|prevent|existing ticket" || echo "No duplicate prevention messages found in logs"
else
    echo -e "${YELLOW}Log file not found. Check if backend is configured for file logging.${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                          TEST COMPLETE!                                        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Test Summary:"
echo "  • Ticket Number: $TICKET_NUMBER"
echo "  • Device ID: $DEVICE_ID"
echo ""
echo "Next Steps:"
echo "  1. Check the UI at http://localhost:3000/tickets"
echo "  2. Review automation rules at http://localhost:3000/automation"
echo "  3. Check Teams channel for notifications (if configured)"
echo "  4. Review full logs: tail -f backend/logs/combined.log"
echo ""
echo -e "${YELLOW}Note: Some features may show as 'not found' if using mock data or if ConnectWise/N-able APIs are not fully configured.${NC}"
