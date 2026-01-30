
-- Shekinah Movers - Database Schema
-- Copy and paste this into the Supabase SQL Editor

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'needs_review', 'pending_approval', 'approved', 'rejected', 'error');
CREATE TYPE expense_category AS ENUM (
  'fuel', 'tolls', 'maintenance', 'tires', 'parts', 'parking', 'meals', 'lodging',
  'supplies', 'insurance', 'permits', 'fees', 'phone_internet', 'office', 'other'
);

-- TABLES
CREATE TABLE IF NOT EXISTS legacy_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role DEFAULT 'staff',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_number TEXT UNIQUE NOT NULL,
  model TEXT,
  fuel_type TEXT DEFAULT 'diesel',
  baseline_kpl NUMERIC(10,2) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES legacy_users(id),
  truck_id UUID REFERENCES trucks(id),
  employee_id UUID REFERENCES employees(id),
  status receipt_status DEFAULT 'uploaded',
  storage_path TEXT,
  extracted_json JSONB,
  vendor_name TEXT,
  receipt_date DATE,
  total_amount NUMERIC(15,2),
  currency TEXT DEFAULT 'PHP',
  category expense_category,
  confidence NUMERIC(3,2),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id),
  truck_id UUID REFERENCES trucks(id),
  employee_id UUID REFERENCES employees(id),
  amount NUMERIC(15,2) NOT NULL,
  category expense_category NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES trucks(id) NOT NULL,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  odometer_km NUMERIC(15,2) NOT NULL,
  liters NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2),
  total_amount NUMERIC(15,2),
  station_name TEXT,
  fuel_date TIMESTAMPTZ DEFAULT NOW(),
  prev_fuel_event_id UUID REFERENCES fuel_events(id)
);

CREATE TABLE IF NOT EXISTS fuel_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_event_id UUID REFERENCES fuel_events(id),
  severity INT DEFAULT 1,
  anomaly_type TEXT, -- 'kpl_drop', 'odometer_backwards', 'frequent_refuel'
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES legacy_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED DATA (Password is '1234' - Use crypto for actual app)
INSERT INTO legacy_users (username, password_hash, role, full_name)
VALUES 
('admin', '1234', 'admin', 'Super Admin'),
('staff', '1234', 'staff', 'Operations Staff')
ON CONFLICT DO NOTHING;

-- INDEXES
CREATE INDEX idx_receipt_status ON receipts(status);
CREATE INDEX idx_expenses_truck ON expenses(truck_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_receipt_updated_at BEFORE UPDATE ON receipts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
