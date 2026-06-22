// app/lib/aida/aidaBrain.ts

import {
  interpretAidaClinicalText,
  getPrimaryReading,
  type AidaClinicalInterpretation,
} from "@/app/lib/aida/clinicalInterpreter";

import {
  classifyAidaReadings,
  type AidaClinicalClassification,
} from "@/app/lib/aida/clinicalClassifier";

import {
  buildAidaAdvisorDecision,
  mapAidaMomentToLegacyMoment,
  type AidaAdvisorDecision,
} from "@/app/lib/aida/aidaDecisionEngine";

import {
  buildAidaContext,
  type AidaContext,
} from "@/app/lib/aida/aidaContextBuilder";

import {
  evaluateGlucoseSemaforo,
  type SemaforoResult,
} from "@/app/lib/aida/semaforoModule";

import {
  buildConversationPlan,
  type AidaConversationPlan,
} from "@/app/lib/aida/conversationManager";

export type AidaBrainIntent =
  | "GLUCOSE_REPORT"
  | "MEAL_IDEAS"
  | "MEAL_REVIEW"
  | "PROTOCOL_QUESTION"
  | "PROGRESS_REVIEW"
  | "GENERAL_MESSAGE";

export type AidaBrainPriority = "LOW" | "MEDIUM" | "HIGH";

export type AidaBrainDecision = {
  intent: AidaBrainIntent;
  priority: AidaBrainPriority;
  shouldSaveReading: boolean;
  shouldOpenFollowUp: boolean;
  shouldCloseFollowUp: boolean;
  needsMoreInfo: boolean;
  missingInfo: string | null;
  responseGoal: string;
};

export type AidaBrainResult = {
  userId: string;
  text: string;
  context: AidaContext;
  clinical: {
    interpretation: AidaClinicalInterpretation;
    classification: AidaClinicalClassification;
    advisorDecision: AidaAdvisorDecision;
  };
  semaforo: SemaforoResult | null;
  decision: AidaBrainDecision;
  conversationPlan: AidaConversationPlan;
};

export async function runAidaBrain(params: {
  userId: string;
  text: string;
  historyPlain?: string;
}): Promise<AidaBrainResult> {
  const { userId, text, historyPlain = "" } = params;

  const context = await buildAidaContext({ userId });

  const interpretation = interpretAidaClinicalText(text);

  const classification = classifyAidaReadings({
    readings: interpretation.readings,
    symptoms: interpretation.symptoms,
  });

  const advisorDecision = buildAidaAdvisorDecision({
    text,
    historyPlain,
    interpretation,
    userState: {
      activeProtocol: context.profile.activeProtocol,
      activePhase: context.profile.activePhase,
      clinicalState: context.followUp.clinicalState,
      lastEventType: context.followUp.lastEventType,
      pendingFollowUpType: context.followUp.pendingFollowUpType,
    },
  });

  const primaryReading = getPrimaryReading(interpretation);

  const semaforo = primaryReading
    ? evaluateGlucoseSemaforo({
        glucose: primaryReading.glucose,
        moment: mapAidaMomentToLegacyMoment(primaryReading.moment),
        hasSymptoms: interpretation.symptoms.length > 0,
      })
    : null;

  const decision = buildBrainDecision({
    text,
    interpretation,
    advisorDecision,
    semaforo,
  });

  const brainResultWithoutPlan: Omit<AidaBrainResult, "conversationPlan"> = {
    userId,
    text,
    context,
    clinical: {
      interpretation,
      classification,
      advisorDecision,
    },
    semaforo,
    decision,
  };

  const conversationPlan = buildConversationPlan(brainResultWithoutPlan as AidaBrainResult);

  return {
    ...brainResultWithoutPlan,
    conversationPlan,
  };
}

