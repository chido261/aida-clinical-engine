// app/lib/aida/conversationContextAnalyzer.ts

import type { AidaBrainResult } from "@/app/lib/aida/aidaBrain";

export type AidaConversationContextAnalysis = {
  clinicalSummary: string | null;
  activeGlucoseTopic: string | null;
  currentGoal: string | null;
  detectedPattern: string | null;
  medicationContext: string | null;
  lastConcern: string | null;
  pendingFollowUp: string | null;
  metadataJson: string;
};

function compact(text: string | null | undefined, maxLength = 900) {
  if (!text) return null;

  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

function detectConcern(text: string) {
  if (/(antojo|ansiedad|ganas de|se me antoja|hambre)/i.test(text)) {
    return compact("El usuario reporta antojo, ansiedad o hambre que puede afectar adherencia al protocolo.");
  }

  if (/(preocupa|miedo|temor|asusta|nervios|estres|estrés)/i.test(text)) {
    return compact("El usuario expresa preocupación o estrés relacionado con su control glucémico.");
  }

  if (/(no pude|fall[eé]|romp[ií]|me sal[ií]|com[ií] pan|com[ií] tortilla|com[ií] arroz|com[ií] dulce)/i.test(text)) {
    return compact("El usuario reporta dificultad de adherencia o consumo de alimento fuera del protocolo.");
  }

  return null;
}

function detectMedicationContext(brainResult: AidaBrainResult) {
  const meds = brainResult.context.profile.meds;
  const text = brainResult.text;

  if (meds) {
    return `Medicamentos registrados: ${meds}. AIDA debe orientar de forma educativa, sin ajustar dosis.`;
  }

  if (/(medicamento|medicina|metformina|insulina|glibenclamida|dapagliflozina|jardiance|galvus|ozempic|dosis)/i.test(text)) {
    return compact(`El usuario mencionó tema de medicamentos: "${text}". AIDA no debe ajustar dosis.`);
  }

  return null;
}

function buildGoal(brainResult: AidaBrainResult) {
  const a1c = brainResult.context.profile.baselineA1c;

  if (a1c != null && a1c > 5.6) {
    return "Reducir HbA1c hacia rango normal menor a 5.6 mediante control glucémico, alimentación, seguimiento y adherencia segura.";
  }

  if (brainResult.clinical.advisorDecision.nutritionGoal === "LOWER_GLUCOSE") {
    return "Reducir glucosa actual y evitar nuevos picos.";
  }

  if (brainResult.clinical.advisorDecision.nutritionGoal === "RAISE_GLUCOSE") {
    return "Recuperar glucosa a rango seguro y prevenir recaída de hipoglucemia.";
  }

  return "Mantener estabilidad glucémica y reforzar adherencia al protocolo activo.";
}

function buildActiveTopic(brainResult: AidaBrainResult) {
  const decision = brainResult.clinical.advisorDecision;

  if (decision.primaryGlucose != null) {
    return `Lectura actual: ${decision.primaryGlucose} mg/dL (${decision.readingMoment}). Evento clínico: ${decision.clinicalEvent}. Objetivo: ${decision.nutritionGoal}.`;
  }

  if (brainResult.decision.intent === "MEAL_IDEAS") {
    return "Solicitud de ideas de comida compatibles con el protocolo activo.";
  }

  if (brainResult.decision.intent === "MEAL_REVIEW") {
    return "Revisión de comida, adherencia o posible impacto glucémico.";
  }

  if (brainResult.decision.intent === "PROGRESS_REVIEW") {
    return "Revisión de progreso glucémico.";
  }

  if (brainResult.decision.intent === "PROTOCOL_QUESTION") {
    return "Consulta relacionada con protocolo o fase activa.";
  }

  return null;
}

function detectPattern(brainResult: AidaBrainResult) {
  const text = brainResult.text;
  const event = brainResult.clinical.advisorDecision.clinicalEvent;

  if (event === "HYPOGLYCEMIA") {
    return "Hipoglucemia detectada; requiere seguimiento de recuperación y prevención de recaída.";
  }

  if (event === "POSTMEAL_ELEVATED") {
    return "Elevación postcomida; revisar composición del plato, caminata e hidratación.";
  }

  if (event === "FASTING_HIGH" || event === "FASTING_ELEVATED") {
    return "Glucosa en ayuno elevada; vigilar tendencia matutina.";
  }

  if (event === "PREMEAL_ELEVATED") {
    return "Glucosa antes de comer elevada; orientar siguiente comida para evitar mayor carga glucémica.";
  }

  if (/(antojo|ansiedad|ganas de|se me antoja).*?(pan|tortilla|dulce|az[uú]car|galleta)/i.test(text)) {
    return "Posible patrón de antojos por alimentos de alta carga glucémica.";
  }

  if (/(noche|cenar|cena).*?(antojo|hambre|pan|dulce|tortilla)/i.test(text)) {
    return "Posible patrón nocturno de antojo o dificultad de adherencia.";
  }

  return null;
}

function buildPendingFollowUp(brainResult: AidaBrainResult) {
  const followUp = brainResult.clinical.advisorDecision.followUpAction;

  if (followUp === "OPEN_HYPO_RECHECK") {
    return "Confirmar nueva medición 15 minutos después del protocolo 15-15.";
  }

  if (followUp === "OPEN_HYPO_STABILITY_RECHECK") {
    return "Confirmar estabilidad después de recuperación de hipoglucemia.";
  }

  if (followUp === "OPEN_POSTMEAL_WALK_RECHECK") {
    return "Confirmar respuesta posterior a caminata ligera o nueva medición.";
  }

  if (followUp === "OPEN_POSTMEAL_PLATE_REVIEW") {
    return "Revisar qué comió el usuario para explicar elevación postcomida.";
  }

  if (brainResult.decision.needsMoreInfo && brainResult.decision.missingInfo) {
    return brainResult.decision.missingInfo;
  }

  return null;
}

export function analyzeConversationContext(brainResult: AidaBrainResult): AidaConversationContextAnalysis {
  const activeTopic = buildActiveTopic(brainResult);
  const pattern = detectPattern(brainResult);
  const pending = buildPendingFollowUp(brainResult);
  const concern = detectConcern(brainResult.text);
  const medication = detectMedicationContext(brainResult);

  const summaryParts = [
    brainResult.context.profile.baselineA1c != null
      ? `HbA1c registrada: ${brainResult.context.profile.baselineA1c}.`
      : null,
    brainResult.context.progressMetrics.avgLast7 != null
      ? `Promedio 7 días: ${brainResult.context.progressMetrics.avgLast7} mg/dL.`
      : null,
    activeTopic,
    pattern,
    pending ? `Pendiente: ${pending}.` : null,
  ].filter(Boolean);

  return {
    clinicalSummary: compact(summaryParts.join(" ")),
    activeGlucoseTopic: activeTopic,
    currentGoal: buildGoal(brainResult),
    detectedPattern: pattern,
    medicationContext: medication,
    lastConcern: concern,
    pendingFollowUp: pending,
    metadataJson: JSON.stringify({
      lastIntent: brainResult.decision.intent,
      lastPriority: brainResult.decision.priority,
      lastClinicalEvent: brainResult.clinical.advisorDecision.clinicalEvent,
      lastNutritionGoal: brainResult.clinical.advisorDecision.nutritionGoal,
      lastFollowUpAction: brainResult.clinical.advisorDecision.followUpAction,
      updatedAt: new Date().toISOString(),
    }),
  };
}