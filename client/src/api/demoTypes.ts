export interface DemoSettings {
  id: string;
  clinicName: string;
  phone: string | null;
  address: string | null;
  checkupFee: number;
  defaultSessionFee: number;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  timings?: string | null;
  formTitle?: string | null;
  diagnosisOptions?: string[];
  exerciseOptions?: string[];
  modalityOptions?: string[];
  departmentOptions?: string[];
  exerciseLibrary?: Record<string, { instructions: string; dosage: string; homeExercise: boolean }>;
}

export interface DemoPatient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  dob: string | null;
  gender: string | null;
  occupation: string | null;
  referredBy: string | null;
  bloodGroup: string | null;
  attendantName?: string | null;
  emergencyContact: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoDiagnosis {
  id: string;
  patientId: string;
  date: string;
  title: string;
  details: string | null;
  treatmentPlan: string | null;
  remarks: string | null;
  doctorName: string | null;
  doctorId?: string | null;
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
  exerciseNotes?: Record<string, string>;
  reviewStatus?: string;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
}

export interface DemoAttachment {
  id: string;
  patientId: string;
  diagnosisId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  label: string | null;
  uploadedAt: string;
  /** The file itself, held in this browser — the demo has no clinic computer to put it on. */
  dataUrl: string;
}

export interface DemoPackage {
  id: string;
  patientId: string;
  billingCycle?: string;
  sessionsPerCycle?: number | null;
  cycleFee?: number | null;
  cycles?: number | null;
  diagnosisId: string | null;
  title: string;
  totalSessions: number;
  feePerSession: number;
  totalFee: number;
  startDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export interface DemoInstallment {
  id: string;
  packageId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  notes: string | null;
  paymentId: string | null;
}

export interface DemoDoctor {
  id: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  phone: string | null;
  email: string | null;
  consultationFee: number | null;
  joinedDate: string | null;
  active: boolean;
  notes: string | null;
  credentials?: string | null;
  onLetterhead?: boolean;
  departments?: string[];
  employmentType?: string;
  monthlySalary?: number | null;
  commissionPercent?: number | null;
}

export interface DemoVisit {
  id: string;
  patientId: string;
  packageId: string | null;
  diagnosisId: string | null;
  doctorId: string | null;
  sessionNumber: number | null;
  scheduledDate: string;
  completedDate: string | null;
  type: string;
  fee: number;
  feeCollected: boolean;
  attendance: string;
  carriedForward: boolean;
  carriedFromId: string | null;
  remarks: string | null;
  treatmentNotes: string | null;
}

export interface DemoPayment {
  id: string;
  patientId: string;
  packageId: string | null;
  visitId: string | null;
  amount: number;
  discount?: number;
  type: string;
  method: string;
  date: string;
  notes: string | null;
  collectedByDoctorId?: string | null;
}

export interface DemoExpense {
  id: string;
  category: string;
  title: string;
  amount: number;
  date: string;
  paidTo: string | null;
  notes: string | null;
  doctorId?: string | null;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface DemoAuditEntry {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  patientId: string | null;
  summary: string;
  createdAt: string;
}

export interface DemoDb {
  settings: DemoSettings;
  patients: DemoPatient[];
  diagnoses: DemoDiagnosis[];
  packages: DemoPackage[];
  installments: DemoInstallment[];
  visits: DemoVisit[];
  doctors: DemoDoctor[];
  payments: DemoPayment[];
  expenses: DemoExpense[];
  attachments: DemoAttachment[];
  users: DemoUser[];
  auditLog: DemoAuditEntry[];
  /** The demo's one signed-in account — there is no real server session to ask instead. */
  session: { id: string; name: string; email: string; role: string } | null;
}
