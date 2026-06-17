-- AlterTable
ALTER TABLE "Reading" ADD COLUMN "eventType" TEXT;
ALTER TABLE "Reading" ADD COLUMN "nutritionGoal" TEXT;
ALTER TABLE "Reading" ADD COLUMN "relatedMealId" INTEGER;

-- CreateTable
CREATE TABLE "ClinicalEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "glucoseAtOpen" INTEGER,
    "glucoseAtClose" INTEGER,
    "moment" TEXT,
    "nutritionGoal" TEXT,
    "pendingFollowUpType" TEXT,
    "lastRecommendation" TEXT,
    "resolutionNote" TEXT
);

-- CreateTable
CREATE TABLE "MealLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mealMoment" TEXT,
    "rawText" TEXT NOT NULL,
    "detectedFoods" TEXT,
    "protocolAllowedFoods" TEXT,
    "protocolExcludedFoods" TEXT,
    "activeProtocol" TEXT NOT NULL DEFAULT 'PROTOCOL_1',
    "activePhase" TEXT NOT NULL DEFAULT 'FASE_1',
    "protocolCompliant" BOOLEAN,
    "nutritionGoal" TEXT,
    "relatedReadingId" INTEGER,
    "advisorNote" TEXT
);

-- CreateTable
CREATE TABLE "ProtocolProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "stableDaysCount" INTEGER NOT NULL DEFAULT 0,
    "postMealInRangeCount" INTEGER NOT NULL DEFAULT 0,
    "fastingInRangeCount" INTEGER NOT NULL DEFAULT 0,
    "hypoEventsCount" INTEGER NOT NULL DEFAULT 0,
    "highEventsCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleForNextProtocol" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "heightCm" REAL,
    "weightKg" REAL,
    "diagnosis" TEXT,
    "meds" TEXT,
    "fastingPeakMgDl" INTEGER,
    "postMealPeakMgDl" INTEGER,
    "wakeTime" TEXT,
    "onboardingDoneAt" DATETIME,
    "baselineA1c" REAL,
    "baselineAvgGlucose" INTEGER,
    "baselineSetAt" DATETIME,
    "activeProtocol" TEXT NOT NULL DEFAULT 'PROTOCOL_1',
    "activePhase" TEXT NOT NULL DEFAULT 'FASE_1',
    "protocolStartedAt" DATETIME,
    "eligibleForNextProtocol" BOOLEAN NOT NULL DEFAULT false,
    "protocolReviewReason" TEXT,
    "dailyMsgDate" TEXT,
    "dailyMsgCount" INTEGER,
    "totalMsgCount" INTEGER NOT NULL DEFAULT 0,
    "lastMsgAt" DATETIME,
    "trialStartedAt" DATETIME,
    "trialEndsAt" DATETIME,
    "licenseStatus" TEXT NOT NULL DEFAULT 'trial',
    "fullStartedAt" DATETIME,
    "fullEndsAt" DATETIME,
    "activePlan" TEXT,
    "activePlanSource" TEXT,
    "phoneE164" TEXT,
    "phoneVerifiedAt" DATETIME,
    "clinicalState" TEXT,
    "lastEventType" TEXT,
    "lastEventAt" DATETIME,
    "pendingFollowUpType" TEXT,
    "pendingFollowUpAt" DATETIME,
    "lastRecommendation" TEXT,
    "currentNutritionGoal" TEXT,
    "dailySummaryDate" TEXT,
    "dailySummaryCount" INTEGER
);
INSERT INTO "new_UserState" ("activePlan", "activePlanSource", "age", "baselineA1c", "baselineAvgGlucose", "baselineSetAt", "clinicalState", "createdAt", "dailyMsgCount", "dailyMsgDate", "dailySummaryCount", "dailySummaryDate", "diagnosis", "fastingPeakMgDl", "fullEndsAt", "fullStartedAt", "heightCm", "id", "lastEventAt", "lastEventType", "lastMsgAt", "lastRecommendation", "licenseStatus", "meds", "name", "onboardingDoneAt", "pendingFollowUpAt", "pendingFollowUpType", "phoneE164", "phoneVerifiedAt", "postMealPeakMgDl", "totalMsgCount", "trialEndsAt", "trialStartedAt", "updatedAt", "wakeTime", "weightKg") SELECT "activePlan", "activePlanSource", "age", "baselineA1c", "baselineAvgGlucose", "baselineSetAt", "clinicalState", "createdAt", "dailyMsgCount", "dailyMsgDate", "dailySummaryCount", "dailySummaryDate", "diagnosis", "fastingPeakMgDl", "fullEndsAt", "fullStartedAt", "heightCm", "id", "lastEventAt", "lastEventType", "lastMsgAt", "lastRecommendation", "licenseStatus", "meds", "name", "onboardingDoneAt", "pendingFollowUpAt", "pendingFollowUpType", "phoneE164", "phoneVerifiedAt", "postMealPeakMgDl", "totalMsgCount", "trialEndsAt", "trialStartedAt", "updatedAt", "wakeTime", "weightKg" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
CREATE INDEX "UserState_phoneE164_idx" ON "UserState"("phoneE164");
CREATE INDEX "UserState_licenseStatus_idx" ON "UserState"("licenseStatus");
CREATE INDEX "UserState_onboardingDoneAt_idx" ON "UserState"("onboardingDoneAt");
CREATE INDEX "UserState_activeProtocol_idx" ON "UserState"("activeProtocol");
CREATE INDEX "UserState_activePhase_idx" ON "UserState"("activePhase");
CREATE INDEX "UserState_clinicalState_idx" ON "UserState"("clinicalState");
CREATE INDEX "UserState_pendingFollowUpType_idx" ON "UserState"("pendingFollowUpType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ClinicalEvent_userId_idx" ON "ClinicalEvent"("userId");

-- CreateIndex
CREATE INDEX "ClinicalEvent_type_idx" ON "ClinicalEvent"("type");

-- CreateIndex
CREATE INDEX "ClinicalEvent_status_idx" ON "ClinicalEvent"("status");

-- CreateIndex
CREATE INDEX "ClinicalEvent_openedAt_idx" ON "ClinicalEvent"("openedAt");

-- CreateIndex
CREATE INDEX "MealLog_userId_idx" ON "MealLog"("userId");

-- CreateIndex
CREATE INDEX "MealLog_createdAt_idx" ON "MealLog"("createdAt");

-- CreateIndex
CREATE INDEX "MealLog_activeProtocol_idx" ON "MealLog"("activeProtocol");

-- CreateIndex
CREATE INDEX "MealLog_protocolCompliant_idx" ON "MealLog"("protocolCompliant");

-- CreateIndex
CREATE INDEX "MealLog_nutritionGoal_idx" ON "MealLog"("nutritionGoal");

-- CreateIndex
CREATE INDEX "ProtocolProgress_userId_idx" ON "ProtocolProgress"("userId");

-- CreateIndex
CREATE INDEX "ProtocolProgress_protocol_idx" ON "ProtocolProgress"("protocol");

-- CreateIndex
CREATE INDEX "ProtocolProgress_phase_idx" ON "ProtocolProgress"("phase");

-- CreateIndex
CREATE INDEX "ProtocolProgress_status_idx" ON "ProtocolProgress"("status");

-- CreateIndex
CREATE INDEX "Reading_moment_idx" ON "Reading"("moment");

-- CreateIndex
CREATE INDEX "Reading_eventType_idx" ON "Reading"("eventType");

-- CreateIndex
CREATE INDEX "Reading_nutritionGoal_idx" ON "Reading"("nutritionGoal");
