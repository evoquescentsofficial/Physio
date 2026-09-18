-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "patientId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Diagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "treatmentPlan" TEXT,
    "remarks" TEXT,
    "doctorName" TEXT,
    "doctorId" TEXT,
    "bodyRegion" TEXT,
    "side" TEXT,
    "painScore" INTEGER,
    "history" TEXT,
    "evaluation" TEXT,
    "instructions" TEXT,
    "referredTo" TEXT,
    "labFindings" TEXT,
    "medications" TEXT,
    "checkedDiagnoses" TEXT,
    "exercises" TEXT,
    "modalities" TEXT,
    "exerciseNotes" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagnosis_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Diagnosis" ("bodyRegion", "checkedDiagnoses", "createdAt", "date", "details", "doctorId", "doctorName", "evaluation", "exerciseNotes", "exercises", "history", "id", "instructions", "labFindings", "medications", "modalities", "painScore", "patientId", "referredTo", "remarks", "side", "title", "treatmentPlan") SELECT "bodyRegion", "checkedDiagnoses", "createdAt", "date", "details", "doctorId", "doctorName", "evaluation", "exerciseNotes", "exercises", "history", "id", "instructions", "labFindings", "medications", "modalities", "painScore", "patientId", "referredTo", "remarks", "side", "title", "treatmentPlan" FROM "Diagnosis";
DROP TABLE "Diagnosis";
ALTER TABLE "new_Diagnosis" RENAME TO "Diagnosis";
CREATE INDEX "Diagnosis_patientId_idx" ON "Diagnosis"("patientId");
CREATE INDEX "Diagnosis_reviewStatus_idx" ON "Diagnosis"("reviewStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_patientId_idx" ON "AuditLog"("patientId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
