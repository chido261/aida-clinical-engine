-- AlterTable
ALTER TABLE "UserState" ADD COLUMN     "clinicalState" TEXT,
ADD COLUMN     "dailySummaryCount" INTEGER,
ADD COLUMN     "dailySummaryDate" TEXT,
ADD COLUMN     "fullEndsAt" TIMESTAMP(3),
ADD COLUMN     "fullStartedAt" TIMESTAMP(3);
