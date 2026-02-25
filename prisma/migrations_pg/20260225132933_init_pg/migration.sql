-- CreateTable
CREATE TABLE "UserState" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "baselineA1c" DOUBLE PRECISION,
    "baselineAvgGlucose" INTEGER,
    "baselineSetAt" TIMESTAMP(3),
    "dailyMsgDate" TEXT,
    "dailyMsgCount" INTEGER,
    "totalMsgCount" INTEGER NOT NULL DEFAULT 0,
    "lastMsgAt" TIMESTAMP(3),
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "licenseStatus" TEXT NOT NULL DEFAULT 'trial',
    "phoneE164" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "UserState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "glucose" INTEGER NOT NULL,
    "moment" TEXT NOT NULL,
    "symptoms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageDaily" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "dateLocal" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "licenseStatus" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageDaily_userId_dateLocal_key" ON "UsageDaily"("userId", "dateLocal");
