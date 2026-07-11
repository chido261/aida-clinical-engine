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

  const foodContext = workPlan.foodContext;
  const modulePlan = workPlan.modulePlan;

  return [
    workPlan.purpose,
    "",
    "Personalidad de AIDA:",
    workPlan.personality,

    "",
    "Rol del Composer:",
    [
      "- Redactar la respuesta final para el usuario.",
      "- No tomar decisiones clínicas nuevas.",
      "- No clasificar alimentos por cuenta propia.",
      "- No inventar alimentos, recetas, ingredientes ni acompañamientos.",
      "- Respetar la dirección de Cerebro y la validación de los módulos especializados.",
      "- No mencionar módulos internos, WorkPlan, Cerebro, Composer ni MealSpecialist al usuario.",
    ].join("\n"),

    "",
    "Comprensión del mensaje por Cerebro:",
    [
      `- Intención: ${workPlan.understanding.intent}`,
      `- Glucosa mencionada: ${
        workPlan.understanding.mentionedGlucose ?? "No mencionada"
      }`,
      `- Menciona comida: ${
        workPlan.understanding.mentionsFood ? "Sí" : "No"
      }`,
      `- Menciona ejercicio: ${
        workPlan.understanding.mentionsExercise ? "Sí" : "No"
      }`,
      `- Menciona medicamento: ${
        workPlan.understanding.mentionsMedication ? "Sí" : "No"
      }`,
      `- Menciona protocolo: ${
        workPlan.understanding.mentionsProtocol ? "Sí" : "No"
      }`,
    ].join("\n"),

    "",
    "FoodContext definido por Cerebro:",
    foodContext.isFoodRelated
      ? [
          `- Es consulta alimentaria: Sí`,
          `- Modo de conversación: ${foodContext.conversationMode}`,
          `- Tipo de consulta: ${foodContext.questionType}`,
          `- Elemento consultado: ${foodContext.targetText ?? "No definido"}`,
          `- Necesita historial: ${foodContext.needsHistory ? "Sí" : "No"}`,
          `- Necesita protocolo: ${foodContext.needsProtocol ? "Sí" : "No"}`,
          `- Necesita especialista de comida: ${
            foodContext.needsMealSpecialist ? "Sí" : "No"
          }`,
          `- Validar preparación: ${
            foodContext.shouldValidatePreparation ? "Sí" : "No"
          }`,
          `- Foco de decisión: ${foodContext.decisionFocus}`,
        ].join("\n")
      : "No aplica.",

    "",
    "Plan de módulos definido por Cerebro:",
    [
      `- Ejecutar ContextModule: ${modulePlan.runContextModule ? "Sí" : "No"}`,
      `- Ejecutar ProtocolModule: ${modulePlan.runProtocol ? "Sí" : "No"}`,
      `- Ejecutar MealSpecialist: ${
        modulePlan.runMealSpecialist ? "Sí" : "No"
      }`,
      `- Ejecutar GlucoseModule: ${modulePlan.runGlucoseModule ? "Sí" : "No"}`,
      `- Ejecutar ExerciseModule: ${
        modulePlan.runExerciseModule ? "Sí" : "No"
      }`,
      `- Ejecutar MedicationModule: ${
        modulePlan.runMedicationModule ? "Sí" : "No"
      }`,
      `- Ejecutar SemaphoreModule: ${
        modulePlan.runSemaphoreModule ? "Sí" : "No"
      }`,
      `- Acción esperada del especialista de comida: ${modulePlan.expectedMealSpecialistAction}`,
    ].join("\n"),

    "",
    "Pensamiento del Cerebro:",
    [
      `- Objetivo del usuario: ${workPlan.thinking.userGoal}`,
      `- Objetivo clínico: ${workPlan.thinking.clinicalGoal}`,
      `- Acción principal: ${workPlan.thinking.mainAction}`,
      `- Principio de decisión: ${workPlan.thinking.decisionPrinciple}`,
      `- Observación relevante: ${
        workPlan.thinking.newRelevantObservation ?? "No aplica"
      }`,
    ].join("\n"),

    "",
    "Estrategia conversacional:",
    conversationStrategy
      ? [
          `- Objetivo de estilo: ${conversationStrategy.styleGoal}`,
          "",
          "Debe seguir:",
          conversationStrategy.mustFollow.map((item) => `- ${item}`).join("\n"),
          "",
          "Debe evitar:",
          conversationStrategy.mustAvoid.map((item) => `- ${item}`).join("\n"),
          "",
          "Pistas de lenguaje natural:",
          conversationStrategy.naturalLanguageHints
            .map((item) => `- ${item}`)
            .join("\n"),
        ].join("\n")
      : "Sin estrategia conversacional disponible.",

    "",
    "Información entregada por ContextModule:",
    contextModule
      ? [
          `- Resumen: ${contextModule.summary}`,
          "Contexto relevante:",
          contextModule.relevantContext ?? "Sin contexto relevante.",
        ].join("\n")
      : "ContextModule no ejecutado.",

    "",
    "Información entregada por MealSpecialist:",
    mealModule
      ? [
          `- Tipo de comida detectado: ${mealModule.mealType}`,
          `- Protocolo: ${mealModule.decision.protocolId}`,
          "",
          "DECISIÓN ESTRUCTURADA:",
          ...mealModule.decision.foods.map(
            (f) =>
              `- ${f.food}: ${f.status} | ${f.category} | ${f.reason}`
          ),
          "",
          "REGLAS OBLIGATORIAS:",
          mealModule.decision.hasNotAllowedFoods
            ? "- Si un alimento tiene estado NOT_ALLOWED, no convertirlo en permitido."
            : "- No hay alimentos prohibidos en esta decisión.",
          mealModule.decision.hasConditionalFoods
            ? "- Si un alimento tiene estado ALLOWED_WITH_VALIDATION, explicar la validación indicada por el protocolo."
            : "- No hay alimentos con validación en esta decisión.",
          mealModule.decision.shouldBuildRecipes
            ? "- Si el especialista construyó opciones, utilízalas sin inventar nuevas."
            : "- No inventar recetas u opciones adicionales.",
          "",
          "VALIDACIÓN TÉCNICA DEL ESPECIALISTA:",
          mealModule.recommendation,
        ].join("\n")
      : "MealSpecialist no ejecutado.",

    "",
    "Plan de seguridad:",
    [
      `- Riesgo: ${workPlan.safety.riskLevel}`,
      `- Requiere foco inmediato de seguridad: ${
        workPlan.safety.requiresImmediateSafetyFocus ? "Sí" : "No"
      }`,
      `- Razón: ${workPlan.safety.safetyReason ?? "No aplica"}`,
      "Límites:",
      workPlan.safety.limits.map((item) => `- ${item}`).join("\n"),
    ].join("\n"),

    "",
    "Plan de respuesta:",
    [
      `- Tono: ${workPlan.responsePlan.tone.join(", ")}`,
      `- Longitud: ${workPlan.responsePlan.length}`,
      "",
      "Debe hacer:",
      workPlan.responsePlan.mustDo.map((item) => `- ${item}`).join("\n"),
      "",
      "Debe evitar:",
      workPlan.responsePlan.mustAvoid.map((item) => `- ${item}`).join("\n"),
      "",
      `Cierre: ${workPlan.responsePlan.closingInstruction}`,
    ].join("\n"),

    "",
    "Formato visual obligatorio:",
    [
      "- Escribe en bloques cortos.",
      "- Usa doble salto de línea entre ideas diferentes.",
      "- Responde primero la pregunta directa del usuario.",
      "- Si das pasos, que sean pocos y accionables.",
      "- Si das opciones, solo usa opciones validadas por los módulos.",
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
      "No tomes decisiones clínicas nuevas.",
      "Si hay MealSpecialist, respeta su validación como límite técnico.",
      "Si FoodContext indica seguimiento, conserva la continuidad antes de responder.",
      "No respondas como tema nuevo si Cerebro detectó seguimiento.",
      "No agregues alimentos, recetas, ingredientes ni acompañamientos que no hayan sido validados.",
      "Cierra con una acción concreta relacionada con el mismo tema.",
    ].join(" "),
  ].join("\n");
}