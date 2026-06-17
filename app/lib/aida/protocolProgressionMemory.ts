// app/lib/aida/protocolProgressionMemory.ts

import { prisma } from "@/app/lib/prisma";
import { evaluateProtocolProgression } from "@/app/lib/aida/protocolProgressionEngine";
import { ensureProtocolProgress } from "@/app/lib/aidaMemory";

export async function evaluateAndSaveProtocolProgression(params: {
  userId: string;
  activeProtocol?: string | null;
  activePhase?: string | null;
}) {
  const activeProtocol = params.activeProtocol || "PROTOCOL_1";
  const activePhase = params.activePhase || "FASE_1";

  const readings = await prisma.reading.findMany({
    where: {
      userId: params.userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 40,
    select: {
      glucose: true,
      moment: true,
      createdAt: true,
    },
  });

  const decision = evaluateProtocolProgression({
    currentProtocol: activeProtocol,
    currentPhase: activePhase,
    readings,
  });

  const progress = await ensureProtocolProgress({
    userId: params.userId,
    protocol: activeProtocol,
    phase: activePhase,
  });

  await prisma.protocolProgress.update({
    where: { id: progress.id },
    data: {
      stableDaysCount: decision.stableDaysCount,
      fastingInRangeCount: decision.fastingInRangeCount,
      postMealInRangeCount: decision.postMealInRangeCount,
      hypoEventsCount: decision.hypoEventsCount,
      highEventsCount: decision.highEventsCount,
      eligibleForNextProtocol: decision.canAdvance,
      reviewReason: decision.reason,
    },
  });

  await prisma.userState.update({
    where: { id: params.userId },
    data: {
      eligibleForNextProtocol: decision.canAdvance,
      protocolReviewReason: decision.reason,
    },
  });

  return decision;
}