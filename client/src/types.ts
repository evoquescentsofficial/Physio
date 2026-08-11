export type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  dob?: string | null;
  gender?: string | null;
  occupation?: string | null;
  referredBy?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { visits: number; packages: number };
  diagnoses?: Diagnosis[];
  packages?: TreatmentPackage[];
  payments?: Payment[];
  visits?: Visit[];
}

export interface Diagnosis {
  id: string;
  patientId: string;
  date: string;
  title: string;
  details?: string | null;
  treatmentPlan?: string | null;
  remarks?: string | null;
  doctorName?: string | null;
}

export type PackageStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Installment {
  id: string;
  packageId: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  notes?: string | null;
}

export interface TreatmentPackage {
  id: string;
  patientId: string;
  patient?: { name: string; phone: string };
  diagnosisId?: string | null;
  title: string;
  totalSessions: number;
  feePerSession: number;
  totalFee: number;
  startDate: string;
  status: PackageStatus;
  notes?: string | null;
  visits?: Visit[];
  installments?: Installment[];
  payments?: Payment[];
}

export type VisitType = 'INITIAL_CONSULT' | 'SESSION' | 'FOLLOWUP';
export type AttendanceStatus = 'SCHEDULED' | 'PRESENT' | 'ABSENT' | 'CARRIED_FORWARD' | 'CANCELLED';

export interface Visit {
  id: string;
  patientId: string;
  patient?: { name: string; phone: string };
  packageId?: string | null;
  package?: { title: string } | null;
  diagnosisId?: string | null;
  sessionNumber?: number | null;
  scheduledDate: string;
  completedDate?: string | null;
  type: VisitType;
  fee: number;
  feeCollected: boolean;
  attendance: AttendanceStatus;
  carriedForward: boolean;
  remarks?: string | null;
  treatmentNotes?: string | null;
}

export type PaymentType =
  | 'CHECKUP_FEE'
  | 'ADVANCE'
  | 'SESSION_FEE'
  | 'INSTALLMENT'
  | 'VISIT_FEE'
  | 'REFUND';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';

export interface Payment {
  id: string;
  patientId: string;
  patient?: { name: string; phone: string };
  packageId?: string | null;
  visitId?: string | null;
  amount: number;
  type: PaymentType;
  method: PaymentMethod;
  date: string;
  notes?: string | null;
}

export type ExpenseCategory =
  | 'SALARY'
  | 'RENT'
  | 'UTILITIES'
  | 'EQUIPMENT'
  | 'MARKETING'
  | 'MAINTENANCE'
  | 'OTHER';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: string;
  paidTo?: string | null;
  notes?: string | null;
}
