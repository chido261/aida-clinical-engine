// app/lib/aida/aidaDecisionEngine.ts

import type {
  AidaClinicalInterpretation,
  AidaReadingMoment,
  AidaDetectedSymptom,
} from "@/app/lib/aida/clinicalInterpreter";

export type AidaLegacyMoment =
  | "AYUNO"
  | "ANTES_COMER"
  | "POSTCOMIDA"
  | "NOCHE"
  | "RECUPERACION_HIPO"
  | "POSTMEAL_RECOVERY"
  | "DESCONOCIDO";

export type AidaClinicalEventType =
  | "HYPOGLYCEMIA"
  | "HYPOGLYCEMIA_RESOLVED"
  | "POSTMEAL_ELEVATED"
  | "POSTMEAL_WALK_RECHECK"
  | "POSTMEAL_WALK_RESOLVED"
  | "FASTING_HIGH"
  | "FASTING_ELEVATED"
  | "FASTING_IN_RANGE"
  | "POSTMEAL_IN_RANGE"
  | "STABLE_READING"
  | "UNKNOWN_READING"
  | "NONE";

export type AidaNutritionGoal =
  | "LOWER_GLUCOSE"
  | "MAINTAIN_GLUCOSE"
  | "RAISE_GLUCOSE"
  | "STABILIZE"
  | "REVIEW_MEAL"
  | "NONE";

export type AidaFollowUpAction =
  | "OPEN_HYPO_RECHECK"
  | "OPEN_HYPO_STABILITY_RECHECK"
  | "OPEN_POSTMEAL_PLATE_REVIEW"
  | "OPEN_POSTMEAL_WALK_RECHECK"
  | "CLOSE_HYPO_FOLLOWUP"
  | "CLOSE_POSTMEAL_FOLLOWUP"
  | "ASK_MOMENT"
  | "ASK_MEAL_CONTEXT"
  | "NONE";

export type AidaResponseIntent =
  | "SAFETY_HYPO"
  | "HYPO_RECOVERY"
  | "POSTMEAL_ELEVATED_FIRST"
  | "POSTMEAL_ELEVATED_WITH_MEAL"
  | "POSTMEAL_RECOVERY_AFTER_WALK"
  | "FASTING_REVIEW"
  | "STABLE_READING_COACHING"
  | "MOMENT_CLARIFICATION"
  | "MEAL_REVIEW"
  | "GENERAL_COACHING";

export type AidaAdvisorDecision = {
  primaryGlucose: number | null;
  readingMoment: AidaLegacyMoment;
  detectedSymptoms: AidaDetectedSymptom[];

  clinicalEvent: AidaClinicalEventType;
  nutritionGoal: AidaNutritionGoal;
  followUpAction: AidaFollowUpAction;
  responseIntent: AidaResponseIntent;

  shouldSaveReading: boolean;
  shouldOpenClinicalEvent: boolean;
  shouldCloseClinicalEvent: boolean;

  activeProtocol: string;
  activePhase: string;

  needsMomentClarification: boolean;
  needsMealContext: boolean;

  reason: string;
};

export function mapAidaMomentToLegacyMoment(
  moment: AidaReadingMoment
): AidaLegacyMoment {
  if (moment === "FASTING") return "AYUNO";
  if (moment === "POST_MEAL") return "POSTCOMIDA";
  if (moment === "BEDTIME") return "NOCHE";
  return "DESCONOCIDO";
}

function hasSevereSymptoms(symptoms: AidaDetectedSymptom[]) {
  return (
    symptoms.includes("CHEST_OR_BREATHING") ||
    symptoms.includes("CONFUSION_OR_FAINTING") ||
    symptoms.includes("SEVERE_WEAKNESS") ||
    symptoms.includes("VOMITING")
  );
}

function detectMealMention(text: string) {
  return /(com[ií]|comida|desayun[eé]|desayuno|cen[eé]|cena|almorc[eé]|almuerzo|pollo|ensalada|arroz|jugo|carne|huevo|pescado|at[uú]n|queso|verdura|verduras|nopal|frijol|frijoles|pan|pasta|papa|camote|tortilla|tortillas)/i.test(
    text
  );
}

function detectWalkMention(text: string) {
  return /(camin[eé]|caminar|caminata|fui a caminar|ya camin[eé]|ya camine)/i.test(
    text
  );
}

