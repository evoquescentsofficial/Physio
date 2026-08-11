-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'clinic',
    "clinicName" TEXT NOT NULL DEFAULT 'Physio Fitness Clinic',
    "phone" TEXT,
    "address" TEXT,
    "checkupFee" REAL NOT NULL DEFAULT 1000,
    "defaultSessionFee" REAL NOT NULL DEFAULT 1500,
    "updatedAt" DATETIME NOT NULL
);
