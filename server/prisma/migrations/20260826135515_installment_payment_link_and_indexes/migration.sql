-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "paidDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,
    CONSTRAINT "Installment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TreatmentPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Installment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Installment" ("amount", "createdAt", "dueDate", "id", "notes", "packageId", "paidDate", "status") SELECT "amount", "createdAt", "dueDate", "id", "notes", "packageId", "paidDate", "status" FROM "Installment";
DROP TABLE "Installment";
ALTER TABLE "new_Installment" RENAME TO "Installment";
CREATE UNIQUE INDEX "Installment_paymentId_key" ON "Installment"("paymentId");
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");
CREATE INDEX "Installment_packageId_idx" ON "Installment"("packageId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE INDEX "Payment_patientId_date_idx" ON "Payment"("patientId", "date");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX "Visit_scheduledDate_idx" ON "Visit"("scheduledDate");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- CreateIndex
CREATE INDEX "Visit_doctorId_idx" ON "Visit"("doctorId");

-- CreateIndex
CREATE INDEX "Visit_packageId_idx" ON "Visit"("packageId");
