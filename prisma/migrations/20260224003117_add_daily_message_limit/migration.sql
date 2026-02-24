-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "dailyMsgDate" TEXT NOT NULL DEFAULT '',
    "dailyMsgCount" INTEGER NOT NULL DEFAULT 0,
    "baselineA1c" REAL,
    "baselineAvgGlucose" INTEGER,
    "baselineSetAt" DATETIME
);
INSERT INTO "new_UserState" ("baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "id", "updatedAt") SELECT "baselineA1c", "baselineAvgGlucose", "baselineSetAt", "createdAt", "id", "updatedAt" FROM "UserState";
DROP TABLE "UserState";
ALTER TABLE "new_UserState" RENAME TO "UserState";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
