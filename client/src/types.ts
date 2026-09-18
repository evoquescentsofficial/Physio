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
  attendantName?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { visits: number; packages: number };
  diagnoses?: Diagnosis[];
  packages?: TreatmentPackage[];
  payments?: Payment[];
  visits?: Visit[];
}

export interface Attachment {
  id: string;
  patientId: string;
  diagnosisId?: string | null;
  filename: string;
  mimeType: string;
  size: number;
  label?: string | null;
  uploadedAt: string;
  /** Demo only: the file itself, held in the browser rather than on a clinic computer. */
  dataUrl?: string;
}

/** A filled-in copy of the clinic's prescription pad: the whole assessment, not just a label. */
export interface Diagnosis {
  id: string;
  patientId: string;
  date: string;
  title: string;
  details?: string | null;
  treatmentPlan?: string | null;
  remarks?: string | null;
  doctorName?: string | null;
  doctorId?: string | null;
  doctor?: { id: string; name: string } | null;
  bodyRegion?: string | null;
  side?: string | null;
  painScore?: number | null;
  history?: string | null;
  evaluation?: string | null;
  instructions?: string | null;
  referredTo?: string | null;
  labFindings?: string | null;
  medications?: string | null;
  checkedDiagnoses?: string[];
  exercises?: string[];
  modalities?: string[];
  /** A per-patient dosage override for ticked exercises, keyed by exercise name. */
  exerciseNotes?: Record<string, string>;
  attachments?: Attachment[];
}

export type PackageStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type BillingCycle = 'ONE_TIME' | 'WEEKLY' | 'MONTHLY';
export type EmploymentType = 'SALARIED' | 'COMMISSION';

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
  /** Weekly and monthly packages bill per cycle; the rest is worked out from that. */
  billingCycle?: BillingCycle;
  sessionsPerCycle?: number | null;
  cycleFee?: number | null;
  cycles?: number | null;
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
  doctorId?: string | null;
  doctor?: { id: string; name: string } | null;
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

export interface Doctor {
  id: string;
  name: string;
  specialization?: string | null;
  qualification?: string | null;
  phone?: string | null;
  email?: string | null;
  consultationFee?: number | null;
  joinedDate?: string | null;
  active: boolean;
  notes?: string | null;
  /** Printed beside the logo on the prescription, one qualification per line. */
  credentials?: string | null;
  onLetterhead?: boolean;
  departments?: string[];
  /** Salaried doctors draw monthlySalary; commission doctors keep commissionPercent. */
  employmentType?: EmploymentType;
  monthlySalary?: number | null;
  commissionPercent?: number | null;
  sessionsThisMonth?: number;
  sessionsCompleted?: number;
  visits?: Visit[];
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
  /** Taken off the standard fee — a family rate, concession or waived visit. */
  discount?: number;
  type: PaymentType;
  method: PaymentMethod;
  date: string;
  notes?: string | null;
  /** Set when a commission doctor took the money at the chair rather than the front desk. */
  collectedByDoctorId?: string | null;
}

/** A payment the patient still owes, as the front desk sees it. */
export interface DuePayment {
  id: string;
  amount: number;
  dueDate: string;
  daysAway?: number;
  overdue: boolean;
  packageId: string;
  packageTitle: string;
  billingCycle?: BillingCycle;
  patient: { id: string; name: string; phone: string };
}

/** What a doctor earned over a range, and who owes whom because of it. */
export interface DoctorEarnings {
  doctor: Doctor;
  sessions: number;
  gross: number;
  doctorShare: number;
  clinicShare: number;
  collectedByDoctor: number;
  paidOut: number;
  balance: number;
}

export type ExpenseCategory =
  | 'SALARY'
  | 'COMMISSION'
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
  /** Set when the money went to a doctor — a salary or a commission settlement. */
  doctorId?: string | null;
  doctor?: { id: string; name: string } | null;
}
