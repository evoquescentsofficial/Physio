-- CreateTable
CREATE TABLE "Doctor" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Visit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "packageId" TEXT,
    "diagnosisId" TEXT,
    "doctorId" TEXT,
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
    CONSTRAINT "Visit_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "Diagnosis" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Visit" ("attendance", "carriedForward", "carriedFromId", "completedDate", "createdAt", "diagnosisId", "fee", "feeCollected", "id", "packageId", "patientId", "remarks", "scheduledDate", "sessionNumber", "treatmentNotes", "type") SELECT "attendance", "carriedForward", "carriedFromId", "completedDate", "createdAt", "diagnosisId", "fee", "feeCollected", "id", "packageId", "patientId", "remarks", "scheduledDate", "sessionNumber", "treatmentNotes", "type" FROM "Visit";
DROP TABLE "Visit";
ALTER TABLE "new_Visit" RENAME TO "Visit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