function buildBrainDecision(params: {
  text: string;
  interpretation: AidaClinicalInterpretation;
  advisorDecision: AidaAdvisorDecision;
  semaforo: SemaforoResult | null;
}): AidaBrainDecision {
  const { text, interpretation, advisorDecision, semaforo } = params;

  const intent = detectIntent({
    text,
    interpretation,
    advisorDecision,
  });

  if (semaforo?.priority === "HIGH") {
    return {
      intent,
      priority: "HIGH",
      shouldSaveReading: advisorDecision.shouldSaveReading,
      shouldOpenFollowUp: true,
      shouldCloseFollowUp: false,
      needsMoreInfo: false,
      missingInfo: null,
      responseGoal:
        "Priorizar seguridad clínica, explicar el semáforo rojo y dar acción inmediata.",
    };
  }

  if (advisorDecision.needsMomentClarification) {
    return {
      intent,
      priority: "MEDIUM",
      shouldSaveReading: advisorDecision.shouldSaveReading,
      shouldOpenFollowUp: false,
      shouldCloseFollowUp: false,
      needsMoreInfo: true,
      missingInfo: "Momento de la lectura",
      responseGoal:
        "Pedir una sola aclaración: si fue en ayunas, postcomida o antes de dormir.",
    };
  }

  if (advisorDecision.shouldCloseClinicalEvent) {
    return {
      intent,
      priority: "LOW",
      shouldSaveReading: advisorDecision.shouldSaveReading,
      shouldOpenFollowUp: false,
      shouldCloseFollowUp: true,
      needsMoreInfo: false,
      missingInfo: null,
      responseGoal: "Cerrar seguimiento activo y reforzar estabilidad.",
    };
  }

  if (advisorDecision.shouldOpenClinicalEvent || semaforo?.needsFollowUp) {
    return {
      intent,
      priority: semaforo?.priority ?? "MEDIUM",
      shouldSaveReading: advisorDecision.shouldSaveReading,
      shouldOpenFollowUp: true,
      shouldCloseFollowUp: false,
      needsMoreInfo: advisorDecision.needsMealContext,
      missingInfo: advisorDecision.needsMealContext
        ? "Contexto de comida"
        : null,
      responseGoal:
        "Dar orientación breve, personalizada y abrir seguimiento si corresponde.",
    };
  }

  return {
    intent,
    priority: semaforo?.priority ?? "LOW",
    shouldSaveReading: advisorDecision.shouldSaveReading,
    shouldOpenFollowUp: false,
    shouldCloseFollowUp: false,
    needsMoreInfo: false,
    missingInfo: null,
    responseGoal:
      "Responder de forma personalizada usando perfil, progreso, fase actual y contexto reciente.",
  };
}

function detectIntent(params: {
  text: string;
  interpretation: AidaClinicalInterpretation;
  advisorDecision: AidaAdvisorDecision;
}): AidaBrainIntent {
  const { text, interpretation, advisorDecision } = params;
  const normalized = text.toLowerCase();

  if (interpretation.readings.length > 0) {
    return "GLUCOSE_REPORT";
  }

  if (
    /\b(idea|ideas|opciones|platillos|comidas|men[uú]|desayuno|comida|cena)\b/i.test(
      normalized
    )
  ) {
    return "MEAL_IDEAS";
  }

  if (
    advisorDecision.responseIntent === "MEAL_REVIEW" ||
    /\b(com[ií]|desayun[eé]|cen[eé]|almorc[eé]|mi plato|lo que com[ií])\b/i.test(
      normalized
    )
  ) {
    return "MEAL_REVIEW";
  }

  if (
    /\b(protocolo|fase|fase 1|fase 2|fase 3|avanzar|retroceder)\b/i.test(
      normalized
    )
  ) {
    return "PROTOCOL_QUESTION";
  }

  if (
    /\b(c[oó]mo voy|progreso|promedio|tendencia|a1c|glicosilada|resumen)\b/i.test(
      normalized
    )
  ) {
    return "PROGRESS_REVIEW";
  }

  return "GENERAL_MESSAGE";
}