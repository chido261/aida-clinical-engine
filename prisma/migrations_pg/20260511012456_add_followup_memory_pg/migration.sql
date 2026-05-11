-- AlterTable
ALTER TABLE "UserState" ADD COLUMN     "lastEventAt" TIMESTAMP(3),
ADD COLUMN     "lastEventType" TEXT,
ADD COLUMN     "lastRecommendation" TEXT,
ADD COLUMN     "pendingFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "pendingFollowUpType" TEXT;
