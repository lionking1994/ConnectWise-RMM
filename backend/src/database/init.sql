-- Initialize database schema for RMM Integration Platform

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types (only if they don't exist)
DO $$ BEGIN
CREATE TYPE user_role AS ENUM ('admin', 'technician', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TYPE ticket_source AS ENUM ('connectwise', 'nable', 'manual', 'automation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled', 'timeout');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Note: Default admin user will be created by the application on first run

-- Note: Default automation rules will be created by the application on first run

-- Note: Views will be created after tables are initialized by TypeORM

-- Create function for triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Note: Triggers will be created after tables are initialized by TypeORM

-- Grant permissions (adjust as needed for your setup)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rmm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rmm_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO rmm_user;


