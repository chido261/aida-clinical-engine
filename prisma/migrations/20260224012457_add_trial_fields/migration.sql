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
    "trialStartedAt" DATETIME,
    "trialEndsAt" DATETIME,
    "licenseStatus" TEXT NOT NULL DEFAULT 'trial',
    "phoneE164" TEXT,
    "phoneVerifiedAt" DATETIME
);
INSERT INTO "new_UserState" ("baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "dailyMsgCount", "dailyMsgDate", "id", "updatedAt") SELECT "baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "dailyMsgCount", "dailyMsgDate", "id", "updatedAt" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
