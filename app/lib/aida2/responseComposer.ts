// app/lib/aida2/responseComposer.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";

export function buildAida2ComposerPrompt(params: {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
}) {
  const { workPlan, history, userMessage } = params;

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
    "Decisión del Cerebro:",
    `- Prioridad: ${workPlan.decision.priority}`,
    `- Objetivo de respuesta: ${workPlan.decision.responseGoal}`,
    `- Módulos a consultar: ${workPlan.decision.modulesToRun.join(", ")}`,
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
    "Historial reciente:",
    history || "Sin historial disponible.",
    "",
    "Mensaje actual del usuario:",
    userMessage,
    "",
    "Instrucción final:",
    "Redacta una respuesta natural para el usuario. No expliques el plan interno. No menciones módulos, intención detectada ni decisiones internas.",
  ].join("\n");
}