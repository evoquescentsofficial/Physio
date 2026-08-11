-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'RECEPTIONIST',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "dob" DATETIME,
    "gender" TEXT,
    "occupation" TEXT,
    "referredBy" TEXT,
    "bloodGroup" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "treatmentPlan" TEXT,
    "remarks" TEXT,
    "doctorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TreatmentPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "diagnosisId" TEXT,
    "title" TEXT NOT NULL,
    "totalSessions" INTEGER NOT NULL,
    "feePerSession" REAL NOT NULL,
    "totalFee" REAL NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreatmentPackage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreatmentPackage_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "packageId" TEXT,
    "diagnosisId" TEXT,
    "sessionNumber" INTEGER,
    "scheduledDate" DATETIME NOT NULL,
    "completedDate" DATETIME,
    "type" TEXT NOT NULL DEFAULT 'SESSION',
    "fee" REAL NOT NULL DEFAULT 0,
    "feeCollected" BOOLEAN NOT NULL DEFAULT false,
    "attendance" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "carriedForward" BOOLEAN NOT NULL DEFAULT false,
    "carriedFromId" TEXT,
    "remarks" TEXT,
    "treatmentNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Visit_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "packageId" TEXT,
    "visitId" TEXT,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidTo" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
