// app/lib/aida/mealMemoryManager.ts

import { saveMealLog } from "@/app/lib/aidaMemory";
import { analyzeMealByProtocol } from "@/app/lib/aida/nutritionAdvisorEngine";

export async function analyzeAndSaveMealFromText(params: {
  userId: string;
  text: string;
  activeProtocol: string;
  activePhase: string;
  nutritionGoal?: string | null;
  relatedReadingId?: number | null;
}) {
  const analysis = analyzeMealByProtocol({
    text: params.text,
    activeProtocol: params.activeProtocol,
    nutritionGoal: params.nutritionGoal,
  });

  if (analysis.detectedFoods.length === 0) {
    return {
      saved: false,
      analysis,
      mealLogId: null,
    };
  }

  const mealLog = await saveMealLog({
    userId: params.userId,
    rawText: params.text,
    mealMoment: analysis.mealMoment,
    detectedFoods: analysis.detectedFoods,
    protocolAllowedFoods: analysis.protocolAllowedFoods,
    protocolExcludedFoods: analysis.protocolExcludedFoods,
    activeProtocol: params.activeProtocol,
    activePhase: params.activePhase,
    protocolCompliant: analysis.protocolCompliant,
    nutritionGoal: params.nutritionGoal,
    relatedReadingId: params.relatedReadingId,
    advisorNote: analysis.guidance,
  });

  return {
    saved: true,
    analysis,
    mealLogId: mealLog.id,
  };
}