export function buildAidaAdvisorDecision(params: {
  text: string;
  historyPlain?: string;
  interpretation: AidaClinicalInterpretation;
  userState?: {
    activeProtocol?: string | null;
    activePhase?: string | null;
    clinicalState?: string | null;
    lastEventType?: string | null;
    pendingFollowUpType?: string | null;
  } | null;
}): AidaAdvisorDecision {
  const { text, historyPlain = "", interpretation, userState } = params;

  const activeProtocol = userState?.activeProtocol || "PROTOCOL_1";
  const activePhase = userState?.activePhase || "FASE_1";

  const primaryReading =
    interpretation.readings.length > 0
      ? interpretation.readings[interpretation.readings.length - 1]
      : null;

  const primaryGlucose = primaryReading?.glucose ?? null;
  const readingMoment = primaryReading
    ? mapAidaMomentToLegacyMoment(primaryReading.moment)
    : "DESCONOCIDO";

  const symptoms = interpretation.symptoms;
  const severeSymptoms = hasSevereSymptoms(symptoms);
  const hasMealMention = detectMealMention(text);
  const hasWalkMention = detectWalkMention(text);

  const pendingFollowUpType = userState?.pendingFollowUpType ?? null;
  const clinicalState = userState?.clinicalState ?? null;

  if (primaryGlucose === null) {
    const saysWillWalkAfterPostmeal =
      /(ir[eé] a caminar|voy a caminar|saldr[eé] a caminar|caminar[eé]|har[eé] una caminata|más tarde te cuento|mas tarde te cuento)/i.test(
        text
      );

    const hasRecentPostmealElevatedContext =
      pendingFollowUpType === "POSTMEAL_PLATE_REVIEW" ||
      pendingFollowUpType === "POSTMEAL_WALK_RECHECK" ||
      userState?.lastEventType === "POSTMEAL_ELEVATED" ||
      /postcomida|despu[eé]s de comer|lectura est[aá] por arriba|glucosa est[aá] por arriba|hidr[aá]tate|caminata ligera/i.test(
        historyPlain
      );

    if (saysWillWalkAfterPostmeal && hasRecentPostmealElevatedContext) {
      return {
        primaryGlucose,
        readingMoment,
        detectedSymptoms: symptoms,
        clinicalEvent: "POSTMEAL_WALK_RECHECK",
        nutritionGoal: "LOWER_GLUCOSE",
        followUpAction: "OPEN_POSTMEAL_WALK_RECHECK",
        responseIntent: "GENERAL_COACHING",
        shouldSaveReading: false,
        shouldOpenClinicalEvent: true,
        shouldCloseClinicalEvent: false,
        activeProtocol,
        activePhase,
        needsMomentClarification: false,
        needsMealContext: false,
        reason:
          "Usuario confirma que hará caminata después de una lectura postcomida elevada.",
      };
    }

    return {
      primaryGlucose,
      readingMoment,
      detectedSymptoms: symptoms,
      clinicalEvent: "NONE",
      nutritionGoal: "NONE",
      followUpAction: "NONE",
      responseIntent: hasMealMention ? "MEAL_REVIEW" : "GENERAL_COACHING",
      shouldSaveReading: false,
      shouldOpenClinicalEvent: false,
      shouldCloseClinicalEvent: false,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: false,
      reason: "Mensaje sin lectura de glucosa.",
    };
  }

  if (primaryGlucose < 70 || severeSymptoms) {
    return {
      primaryGlucose,
      readingMoment,
      detectedSymptoms: symptoms,
      clinicalEvent: "HYPOGLYCEMIA",
      nutritionGoal: "RAISE_GLUCOSE",
      followUpAction: "OPEN_HYPO_RECHECK",
      responseIntent: "SAFETY_HYPO",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: true,
      shouldCloseClinicalEvent: false,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: false,
      reason: "Lectura baja o síntomas de alerta.",
    };
  }

  if (
    primaryGlucose >= 90 &&
    (clinicalState === "HYPO_ACTIVE" ||
      clinicalState === "RECOVERING_FROM_HYPO" ||
      pendingFollowUpType === "HYPO_RECHECK_15MIN" ||
      pendingFollowUpType === "HYPO_STABILITY_RECHECK")
  ) {
    return {
      primaryGlucose,
      readingMoment: "RECUPERACION_HIPO",
      detectedSymptoms: symptoms,
      clinicalEvent: "HYPOGLYCEMIA_RESOLVED",
      nutritionGoal: "STABILIZE",
      followUpAction: "CLOSE_HYPO_FOLLOWUP",
      responseIntent: "HYPO_RECOVERY",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: false,
      shouldCloseClinicalEvent: true,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: false,
      reason: "Seguimiento de hipoglucemia resuelto con lectura estable.",
    };
  }

  if (pendingFollowUpType === "POSTMEAL_WALK_RECHECK" && hasWalkMention) {
    return {
      primaryGlucose,
      readingMoment: "POSTMEAL_RECOVERY",
      detectedSymptoms: symptoms,
      clinicalEvent: "POSTMEAL_WALK_RESOLVED",
      nutritionGoal: "MAINTAIN_GLUCOSE",
      followUpAction: "CLOSE_POSTMEAL_FOLLOWUP",
      responseIntent: "POSTMEAL_RECOVERY_AFTER_WALK",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: false,
      shouldCloseClinicalEvent: true,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: false,
      reason: "Usuario reporta nueva lectura después de caminar.",
    };
  }

  if (readingMoment === "POSTCOMIDA") {
    if (primaryGlucose >= 141) {
      return {
        primaryGlucose,
        readingMoment,
        detectedSymptoms: symptoms,
        clinicalEvent: "POSTMEAL_ELEVATED",
        nutritionGoal: "LOWER_GLUCOSE",
        followUpAction: hasMealMention
          ? "OPEN_POSTMEAL_WALK_RECHECK"
          : "OPEN_POSTMEAL_PLATE_REVIEW",
        responseIntent: hasMealMention
          ? "POSTMEAL_ELEVATED_WITH_MEAL"
          : "POSTMEAL_ELEVATED_FIRST",
        shouldSaveReading: true,
        shouldOpenClinicalEvent: true,
        shouldCloseClinicalEvent: false,
        activeProtocol,
        activePhase,
        needsMomentClarification: false,
        needsMealContext: !hasMealMention,
        reason: "Lectura postcomida elevada.",
      };
    }

    return {
      primaryGlucose,
      readingMoment,
      detectedSymptoms: symptoms,
      clinicalEvent: "POSTMEAL_IN_RANGE",
      nutritionGoal: "MAINTAIN_GLUCOSE",
      followUpAction: hasMealMention ? "NONE" : "ASK_MEAL_CONTEXT",
      responseIntent: "STABLE_READING_COACHING",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: false,
      shouldCloseClinicalEvent: false,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: !hasMealMention,
      reason: "Lectura postcomida en rango saludable.",
    };
  }

  if (readingMoment === "AYUNO") {
    const fastingEvent =
      primaryGlucose >= 126
        ? "FASTING_HIGH"
        : primaryGlucose >= 101
          ? "FASTING_ELEVATED"
          : "FASTING_IN_RANGE";

    const nutritionGoal =
      primaryGlucose >= 101 ? "LOWER_GLUCOSE" : "MAINTAIN_GLUCOSE";

    return {
      primaryGlucose,
      readingMoment,
      detectedSymptoms: symptoms,
      clinicalEvent: fastingEvent,
      nutritionGoal,
      followUpAction: "NONE",
      responseIntent: "FASTING_REVIEW",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: primaryGlucose >= 126,
      shouldCloseClinicalEvent: false,
      activeProtocol,
      activePhase,
      needsMomentClarification: false,
      needsMealContext: false,
      reason:
        primaryGlucose >= 126
          ? "Lectura en ayuno alta."
          : primaryGlucose >= 101
            ? "Lectura en ayuno ligeramente elevada."
            : "Lectura en ayuno dentro de rango saludable.",
    };
  }

  if (readingMoment === "DESCONOCIDO") {
    return {
      primaryGlucose,
      readingMoment,
      detectedSymptoms: symptoms,
      clinicalEvent: "UNKNOWN_READING",
      nutritionGoal: "NONE",
      followUpAction: "ASK_MOMENT",
      responseIntent: "MOMENT_CLARIFICATION",
      shouldSaveReading: true,
      shouldOpenClinicalEvent: false,
      shouldCloseClinicalEvent: false,
      activeProtocol,
      activePhase,
      needsMomentClarification: true,
      needsMealContext: false,
      reason: "Lectura con momento desconocido.",
    };
  }

  return {
    primaryGlucose,
    readingMoment,
    detectedSymptoms: symptoms,
    clinicalEvent: "STABLE_READING",
    nutritionGoal: "MAINTAIN_GLUCOSE",
    followUpAction: "NONE",
    responseIntent: "STABLE_READING_COACHING",
    shouldSaveReading: true,
    shouldOpenClinicalEvent: false,
    shouldCloseClinicalEvent: false,
    activeProtocol,
    activePhase,
    needsMomentClarification: false,
    needsMealContext: false,
    reason: "Lectura estable general.",
  };
}