// app/lib/aida/aidaDecisionMemory.ts

import { prisma } from "@/app/lib/prisma";
import {
  saveReading,
  openClinicalEvent,
  closeLastClinicalEvent,
  ensureProtocolProgress,
} from "@/app/lib/aidaMemory";
import type { AidaAdvisorDecision } from "@/app/lib/aida/aidaDecisionEngine";

function mapSymptomsToLegacy(symptoms: string[]) {
  const result: string[] = [];

  if (
    symptoms.includes("LOW_SYMPTOMS") ||
    symptoms.includes("SEVERE_WEAKNESS") ||
    symptoms.includes("CONFUSION_OR_FAINTING")
  ) {
    result.push("low_symptoms");
  }

  if (symptoms.includes("VOMITING")) {
    result.push("vomiting");
  }

  if (symptoms.includes("CHEST_OR_BREATHING")) {
    result.push("respiratory_or_chest");
  }

  return Array.from(new Set(result));
}

function getClinicalStateFromDecision(decision: AidaAdvisorDecision) {
  if (decision.clinicalEvent === "HYPOGLYCEMIA") {
    return "HYPO_ACTIVE";
  }

  if (decision.clinicalEvent === "POSTMEAL_ELEVATED") {
    return "POSTMEAL_ELEVATED";
  }

  if (
    decision.clinicalEvent === "HYPOGLYCEMIA_RESOLVED" ||
    decision.clinicalEvent === "POSTMEAL_WALK_RESOLVED"
  ) {
    return null;
  }

  return undefined;
}

function getPendingFollowUpTypeFromDecision(decision: AidaAdvisorDecision) {
  if (decision.followUpAction === "OPEN_HYPO_RECHECK") {
    return "HYPO_RECHECK_15MIN";
  }

  if (decision.followUpAction === "OPEN_HYPO_STABILITY_RECHECK") {
    return "HYPO_STABILITY_RECHECK";
  }

  if (decision.followUpAction === "OPEN_POSTMEAL_PLATE_REVIEW") {
    return "POSTMEAL_PLATE_REVIEW";
  }

  if (decision.followUpAction === "OPEN_POSTMEAL_WALK_RECHECK") {
    return "POSTMEAL_WALK_RECHECK";
  }

  if (
    decision.followUpAction === "CLOSE_HYPO_FOLLOWUP" ||
    decision.followUpAction === "CLOSE_POSTMEAL_FOLLOWUP"
  ) {
    return null;
  }

  return undefined;
}

function buildDefaultRecommendation(decision: AidaAdvisorDecision) {
  if (decision.followUpAction === "OPEN_HYPO_RECHECK") {
    return "Aplicar protocolo 15-15 y volver a medir en 15 minutos.";
  }

  if (decision.followUpAction === "OPEN_POSTMEAL_PLATE_REVIEW") {
    return "Revisar qué comió el usuario para relacionarlo con la lectura postcomida.";
  }

  if (decision.followUpAction === "OPEN_POSTMEAL_WALK_RECHECK") {
    return "Hidratarse con agua natural, no agregar más carbohidratos por ahora y caminar ligero 10–15 minutos si se siente bien.";
  }

  return null;
}

export async function applyAidaDecisionToMemory(params: {
  userId: string;
  decision: AidaAdvisorDecision;
}) {
  const { userId, decision } = params;

  await ensureProtocolProgress({
    userId,
    protocol: decision.activeProtocol,
    phase: decision.activePhase,
  });

  let savedReadingId: number | null = null;

  if (decision.shouldSaveReading && decision.primaryGlucose !== null) {
    const reading = await saveReading({
      userId,
      glucose: decision.primaryGlucose,
      moment: decision.readingMoment,
      symptoms: mapSymptomsToLegacy(decision.detectedSymptoms),
      eventType: decision.clinicalEvent,
      nutritionGoal: decision.nutritionGoal,
    });

    savedReadingId = reading.id;
  }

  if (decision.shouldOpenClinicalEvent && decision.clinicalEvent !== "NONE") {
    await openClinicalEvent({
      userId,
      type: decision.clinicalEvent,
      glucoseAtOpen: decision.primaryGlucose,
      moment: decision.readingMoment,
      nutritionGoal: decision.nutritionGoal,
      pendingFollowUpType: getPendingFollowUpTypeFromDecision(decision) ?? null,
      lastRecommendation: buildDefaultRecommendation(decision),
    });
  }

  if (decision.shouldCloseClinicalEvent) {
    await closeLastClinicalEvent({
      userId,
      glucoseAtClose: decision.primaryGlucose,
      resolutionNote: decision.reason,
    });
  }

  const clinicalState = getClinicalStateFromDecision(decision);
  const pendingFollowUpType = getPendingFollowUpTypeFromDecision(decision);
  const lastRecommendation = buildDefaultRecommendation(decision);

  const shouldUpdateClinicalState = clinicalState !== undefined;
  const shouldUpdatePendingFollowUp = pendingFollowUpType !== undefined;

  if (
    shouldUpdateClinicalState ||
    shouldUpdatePendingFollowUp ||
    decision.clinicalEvent !== "NONE" ||
    decision.nutritionGoal !== "NONE"
  ) {
    await prisma.userState.update({
      where: { id: userId },
      data: {
        ...(shouldUpdateClinicalState ? { clinicalState } : {}),
        ...(decision.clinicalEvent !== "NONE"
          ? {
              lastEventType: decision.clinicalEvent,
              lastEventAt: new Date(),
            }
          : {}),
        ...(shouldUpdatePendingFollowUp
          ? {
              pendingFollowUpType,
              pendingFollowUpAt: pendingFollowUpType ? new Date() : null,
            }
          : {}),
        ...(lastRecommendation !== null || pendingFollowUpType === null
          ? { lastRecommendation }
          : {}),
        ...(decision.nutritionGoal !== "NONE"
          ? { currentNutritionGoal: decision.nutritionGoal }
          : {}),
      },
    });
  }

  return {
    savedReadingId,
  };
}