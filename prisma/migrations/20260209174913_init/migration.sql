-- CreateTable
CREATE TABLE "UserState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'demo-user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "glucose" INTEGER NOT NULL,
    "moment" TEXT NOT NULL,
    "symptoms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
