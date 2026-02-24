-- CreateTable
CREATE TABLE "UsageDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "dateLocal" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "licenseStatus" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "baselineA1c" REAL,
    "baselineAvgGlucose" INTEGER,
    "baselineSetAt" DATETIME,
    "dailyMsgDate" TEXT,
    "dailyMsgCount" INTEGER,
    "totalMsgCount" INTEGER NOT NULL DEFAULT 0,
    "lastMsgAt" DATETIME,
    "trialStartedAt" DATETIME,
    "trialEndsAt" DATETIME,
    "licenseStatus" TEXT NOT NULL DEFAULT 'trial',
    "phoneE164" TEXT,
    "phoneVerifiedAt" DATETIME
);
INSERT INTO "new_UserState" ("baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "dailyMsgCount", "dailyMsgDate", "id", "licenseStatus", "phoneE164", "phoneVerifiedAt", "trialEndsAt", "trialStartedAt", "updatedAt") SELECT "baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "dailyMsgCount", "dailyMsgDate", "id", "licenseStatus", "phoneE164", "phoneVerifiedAt", "trialEndsAt", "trialStartedAt", "updatedAt" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UsageDaily_userId_dateLocal_key" ON "UsageDaily"("userId", "dateLocal");
