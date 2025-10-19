-- Initialize database schema for RMM Integration Platform

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'technician', 'viewer');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ticket_source AS ENUM ('connectwise', 'nable', 'manual', 'automation');
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_automation_history_rule_id ON automation_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_history_ticket_id ON automation_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create default admin user (password: admin123 - change immediately)
INSERT INTO users (id, email, username, password, first_name, last_name, role, is_active)
VALUES (
    uuid_generate_v4(),
    'admin@example.com',
    'admin',
    '$2a$10$YourHashedPasswordHere', -- This should be properly hashed
    'System',
    'Administrator',
    'admin',
    true
) ON CONFLICT DO NOTHING;

-- Create default automation rules
INSERT INTO automation_rules (id, name, description, is_active, priority, conditions, actions, max_retries, retry_delay_ms, timeout_ms)
VALUES 
(
    uuid_generate_v4(),
    'Auto-acknowledge Critical Alerts',
    'Automatically acknowledge critical alerts and create high-priority tickets',
    true,
    1,
    '{"all": [{"field": "severity", "operator": "equals", "value": "Critical", "dataSource": "alert"}]}',
    '[{"type": "create_ticket", "parameters": {"priority": "high"}, "order": 1, "continueOnError": false}, {"type": "send_notification", "parameters": {"channels": ["email", "slack"]}, "order": 2, "continueOnError": true}]',
    3,
    5000,
    60000
),
(
    uuid_generate_v4(),
    'Disk Space Cleanup',
    'Run disk cleanup when disk space alerts are triggered',
    true,
    2,
    '{"all": [{"field": "alertType", "operator": "contains", "value": "disk", "dataSource": "alert"}, {"field": "severity", "operator": "in", "value": ["Warning", "Error"], "dataSource": "alert"}]}',
    '[{"type": "run_script", "parameters": {"scriptId": "DISK_CLEANUP"}, "order": 1, "continueOnError": false}, {"type": "add_note", "parameters": {"text": "Automated disk cleanup initiated"}, "order": 2, "continueOnError": true}]',
    2,
    10000,
    300000
),
(
    uuid_generate_v4(),
    'Service Restart on Failure',
    'Automatically restart failed services',
    true,
    3,
    '{"all": [{"field": "alertType", "operator": "equals", "value": "ServiceDown", "dataSource": "alert"}]}',
    '[{"type": "restart_service", "parameters": {}, "order": 1, "continueOnError": false}, {"type": "update_ticket", "parameters": {"updates": {"status": "in_progress"}}, "order": 2, "continueOnError": true}]',
    3,
    5000,
    120000
) ON CONFLICT DO NOTHING;

-- Create views for reporting
CREATE OR REPLACE VIEW ticket_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600)::numeric(10,2) as avg_resolution_hours
FROM tickets
GROUP BY DATE_TRUNC('day', created_at);

CREATE OR REPLACE VIEW automation_performance AS
SELECT 
    ar.name as rule_name,
    ar.execution_count,
    ar.success_count,
    ar.failure_count,
    CASE 
        WHEN ar.execution_count > 0 
        THEN ROUND((ar.success_count::numeric / ar.execution_count) * 100, 2)
        ELSE 0 
    END as success_rate,
    ar.last_executed_at,
    ar.last_success_at,
    ar.last_failure_at
FROM automation_rules ar
WHERE ar.is_active = true;

-- Create functions for triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rmm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rmm_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO rmm_user;


