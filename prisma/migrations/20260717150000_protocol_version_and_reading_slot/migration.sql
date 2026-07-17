ALTER TABLE "UserState" ADD COLUMN "protocolVersion" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "UserState" ADD COLUMN "medicationReductionPercent" REAL NOT NULL DEFAULT 0;
ALTER TABLE "UserState" ADD COLUMN "medicationReductionConfirmedAt" DATETIME;

ALTER TABLE "Reading" ADD COLUMN "readingSlot" TEXT;

CREATE INDEX "Reading_readingSlot_idx" ON "Reading"("readingSlot");

CREATE TABLE "WeeklyProtocolReview" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "protocolVersion" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "weekStart" DATETIME NOT NULL,
  "weekEnd" DATETIME NOT NULL,
  "expectedReadings" INTEGER NOT NULL,
  "recordedReadings" INTEGER NOT NULL,
  "controlledReadings" INTEGER NOT NULL,
  "completionPercent" REAL NOT NULL,
  "controlledPercent" REAL NOT NULL,
  "fastingAverage" REAL,
  "otherAverage" REAL,
  "minimumGlucose" INTEGER,
  "maximumGlucose" INTEGER,
  "hypoglycemiaCount" INTEGER NOT NULL DEFAULT 0,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WeeklyProtocolReview_userId_phase_weekStart_key" ON "WeeklyProtocolReview"("userId", "phase", "weekStart");
CREATE INDEX "WeeklyProtocolReview_userId_reviewedAt_idx" ON "WeeklyProtocolReview"("userId", "reviewedAt");
CREATE INDEX "WeeklyProtocolReview_phase_passed_idx" ON "WeeklyProtocolReview"("phase", "passed");
