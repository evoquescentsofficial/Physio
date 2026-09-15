-- AlterTable
ALTER TABLE "ClinicSettings" ADD COLUMN "departmentOptions" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Doctor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "specialization" TEXT,
    "qualification" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "consultationFee" REAL,
    "joinedDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "credentials" TEXT,
    "onLetterhead" BOOLEAN NOT NULL DEFAULT false,
    "departments" TEXT,
    "employmentType" TEXT NOT NULL DEFAULT 'SALARIED',
    "monthlySalary" REAL,
    "commissionPercent" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Doctor" ("active", "consultationFee", "createdAt", "credentials", "email", "id", "joinedDate", "name", "notes", "onLetterhead", "phone", "qualification", "specialization", "updatedAt") SELECT "active", "consultationFee", "createdAt", "credentials", "email", "id", "joinedDate", "name", "notes", "onLetterhead", "phone", "qualification", "specialization", "updatedAt" FROM "Doctor";
DROP TABLE "Doctor";
ALTER TABLE "new_Doctor" RENAME TO "Doctor";
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidTo" TEXT,
    "notes" TEXT,
    "doctorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "category", "createdAt", "date", "id", "notes", "paidTo", "title") SELECT "amount", "category", "createdAt", "date", "id", "notes", "paidTo", "title" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_doctorId_idx" ON "Expense"("doctorId");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "packageId" TEXT,
    "visitId" TEXT,
    "amount" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "collectedByDoctorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_collectedByDoctorId_fkey" FOREIGN KEY ("collectedByDoctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "date", "discount", "id", "method", "notes", "packageId", "patientId", "type", "visitId") SELECT "amount", "createdAt", "date", "discount", "id", "method", "notes", "packageId", "patientId", "type", "visitId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_patientId_date_idx" ON "Payment"("patientId", "date");
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
CREATE TABLE "new_TreatmentPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billingCycle" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "sessionsPerCycle" INTEGER,
    "cycleFee" REAL,
    "cycles" INTEGER,
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
INSERT INTO "new_TreatmentPackage" ("createdAt", "diagnosisId", "feePerSession", "id", "notes", "patientId", "startDate", "status", "title", "totalFee", "totalSessions") SELECT "createdAt", "diagnosisId", "feePerSession", "id", "notes", "patientId", "startDate", "status", "title", "totalFee", "totalSessions" FROM "TreatmentPackage";
DROP TABLE "TreatmentPackage";
ALTER TABLE "new_TreatmentPackage" RENAME TO "TreatmentPackage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
