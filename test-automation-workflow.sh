#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BACKEND_URL="http://localhost:3001"
TIMESTAMP=$(date +%s)
CW_TICKET="CW-TEST-${TIMESTAMP}"
DEVICE_ID="TEST-DEVICE-${TIMESTAMP}"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}    AUTOMATED WORKFLOW TEST SUITE                    ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Function to check backend health
check_backend() {
    echo -e "${YELLOW}Checking backend health...${NC}"
    HEALTH_CHECK=$(curl -s ${BACKEND_URL}/health 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend is running${NC}"
        echo "  Response: ${HEALTH_CHECK}"
        return 0
    else
        echo -e "${RED}✗ Backend is not responding${NC}"
        echo "  Please ensure backend is running on port 3001"
        return 1
    fi
}

# Function to create automation rule
create_automation_rule() {
    echo -e "\n${YELLOW}Creating automation rule for DISK_SPACE_LOW...${NC}"
    
    RULE_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/api/automation/rules \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Disk Cleanup Rule",
            "description": "Auto-cleanup disk when space is low",
            "isActive": true,
            "priority": 1,
            "trigger": {
                "type": "alert",
                "conditions": [
                    {
                        "field": "alertType",
                        "operator": "equals",
                        "value": "DISK_SPACE_LOW",
                        "dataSource": "alert"
                    }
                ],
                "logicalOperator": "AND"
            },
            "actions": [
                {
                    "type": "execute_script",
                    "parameters": {
                        "scriptName": "disk_cleanup",
                        "scriptParams": {
                            "driveLetter": "C:",
                            "cleanTemp": true
                        },
                        "onSuccess": "close_ticket",
                        "onFailure": "update_ticket"
                    }
                }
            ]
        }' 2>/dev/null)
    
    if echo "$RULE_RESPONSE" | grep -q '"id"'; then
        RULE_ID=$(echo "$RULE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -1)
        echo -e "${GREEN}✓ Automation rule created: ${RULE_ID}${NC}"
        return 0
    else
        echo -e "${YELLOW}! Rule might already exist or creation failed${NC}"
        echo "  Response: ${RULE_RESPONSE}"
        return 1
    fi
}

# Function to send N-able webhook
send_nable_webhook() {
    local alert_type=$1
    local severity=$2
    local extra_params=$3
    
    echo -e "\n${YELLOW}Sending N-able webhook: ${alert_type}${NC}"
    echo "  CW Ticket: ${CW_TICKET}"
    echo "  Device ID: ${DEVICE_ID}"
    
    WEBHOOK_PAYLOAD="{
        \"eventType\": \"alert.created\",
        \"alertType\": \"${alert_type}\",
        \"severity\": \"${severity}\",
        \"deviceId\": \"${DEVICE_ID}\",
        \"deviceName\": \"Test Server\",
        \"cwTicketNumber\": \"${CW_TICKET}\",
        \"clientName\": \"Test Client\",
        \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
        ${extra_params}
    }"
    
    WEBHOOK_RESPONSE=$(curl -s -X POST ${BACKEND_URL}/api/webhooks/nable \
        -H "Content-Type: application/json" \
        -d "${WEBHOOK_PAYLOAD}" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Webhook sent successfully${NC}"
        echo "  Response: ${WEBHOOK_RESPONSE}"
        return 0
    else
        echo -e "${RED}✗ Failed to send webhook${NC}"
        return 1
    fi
}

# Function to check automation logs
check_automation_logs() {
    echo -e "\n${YELLOW}Checking automation activity (waiting 5 seconds)...${NC}"
    sleep 5
    
    # Check if logs directory exists
    if [ -d "backend/logs" ]; then
        echo "Searching for automation activity..."
        
        # Look for specific automation patterns
        PATTERNS=(
            "Processing alert from"
            "Auto-remediation"
            "Executing script"
            "ConnectWise ticket"
            "Matched rule"
            "${CW_TICKET}"
            "${DEVICE_ID}"
        )
        
        for pattern in "${PATTERNS[@]}"; do
            MATCHES=$(grep -i "$pattern" backend/logs/combined.log 2>/dev/null | tail -3)
            if [ ! -z "$MATCHES" ]; then
                echo -e "${GREEN}Found: ${pattern}${NC}"
                echo "$MATCHES" | sed 's/^/  /'
            fi
        done
    else
        echo -e "${YELLOW}! Logs directory not found${NC}"
    fi
}

# Function to check automation history
check_automation_history() {
    echo -e "\n${YELLOW}Checking automation history...${NC}"
    
    HISTORY=$(curl -s ${BACKEND_URL}/api/automation/history?limit=5 2>/dev/null)
    
    if echo "$HISTORY" | grep -q "executionSteps"; then
        echo -e "${GREEN}✓ Found automation history${NC}"
        echo "$HISTORY" | python3 -m json.tool 2>/dev/null | head -30
    else
        echo -e "${YELLOW}! No recent automation history found${NC}"
    fi
}

# Function to test specific alert type
test_alert_automation() {
    local alert_type=$1
    local description=$2
    local extra_params=$3
    
    echo -e "\n${BLUE}------------------------------------------------------${NC}"
    echo -e "${BLUE}Testing: ${description}${NC}"
    echo -e "${BLUE}------------------------------------------------------${NC}"
    
    # Update ticket number for this test
    CW_TICKET="CW-${alert_type}-${TIMESTAMP}"
    
    # Send webhook
    send_nable_webhook "$alert_type" "HIGH" "$extra_params"
    
    # Wait for processing
    sleep 3
    
    # Check logs for this specific ticket
    echo -e "\n${YELLOW}Checking for ticket processing...${NC}"
    TICKET_LOGS=$(grep -i "${CW_TICKET}" backend/logs/combined.log 2>/dev/null | tail -5)
    if [ ! -z "$TICKET_LOGS" ]; then
        echo -e "${GREEN}✓ Ticket ${CW_TICKET} is being processed${NC}"
        echo "$TICKET_LOGS" | sed 's/^/  /'
    else
        echo -e "${YELLOW}! No logs found for ${CW_TICKET}${NC}"
    fi
}

# Main test execution
main() {
    echo "Starting automated workflow test suite..."
    echo "Timestamp: $(date)"
    echo ""
    
    # Step 1: Check backend
    if ! check_backend; then
        echo -e "${RED}Backend check failed. Exiting.${NC}"
        exit 1
    fi
    
    # Step 2: Create automation rule
    create_automation_rule
    
    # Step 3: Test DISK_SPACE_LOW alert
    test_alert_automation \
        "DISK_SPACE_LOW" \
        "Disk Space Low Alert with Auto-Cleanup" \
        ', "diskPercent": 95, "driveLetter": "C:"'
    
    # Step 4: Test SERVICE_STOPPED alert
    test_alert_automation \
        "SERVICE_STOPPED" \
        "Service Stopped Alert with Auto-Restart" \
        ', "serviceName": "PrintSpooler"'
    
    # Step 5: Check overall automation activity
    check_automation_logs
    
    # Step 6: Check automation history
    check_automation_history
    
    # Summary
    echo -e "\n${BLUE}======================================================${NC}"
    echo -e "${BLUE}    TEST SUMMARY                                      ${NC}"
    echo -e "${BLUE}======================================================${NC}"
    
    echo -e "\n${GREEN}Test Completed!${NC}"
    echo ""
    echo "What to check:"
    echo "1. Look for 'Auto-remediation' messages in logs"
    echo "2. Check if rules matched the alerts"
    echo "3. Verify script execution attempts"
    echo "4. Check for ConnectWise ticket updates"
    echo ""
    echo "Log locations:"
    echo "  - Combined: backend/logs/combined.log"
    echo "  - Errors: backend/logs/error.log"
    echo ""
    echo -e "${YELLOW}Note: If remediation didn't trigger:${NC}"
    echo "  - Ensure AUTO_REMEDIATION_ENABLED=true in .env"
    echo "  - Check N-able and ConnectWise credentials in Settings"
    echo "  - Verify automation rules are active"
}

# Run the main test
main


