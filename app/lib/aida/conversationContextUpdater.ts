// app/lib/aida/conversationContextUpdater.ts

import type { AidaBrainResult } from "@/app/lib/aida/aidaBrain";
import {
  getConversationContext,
  updateConversationContext,
} from "@/app/lib/aida/conversationContextMemory";
import { analyzeConversationContext } from "@/app/lib/aida/conversationContextAnalyzer";

function compactText(text: string | null | undefined, maxLength = 700) {
  if (!text) return null;

  const clean = text
    .replace(/\s+/g, " ")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  if (!clean) return null;

  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function mergeLines(
  existing: string | null | undefined,
  next: string | null,
  maxLines = 6
) {
  const lines = [
    ...(existing ? existing.split("\n") : []),
    ...(next ? [next] : []),
  ]
    .map((line) => line.trim())
    .filter(Boolean);

  return Array.from(new Set(lines)).slice(-maxLines).join("\n") || null;
}

export async function updateAidaConversationContextAfterResponse(params: {
  brainResult: AidaBrainResult;
  reply: string;
}) {
  const { brainResult, reply } = params;

  const userId = brainResult.userId;
  const existing = await getConversationContext(userId);
  const analysis = analyzeConversationContext(brainResult);

  return updateConversationContext({
    userId,
    clinicalSummary:
      analysis.clinicalSummary ?? existing?.clinicalSummary ?? null,

    activeGlucoseTopics: mergeLines(
      existing?.activeGlucoseTopics,
      analysis.activeGlucoseTopic
    ),

    currentGoal:
      existing?.currentGoal ?? analysis.currentGoal,

    detectedPatterns: mergeLines(
      existing?.detectedPatterns,
      analysis.detectedPattern
    ),

    medicationContext:
      analysis.medicationContext ?? existing?.medicationContext ?? null,

    lastConcern:
      analysis.lastConcern ?? existing?.lastConcern ?? null,

    lastAidaRecommendation:
      compactText(reply, 700),

    pendingConversationFollowUp:
      analysis.pendingFollowUp,

    metadataJson:
      analysis.metadataJson,
  });
}