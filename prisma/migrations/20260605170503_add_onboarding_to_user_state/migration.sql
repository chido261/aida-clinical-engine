-- AlterTable
ALTER TABLE "UserState" ADD COLUMN "age" INTEGER;
ALTER TABLE "UserState" ADD COLUMN "diagnosis" TEXT;
ALTER TABLE "UserState" ADD COLUMN "fastingPeakMgDl" INTEGER;
ALTER TABLE "UserState" ADD COLUMN "heightCm" REAL;
ALTER TABLE "UserState" ADD COLUMN "meds" TEXT;
ALTER TABLE "UserState" ADD COLUMN "name" TEXT;
ALTER TABLE "UserState" ADD COLUMN "onboardingDoneAt" DATETIME;
ALTER TABLE "UserState" ADD COLUMN "postMealPeakMgDl" INTEGER;
ALTER TABLE "UserState" ADD COLUMN "wakeTime" TEXT;
ALTER TABLE "UserState" ADD COLUMN "weightKg" REAL;

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "plan" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "deviceId" TEXT,
    "activationCodeId" INTEGER,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "approvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentDeviceId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'payment',
    "lastPaymentId" INTEGER,
    "fullStartedAt" DATETIME,
    "fullEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phoneE164" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "activationCodeId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_providerRef_idx" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_phoneE164_idx" ON "Payment"("phoneE164");

-- CreateIndex
CREATE INDEX "Payment_activationCodeId_idx" ON "Payment"("activationCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE INDEX "ActivationCode_phoneE164_idx" ON "ActivationCode"("phoneE164");

-- CreateIndex
CREATE INDEX "ActivationCode_status_idx" ON "ActivationCode"("status");

-- CreateIndex
CREATE INDEX "ActivationCode_currentDeviceId_idx" ON "ActivationCode"("currentDeviceId");

-- CreateIndex
CREATE INDEX "ActivationCode_lastPaymentId_idx" ON "ActivationCode"("lastPaymentId");

-- CreateIndex
CREATE INDEX "DeviceSession_phoneE164_idx" ON "DeviceSession"("phoneE164");

-- CreateIndex
CREATE INDEX "DeviceSession_deviceId_idx" ON "DeviceSession"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceSession_activationCodeId_idx" ON "DeviceSession"("activationCodeId");

-- CreateIndex
CREATE INDEX "DeviceSession_active_idx" ON "DeviceSession"("active");

-- CreateIndex
CREATE INDEX "Reading_userId_idx" ON "Reading"("userId");

-- CreateIndex
CREATE INDEX "Reading_createdAt_idx" ON "Reading"("createdAt");

-- CreateIndex
CREATE INDEX "UsageDaily_userId_idx" ON "UsageDaily"("userId");

-- CreateIndex
CREATE INDEX "UserState_phoneE164_idx" ON "UserState"("phoneE164");

-- CreateIndex
CREATE INDEX "UserState_licenseStatus_idx" ON "UserState"("licenseStatus");

-- CreateIndex
CREATE INDEX "UserState_onboardingDoneAt_idx" ON "UserState"("onboardingDoneAt");
