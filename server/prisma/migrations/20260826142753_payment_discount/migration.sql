-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "date", "id", "method", "notes", "packageId", "patientId", "type", "visitId") SELECT "amount", "createdAt", "date", "id", "method", "notes", "packageId", "patientId", "type", "visitId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_patientId_date_idx" ON "Payment"("patientId", "date");
CREATE INDEX "Payment_date_idx" ON "Payment"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
