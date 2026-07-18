ALTER TABLE "UserState"
ADD COLUMN IF NOT EXISTS "protocolVersion" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "UserState" ADD COLUMN IF NOT EXISTS "medicationReductionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "UserState" ADD COLUMN IF NOT EXISTS "medicationReductionConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Reading"
ADD COLUMN IF NOT EXISTS "readingSlot" TEXT;

CREATE INDEX IF NOT EXISTS "Reading_readingSlot_idx" ON "Reading"("readingSlot");

CREATE TABLE IF NOT EXISTS "WeeklyProtocolReview" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "protocolVersion" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "expectedReadings" INTEGER NOT NULL,
  "recordedReadings" INTEGER NOT NULL,
  "controlledReadings" INTEGER NOT NULL,
  "completionPercent" DOUBLE PRECISION NOT NULL,
  "controlledPercent" DOUBLE PRECISION NOT NULL,
  "fastingAverage" DOUBLE PRECISION,
  "otherAverage" DOUBLE PRECISION,
  "minimumGlucose" INTEGER,
  "maximumGlucose" INTEGER,
  "hypoglycemiaCount" INTEGER NOT NULL DEFAULT 0,
  "passed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyProtocolReview_userId_phase_weekStart_key" ON "WeeklyProtocolReview"("userId", "phase", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyProtocolReview_userId_reviewedAt_idx" ON "WeeklyProtocolReview"("userId", "reviewedAt");
CREATE INDEX IF NOT EXISTS "WeeklyProtocolReview_phase_passed_idx" ON "WeeklyProtocolReview"("phase", "passed");
