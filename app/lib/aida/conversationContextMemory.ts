// app/lib/aida/conversationContextMemory.ts

import { prisma } from "@/app/lib/prisma";

export type AidaConversationContextInput = {
  userId: string;
  clinicalSummary?: string | null;
  activeGlucoseTopics?: string | null;
  currentGoal?: string | null;
  detectedPatterns?: string | null;
  medicationContext?: string | null;
  lastConcern?: string | null;
  lastAidaRecommendation?: string | null;
  pendingConversationFollowUp?: string | null;
  metadataJson?: string | null;
};

export async function getConversationContext(userId: string) {
  return prisma.conversationContext.findUnique({
    where: { userId },
  });
}

export async function ensureConversationContext(userId: string) {
  const existing = await getConversationContext(userId);

  if (existing) return existing;

  return prisma.conversationContext.create({
    data: {
      userId,
      clinicalSummary: null,
      activeGlucoseTopics: null,
      currentGoal: null,
      detectedPatterns: null,
      medicationContext: null,
      lastConcern: null,
      lastAidaRecommendation: null,
      pendingConversationFollowUp: null,
      metadataJson: null,
    },
  });
}

export async function updateConversationContext(
  input: AidaConversationContextInput
) {
  const { userId, ...data } = input;

  await ensureConversationContext(userId);

  return prisma.conversationContext.update({
    where: { userId },
    data: {
      ...(data.clinicalSummary !== undefined && {
        clinicalSummary: data.clinicalSummary,
      }),
      ...(data.activeGlucoseTopics !== undefined && {
        activeGlucoseTopics: data.activeGlucoseTopics,
      }),
      ...(data.currentGoal !== undefined && {
        currentGoal: data.currentGoal,
      }),
      ...(data.detectedPatterns !== undefined && {
        detectedPatterns: data.detectedPatterns,
      }),
      ...(data.medicationContext !== undefined && {
        medicationContext: data.medicationContext,
      }),
      ...(data.lastConcern !== undefined && {
        lastConcern: data.lastConcern,
      }),
      ...(data.lastAidaRecommendation !== undefined && {
        lastAidaRecommendation: data.lastAidaRecommendation,
      }),
      ...(data.pendingConversationFollowUp !== undefined && {
        pendingConversationFollowUp: data.pendingConversationFollowUp,
      }),
      ...(data.metadataJson !== undefined && {
        metadataJson: data.metadataJson,
      }),
    },
  });
}