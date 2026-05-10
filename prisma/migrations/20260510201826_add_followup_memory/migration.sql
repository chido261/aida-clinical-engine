-- AlterTable
ALTER TABLE "UserState" ADD COLUMN "lastEventAt" DATETIME;
ALTER TABLE "UserState" ADD COLUMN "lastEventType" TEXT;
ALTER TABLE "UserState" ADD COLUMN "lastRecommendation" TEXT;
ALTER TABLE "UserState" ADD COLUMN "pendingFollowUpAt" DATETIME;
ALTER TABLE "UserState" ADD COLUMN "pendingFollowUpType" TEXT;
