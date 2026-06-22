// app/lib/aida/gptPromptBuilder.ts

import type { AidaBrainResult } from "@/app/lib/aida/aidaBrain";

export type AidaGptPromptPayload = {
  systemPrompt: string;
  userPrompt: string;
};

function humanizeProtocol(protocol: string | null | undefined) {
  if (protocol === "PROTOCOL_1") return "plan actual";
  return protocol ?? "plan actual";
}

function humanizePhase(phase: string | null | undefined) {
  if (phase === "FASE_1") return "etapa actual";
  return phase ?? "etapa actual";
}

function buildConversationContextBlock(brainResult: AidaBrainResult) {
  const conversation = brainResult.context.conversation;

  const hasConversationContext =
    conversation.clinicalSummary ||
    conversation.activeGlucoseTopics ||
    conversation.currentGoal ||
    conversation.detectedPatterns ||
    conversation.medicationContext ||
    conversation.lastConcern ||
    conversation.lastAidaRecommendation ||
    conversation.pendingConversationFollowUp;

  if (!hasConversationContext) {
    return "No hay contexto conversacional glucémico persistente registrado.";
  }

  return [
    "Contexto conversacional glucémico persistente:",
    conversation.clinicalSummary
      ? `- Resumen clínico-conversacional: ${conversation.clinicalSummary}`
      : null,
    conversation.activeGlucoseTopics
      ? `- Temas activos sobre glucosa: ${conversation.activeGlucoseTopics}`
      : null,
    conversation.currentGoal
      ? `- Objetivo actual: ${conversation.currentGoal}`
      : null,
    conversation.detectedPatterns
      ? `- Patrones detectados: ${conversation.detectedPatterns}`
      : null,
    conversation.medicationContext
      ? `- Medicamentos/contexto farmacológico: ${conversation.medicationContext}`
      : null,
    conversation.lastConcern
      ? `- Última preocupación relevante: ${conversation.lastConcern}`
      : null,
    conversation.lastAidaRecommendation
      ? `- Última recomendación importante de AIDA: ${conversation.lastAidaRecommendation}`
      : null,
    conversation.pendingConversationFollowUp
      ? `- Pendiente conversacional: ${conversation.pendingConversationFollowUp}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildAidaGptPrompt(
  brainResult: AidaBrainResult
): AidaGptPromptPayload {
  const { text, context, decision, semaforo, conversationPlan } = brainResult;

  const systemPrompt = [
    "Eres AIDA, un asesor educativo y metabólico especializado en control de glucosa y diabetes tipo 2.",
    "",
    "Tu función es responder de forma profesional, clara, humana y accionable.",
    "",
    "Objetivo central de AIDA:",
    "- Ayudar al usuario a mejorar su control glucémico.",
    "- Apoyar la reducción de HbA1c hacia niveles normales cuando sea posible.",
    "- Acompañar patrones de glucosa, alimentación, adherencia, síntomas y seguimiento.",
    "- No ajustar medicamentos ni indicar dosis; cuando el tema sea farmacológico, orientar de forma educativa y segura.",
    "",
    "Reglas obligatorias:",
    "- No ajustes medicamentos.",
    "- No indiques dosis.",
    "- No sugieras suspender medicamentos.",
    "- No prometas curar diabetes.",
    "- No prometas retirar medicamentos.",
    "- No inventes datos del usuario.",
    "- No inventes lecturas, diagnósticos, HbA1c ni promedios.",
    "- No contradigas el protocolo activo.",
    "- No recomiendes alimentos fuera del protocolo activo.",
    "- No regañes.",
    "- No des demasiadas recomendaciones juntas.",
    "- Nunca muestres nombres internos como PROTOCOL_1, FASE_1, FASTING_ELEVATED o MILD_ELEVATION al usuario.",
    "- Haz máximo una pregunta útil al final si hace falta.",
    "- Si el momento de la lectura ya fue identificado por el sistema, nunca vuelvas a preguntar si fue en ayunas, antes de comer, después de comer o antes de dormir.",
    "- Si el usuario menciona 'antes de comer', 'antes de cenar' o 'antes del desayuno', considéralo una lectura preprandial válida.",
    "- Nunca solicites aclarar información que ya aparece en la decisión clínica o en el plan de conversación.",
    "- Si existe una lectura con momento identificado, enfócate en interpretar la lectura y orientar la siguiente acción.",
    "- Usa el contexto conversacional glucémico persistente solo si ayuda a responder mejor.",
    "- No menciones el contexto persistente como si fuera una base de datos; úsalo de forma natural.",
    "- Responde en español natural.",
    "",
    "Reglas de seguridad clínica:",
    "- Si hay hipoglucemia, prioriza seguridad y recuperación.",
    "- Si hay hiperglucemia severa, prioriza síntomas de alerta, hidratación y seguimiento.",
    "- No menciones médico, equipo médico o atención médica salvo que el semáforo sea rojo, haya síntomas de alerta, hipoglucemia, hiperglucemia severa o repetición persistente.",
    "- No conviertas una lectura amarilla aislada en una urgencia.",
    "",
    "Reglas nutricionales:",
    "- Si el usuario está en Protocolo 1, evita tortilla, pan, arroz, pasta, avena, maíz, papa, camote, jugos, azúcar, cereales y granos.",
    "- Si el objetivo es bajar glucosa, puedes sugerir proteína, grasas saludables, vegetales con fibra, hidratación y caminata ligera solo si es seguro.",
    "- Si el objetivo es mantener glucosa, refuerza consistencia del protocolo.",
    "- Si el objetivo es subir glucosa, atiende primero la baja y luego estabiliza.",
    "",
    "Personalidad adaptativa:",
    "- Profesional siempre.",
    "- Educativa cuando expliques.",
    "- Directa cuando haya riesgo.",
    "- Empática si el usuario está preocupado.",
    "- Tranquilizadora si la situación no es urgente.",
    "- Práctica cuando pida acciones, comidas o menús.",
  ].join("\n");

  const userPrompt = [
    "Mensaje original del usuario:",
    text,
    "",
    "Contexto del usuario:",
    `- Nombre: ${context.profile.name ?? "No registrado"}`,
    `- Diagnóstico: ${context.profile.diagnosis ?? "No registrado"}`,
    `- Medicamentos: ${context.profile.meds ?? "No registrado"}`,
    `- HbA1c registrada: ${context.profile.baselineA1c ?? "No registrada"}`,
    `- Promedio base registrado: ${context.profile.baselineAvgGlucose ?? "No registrado"}`,
    `- Plan del usuario: ${humanizeProtocol(context.profile.activeProtocol)}`,
    `- Etapa del usuario: ${humanizePhase(context.profile.activePhase)}`,
    "",
    buildConversationContextBlock(brainResult),
    "",
    "Progreso:",
    context.progressContext,
    "",
    "Decisión del Cerebro:",
    `- Intención: ${decision.intent}`,
    `- Prioridad: ${decision.priority}`,
    `- Objetivo de respuesta: ${decision.responseGoal}`,
    `- Debe guardar lectura: ${decision.shouldSaveReading ? "Sí" : "No"}`,
    `- Debe abrir seguimiento: ${decision.shouldOpenFollowUp ? "Sí" : "No"}`,
    `- Debe cerrar seguimiento: ${decision.shouldCloseFollowUp ? "Sí" : "No"}`,
    `- Falta información: ${decision.needsMoreInfo ? "Sí" : "No"}`,
    `- Información faltante: ${decision.missingInfo ?? "Ninguna"}`,
    "",
    "Semáforo:",
    semaforo
      ? [
          `- Color: ${semaforo.color}`,
          `- Tipo de riesgo: ${semaforo.riskType}`,
          `- Prioridad: ${semaforo.priority}`,
          `- Etiqueta: ${semaforo.label}`,
          `- Explicación: ${semaforo.explanation}`,
          `- Acción recomendada: ${semaforo.recommendedAction}`,
        ].join("\n")
      : "- No aplica",
    "",
    "Plan de conversación:",
    `- Tono: ${conversationPlan.tone.join(", ")}`,
    `- Tema principal: ${conversationPlan.mainTopic}`,
    `- Acción sugerida: ${conversationPlan.suggestedAction ?? "Ninguna"}`,
    `- Pregunta a realizar: ${conversationPlan.questionToAsk ?? "Ninguna"}`,
    "",
    "Datos que debes mencionar si son relevantes:",
    conversationPlan.mustMention.map((item) => `- ${item}`).join("\n"),
    "",
    "Cosas que debes evitar:",
    conversationPlan.shouldAvoid.map((item) => `- ${item}`).join("\n"),
    "",
    "Instrucción final:",
    "Redacta una respuesta breve, coherente, personalizada y útil para el usuario.",
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
  };
}