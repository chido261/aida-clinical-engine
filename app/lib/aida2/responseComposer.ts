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
          "",
          "VALIDACIÓN Y BASE DEL ESPECIALISTA:",
          mealModule.recommendation,
          "",
          "REGLAS OBLIGATORIAS PARA REDACTAR CUANDO EXISTE MealSpecialist:",
          "- MealSpecialist no es una respuesta programada; es la validación nutricional que debes respetar.",
          "- Redacta de forma natural usando esa validación como límite.",
          "- No inventes recetas completas si MealSpecialist no las entregó.",
          "- No des 2, 3 o más opciones aunque el usuario las pida, a menos que MealSpecialist haya entregado opciones múltiples validadas.",
          "- Si MealSpecialist entregó una sola base culinaria compatible, responde con una sola opción.",
          "- No agregues alimentos, ingredientes, guarniciones, salsas, limón, aderezos, tostadas, tortillas, pan, arroz, papa, frutas, semillas ni acompañamientos que no estén validados por MealSpecialist o por el protocolo.",
          "- No uses alimentos genéricos como 'verduras frescas' si no están especificados como alimentos permitidos.",
          "- No conviertas un alimento no recomendado en permitido por combinarlo con proteína o grasa.",
          "- Si el usuario pregunta por un alimento no recomendado, responde sobre ese alimento y conserva el contexto de la conversación.",
          "- Si el usuario pregunta si puede agregar algo a un platillo anterior, no sugieras un platillo nuevo.",
          "- Si el usuario señala una contradicción previa, reconoce el error de forma breve y corrige según el protocolo.",
          "- Mantén el propósito de la fase: ayudar al usuario a observar el impacto de sus alimentos en el glucómetro.",
          "- No menciones módulos internos, MealSpecialist, Composer, Cerebro ni protocolo como sistema interno.",
          "- No cierres con preguntas automáticas.",
        ].join("\n")
      : "MealSpecialist no ejecutado.",
    "",
    "Continuidad conversacional obligatoria:",
    [
      "- Usa el historial reciente para entender si el mensaje actual es seguimiento de una comida anterior.",
      "- Frases como 'y si le agrego', 'y si le pongo', 'esa opción', 'la opción 2', 'entonces', 'ok y ahora', '¿por qué me dijiste...?' indican continuidad.",
      "- Si el usuario pregunta por agregar un alimento, interpreta que quiere agregarlo al platillo o comida que ya se venía hablando.",
      "- No respondas como si fuera una pregunta aislada cuando hay un contexto alimentario inmediato.",
      "- Si el usuario pregunta por un segundo alimento no recomendado después de otro alimento no recomendado, puedes comparar de forma natural su impacto glucémico sin inventar datos numéricos.",
      "- Si el nuevo alimento tiene mayor carga glucémica que el alimento anterior, explica que se aleja más del objetivo de la fase.",
      "- Evita frases que contradigan la decisión nutricional, como 'si ya lo vas a agregar' cuando el alimento no se recomienda.",
      "- En alimentos no recomendados, usa lenguaje claro: 'no te lo recomiendo en esta fase', 'mejor no salirte del protocolo ahorita', o equivalente natural.",
      "- Si el usuario ya tenía una base compatible, mantén esa base y solo ajusta el elemento consultado.",
      "- No propongas un platillo nuevo a menos que el usuario lo pida.",
    ].join("\n"),
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
      "- Si das 2 o más opciones, usa lista numerada solo cuando esas opciones estén validadas.",
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
    mealModule
      ? [
          "Redacta una respuesta natural para el usuario.",
          "No expliques el plan interno.",
          "No menciones módulos internos.",
          "Obedece la validación de MealSpecialist como límite principal.",
          "Usa el historial reciente para conservar continuidad.",
          "No respondas como conversación nueva si el mensaje actual depende del anterior.",
          "No agregues alimentos, ingredientes, recetas ni acompañamientos no validados.",
          "Si el usuario pidió varias recetas pero solo hay una base validada, entrega una sola opción compatible.",
          "Si el usuario pregunta por un alimento no recomendado, responde directamente sobre ese alimento y conserva el contexto.",
          "Si el usuario pregunta por agregar papa, arroz, tostada, pan, tortilla, avena o pasta a una comida ya planteada, explica que en esta fase no conviene salir del protocolo porque puede elevar la carga glucémica.",
          "Cierra con una acción concreta relacionada con mantener la comida dentro del protocolo o medir glucosa, no con una pregunta automática.",
        ].join(" ")
      : [
          "Redacta una respuesta natural para el usuario.",
          "No expliques el plan interno.",
          "No menciones módulos internos.",
          "Usa el historial reciente para conservar continuidad cuando aplique.",
          "Cierra con una acción concreta.",
        ].join(" "),
  ].join("\n");
}