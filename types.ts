
export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
}

export interface Employee {
  id: string;
  fullName: string;
  role: 'Driver' | 'Helper' | 'Staff';
  dayOff: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  phone: string;
  licenseNumber?: string;
  licenseType?: 'Non-Professional' | 'Professional';
  licenseExpiration?: string;
}

export interface RepairLog {
  id: string;
  parts: string;
  date: string;
}

export interface TruckAsset {
  id: string;
  plate: string;
  vehicle_type: string;
  status: 'active' | 'in_repair';
  health: number;
  reg_expiry: string;
  last_pms_date: string;
  next_pms_date: string;
  last_pms_mileage: number;
  next_pms_mileage: number;
  created_at: string;
  imageUrl?: string;
  parts_repaired?: string;
  date_repaired?: string;
  repairLogs?: RepairLog[];
}

export enum ReceiptStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  NEEDS_REVIEW = 'needs_review',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ERROR = 'error'
}

export enum ExpenseCategory {
  FUEL = 'fuel',
  TOLLS = 'tolls',
  MAINTENANCE = 'maintenance',
  TIRES = 'tires',
  PARTS = 'parts',
  PARKING = 'parking',
  MEALS = 'meals',
  LODGING = 'lodging',
  SUPPLIES = 'supplies',
  INSURANCE = 'insurance',
  PERMITS = 'permits',
  FEES = 'fees',
  PHONE_INTERNET = 'phone_internet',
  OFFICE = 'office',
  OTHER = 'other'
}

export interface ReceiptData {
  vendor_name: string | null;
  vendor_tin: string | null;
  vendor_branch: string | null;
  document_type: 'Official Receipt' | 'Sales Invoice' | 'Billing Statement' | 'Other' | null;
  receipt_date: string | null;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  payment_method: string | null;
  invoice_or_receipt_no: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  suggested_category: ExpenseCategory | null;
  category_confidence: number;
  notes: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}
