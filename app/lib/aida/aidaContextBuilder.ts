// app/lib/aida/aidaContextBuilder.ts

import {
  ensureUserState,
  getLastReading,
  getRecentReadings,
  getLastMealLog,
  getLastOpenClinicalEvent,
} from "@/app/lib/aidaMemory";

import {
  getProgressMetrics,
  buildProgressContext,
  type ProgressMetrics,
} from "@/app/lib/aidaProgress";

import { getConversationContext } from "@/app/lib/aida/conversationContextMemory";

export type AidaContextProfile = {
  userId: string;
  name: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  diagnosis: string | null;
  meds: string | null;
  fastingPeakMgDl: number | null;
  postMealPeakMgDl: number | null;
  wakeTime: string | null;
  baselineA1c: number | null;
  baselineAvgGlucose: number | null;
  activeProtocol: string;
  activePhase: string;
  currentNutritionGoal: string | null;
};

export type AidaContextFollowUp = {
  clinicalState: string | null;
  lastEventType: string | null;
  lastEventAt: Date | null;
  pendingFollowUpType: string | null;
  pendingFollowUpAt: Date | null;
  lastRecommendation: string | null;
  lastOpenClinicalEvent: any | null;
};

export type AidaContextConversation = {
  clinicalSummary: string | null;
  activeGlucoseTopics: string | null;
  currentGoal: string | null;
  detectedPatterns: string | null;
  medicationContext: string | null;
  lastConcern: string | null;
  lastAidaRecommendation: string | null;
  pendingConversationFollowUp: string | null;
  metadataJson: string | null;
};

export type AidaContext = {
  profile: AidaContextProfile;
  followUp: AidaContextFollowUp;
  conversation: AidaContextConversation;
  lastReading: any | null;
  recentReadings: any[];
  lastMeal: any | null;
  progressMetrics: ProgressMetrics;
  progressContext: string;
};

export async function buildAidaContext(params: {
  userId: string;
}): Promise<AidaContext> {
  const { userId } = params;

  const userState = await ensureUserState(userId);

  const [
    lastReading,
    recentReadings,
    lastMeal,
    lastOpenClinicalEvent,
    progressMetrics,
    conversationContext,
  ] = await Promise.all([
    getLastReading(userId),
    getRecentReadings(userId, 14),
    getLastMealLog(userId),
    getLastOpenClinicalEvent(userId),
    getProgressMetrics(userId),
    getConversationContext(userId),
  ]);

  const progressContext = buildProgressContext(progressMetrics);

  return {
    profile: {
      userId,
      name: userState.name ?? null,
      age: userState.age ?? null,
      heightCm: userState.heightCm ?? null,
      weightKg: userState.weightKg ?? null,
      diagnosis: userState.diagnosis ?? null,
      meds: userState.meds ?? null,
      fastingPeakMgDl: userState.fastingPeakMgDl ?? null,
      postMealPeakMgDl: userState.postMealPeakMgDl ?? null,
      wakeTime: userState.wakeTime ?? null,
      baselineA1c: userState.baselineA1c ?? null,
      baselineAvgGlucose: userState.baselineAvgGlucose ?? null,
      activeProtocol: userState.activeProtocol ?? "PROTOCOL_1",
      activePhase: userState.activePhase ?? "FASE_1",
      currentNutritionGoal: userState.currentNutritionGoal ?? null,
    },

    followUp: {
      clinicalState: userState.clinicalState ?? null,
      lastEventType: userState.lastEventType ?? null,
      lastEventAt: userState.lastEventAt ?? null,
      pendingFollowUpType: userState.pendingFollowUpType ?? null,
      pendingFollowUpAt: userState.pendingFollowUpAt ?? null,
      lastRecommendation: userState.lastRecommendation ?? null,
      lastOpenClinicalEvent,
    },

    conversation: {
      clinicalSummary: conversationContext?.clinicalSummary ?? null,
      activeGlucoseTopics: conversationContext?.activeGlucoseTopics ?? null,
      currentGoal: conversationContext?.currentGoal ?? null,
      detectedPatterns: conversationContext?.detectedPatterns ?? null,
      medicationContext: conversationContext?.medicationContext ?? null,
      lastConcern: conversationContext?.lastConcern ?? null,
      lastAidaRecommendation:
        conversationContext?.lastAidaRecommendation ?? null,
      pendingConversationFollowUp:
        conversationContext?.pendingConversationFollowUp ?? null,
      metadataJson: conversationContext?.metadataJson ?? null,
    },

    lastReading,
    recentReadings,
    lastMeal,
    progressMetrics,
    progressContext,
  };
}