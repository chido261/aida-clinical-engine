// app/lib/aida2/responseComposer.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import type { Aida2ConversationStrategy } from "@/app/lib/aida2/conversationStrategy";
import type { Aida2ContextModuleOutput } from "@/app/lib/aida2/modules/contextModule";

export function buildAida2ComposerPrompt(params: {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
  contextModule?: Aida2ContextModuleOutput;
  conversationStrategy?: Aida2ConversationStrategy;
}) {
  const {
    workPlan,
    history,
    userMessage,
    contextModule,
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
    `- Pregunta por contexto previo: ${
      workPlan.understanding.asksForPreviousContext ? "Sí" : "No"
    }`,
    "",
    "Pensamiento del Cerebro:",
    `- Objetivo del usuario: ${workPlan.thinking.userGoal}`,
    `- Objetivo clínico: ${workPlan.thinking.clinicalGoal}`,
    `- Acción principal: ${workPlan.thinking.mainAction}`,
    `- Principio de decisión: ${workPlan.thinking.decisionPrinciple}`,
    "",
    "Contexto que AIDA utilizará:",
    workPlan.thinking.knownContextToUse.map((item) => `- ${item}`).join("\n"),
    "",
    "Información faltante:",
    workPlan.thinking.missingInformation.length
      ? workPlan.thinking.missingInformation
          .map((item) => `- ${item}`)
          .join("\n")
      : "- Ninguna",
    "",
    "Información adicional requerida:",
    workPlan.thinking.extraDataNeeded.length
      ? workPlan.thinking.extraDataNeeded
          .map((item) => `- ${item}`)
          .join("\n")
      : "- Ninguna",
    "",
    `Observación detectada: ${
      workPlan.thinking.newRelevantObservation ?? "Ninguna"
    }`,
    "",
    "Decisión del Cerebro:",
    `- Prioridad: ${workPlan.decision.priority}`,
    `- Objetivo de respuesta: ${workPlan.decision.responseGoal}`,
    `- Módulos a consultar: ${workPlan.decision.modulesToRun.join(", ")}`,
    "",
    "Estrategia conversacional:",
    conversationStrategy
      ? [
          `- Objetivo de estilo: ${conversationStrategy.styleGoal}`,
          "Orden de respuesta:",
          conversationStrategy.responseOrder
            .map((item) => `- ${item}`)
            .join("\n"),
          "Debe seguir:",
          conversationStrategy.mustFollow.map((item) => `- ${item}`).join("\n"),
          "Debe evitar:",
          conversationStrategy.mustAvoid.map((item) => `- ${item}`).join("\n"),
          "Pistas de lenguaje natural:",
          conversationStrategy.naturalLanguageHints
            .map((item) => `- ${item}`)
            .join("\n"),
          `Cierre conversacional: ${conversationStrategy.closingStyle}`,
        ].join("\n")
      : "Sin estrategia conversacional disponible.",
    "",
    "Información entregada por contextModule:",
    contextModule
      ? [
          `- Debe usar historial: ${
            contextModule.shouldUseHistory ? "Sí" : "No"
          }`,
          `- Tiene historial: ${contextModule.hasHistory ? "Sí" : "No"}`,
          `- Resumen: ${contextModule.summary}`,
          "Notas:",
          contextModule.notes.map((item) => `- ${item}`).join("\n"),
          "Contexto relevante:",
          contextModule.relevantContext ?? "Sin contexto relevante.",
        ].join("\n")
      : "contextModule no ejecutado.",
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
    `Cierre: ${workPlan.responsePlan.closingInstruction}`,
    "",
    "Formato visual obligatorio:",
    [
      "- La respuesta debe verse clara dentro de una burbuja de chat.",
      "- Escribe en bloques cortos.",
      "- Cada bloque debe tener máximo 1 o 2 oraciones.",
      "- Usa doble salto de línea entre bloques.",
      "- No escribas más de 3 líneas seguidas sin separar.",
      "- Si explicas un medicamento, separa en bloques: qué es, para qué sirve, cuidado principal.",
      "- Si das 2 o más opciones, usa lista numerada.",
      "- Cada opción debe ir en su propia línea.",
      "- No juntes varias opciones en un solo párrafo.",
      "- Evita respuestas tipo párrafo de libro.",
      "- Prefiere frases cortas y fáciles de escanear.",
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
      "No menciones módulos, intención detectada, decisiones internas ni estrategia conversacional.",
      "Responde como AIDA, no como sistema.",
      "Usa formato limpio de chat.",
      "Separa las ideas con doble salto de línea.",
      "No escribas una respuesta completa en un solo bloque largo.",
      "No uses párrafos largos.",
      "Cierra con una acción concreta, no con una pregunta automática.",
      "Solo termina con pregunta si realmente falta un dato indispensable para responder.",
      "Evita frases tipo: '¿Quieres que te ayude...?', '¿Quieres que te sugiera...?' o '¿Quieres que armemos...?' cuando ya diste una recomendación útil.",
    ].join(" "),
  ].join("\n");
}