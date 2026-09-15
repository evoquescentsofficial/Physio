-- AlterTable
ALTER TABLE "ClinicSettings" ADD COLUMN "diagnosisOptions" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "email" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "exerciseOptions" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "formTitle" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "instagram" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "modalityOptions" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "timings" TEXT;
ALTER TABLE "ClinicSettings" ADD COLUMN "website" TEXT;

-- AlterTable
ALTER TABLE "Diagnosis" ADD COLUMN "checkedDiagnoses" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "evaluation" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "exercises" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "history" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "instructions" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "labFindings" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "medications" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "modalities" TEXT;
ALTER TABLE "Diagnosis" ADD COLUMN "referredTo" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "diagnosisId" TEXT,
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Doctor" ("active", "consultationFee", "createdAt", "email", "id", "joinedDate", "name", "notes", "phone", "qualification", "specialization", "updatedAt") SELECT "active", "consultationFee", "createdAt", "email", "id", "joinedDate", "name", "notes", "phone", "qualification", "specialization", "updatedAt" FROM "Doctor";
DROP TABLE "Doctor";
ALTER TABLE "new_Doctor" RENAME TO "Doctor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Attachment_patientId_idx" ON "Attachment"("patientId");

-- CreateIndex
CREATE INDEX "Attachment_diagnosisId_idx" ON "Attachment"("diagnosisId");
