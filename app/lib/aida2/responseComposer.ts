// app/lib/aida2/responseComposer.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import type { Aida2ConversationStrategy } from "@/app/lib/aida2/conversationStrategy";
import type { Aida2ContextModuleOutput } from "@/app/lib/aida2/modules/contextModule";
import type { Aida2MealModuleOutput } from "@/app/lib/aida2/moduleRunner";

export function buildAida2ComposerPrompt(params: {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
  contextModule?: Aida2ContextModuleOutput;
  mealModule?: Aida2MealModuleOutput;
  conversationStrategy?: Aida2ConversationStrategy;
}) {
  const {
    workPlan,
    history,
    userMessage,
    contextModule,
    mealModule,
    conversationStrategy,
  } = params;

  return [
    workPlan.purpose,
    "",
    "Personalidad de AIDA:",
    workPlan.personality,
    "",
    "Comprensión del mensaje:",
    `- Intención: ${workPlan.understanding.intent}`,
    `- Glucosa mencionada: ${
      workPlan.understanding.mentionedGlucose ?? "No mencionada"
    }`,
    "",
    "Pensamiento del Cerebro:",
    `- Objetivo del usuario: ${workPlan.thinking.userGoal}`,
    `- Objetivo clínico: ${workPlan.thinking.clinicalGoal}`,
    `- Acción principal: ${workPlan.thinking.mainAction}`,
    "",
    "Estrategia conversacional:",
    conversationStrategy
      ? [
          `- Objetivo de estilo: ${conversationStrategy.styleGoal}`,
          "Debe seguir:",
          conversationStrategy.mustFollow.map((item) => `- ${item}`).join("\n"),
          "Debe evitar:",
          conversationStrategy.mustAvoid.map((item) => `- ${item}`).join("\n"),
          "Pistas de lenguaje natural:",
          conversationStrategy.naturalLanguageHints
            .map((item) => `- ${item}`)
            .join("\n"),
        ].join("\n")
      : "Sin estrategia conversacional disponible.",
    "",
    "Información entregada por contextModule:",
    contextModule
      ? [
          `- Resumen: ${contextModule.summary}`,
          "Contexto relevante:",
          contextModule.relevantContext ?? "Sin contexto relevante.",
        ].join("\n")
      : "contextModule no ejecutado.",
    "",
    "Información entregada por MealSpecialist:",
    mealModule
      ? [
          `- Tipo de comida detectado: ${mealModule.mealType}`,
          "Recomendación base:",
          mealModule.recommendation,
          "",
          "Instrucción:",
          "- Usa esta recomendación como base principal de la respuesta.",
          "- Puedes mejorar la redacción, pero no agregues alimentos fuera de la recomendación.",
          "- No inventes porcentajes, fases ni restricciones adicionales.",
        ].join("\n")
      : "MealSpecialist no ejecutado.",
    "",
    "Plan de seguridad:",
    `- Riesgo: ${workPlan.safety.riskLevel}`,
    `- Requiere foco inmediato de seguridad: ${
      workPlan.safety.requiresImmediateSafetyFocus ? "Sí" : "No"
    }`,
    `- Razón: ${workPlan.safety.safetyReason ?? "No aplica"}`,
    workPlan.safety.limits.map((item) => `- ${item}`).join("\n"),
    "",
    "Plan de respuesta:",
    `- Tono: ${workPlan.responsePlan.tone.join(", ")}`,
    `- Longitud: ${workPlan.responsePlan.length}`,
    "Debe hacer:",
    workPlan.responsePlan.mustDo.map((item) => `- ${item}`).join("\n"),
    "Debe evitar:",
    workPlan.responsePlan.mustAvoid.map((item) => `- ${item}`).join("\n"),
    "",
    "Formato visual obligatorio:",
    [
      "- Escribe en bloques cortos.",
      "- Usa doble salto de línea entre ideas diferentes.",
      "- Si das 2 o más opciones, usa lista numerada.",
      "- No escribas una respuesta completa en un solo bloque largo.",
    ].join("\n"),
    "",
    "Historial reciente:",
    history || "Sin historial disponible.",
    "",
    "Mensaje actual del usuario:",
    userMessage,
    "",
    "Instrucción final:",
    [
      "Redacta una respuesta natural para el usuario.",
      "No expliques el plan interno.",
      "No menciones módulos internos.",
      "Si hay recomendación de MealSpecialist, úsala como base.",
      "No agregues reglas de protocolo que no estén en la recomendación base.",
      "Cierra con una acción concreta.",
    ].join(" "),
  ].join("\n");
}