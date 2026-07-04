// app/lib/aida2/conversationStrategy.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import type { Aida2ModuleResults } from "@/app/lib/aida2/moduleRunner";

export type Aida2ConversationStrategyInput = {
  workPlan: Aida2WorkPlan;
  moduleResults: Aida2ModuleResults;
  userMessage: string;
};

export type Aida2ConversationStrategy = {
  styleGoal: string;
  responseOrder: string[];
  mustFollow: string[];
  mustAvoid: string[];
  naturalLanguageHints: string[];
  closingStyle: string;
};

function buildStyleGoal(workPlan: Aida2WorkPlan) {
  const { foodContext } = workPlan;

  if (workPlan.safety.requiresImmediateSafetyFocus) {
    return "Responder con calma, seguridad y dirección clara. La prioridad es proteger al usuario sin alarmarlo.";
  }

  if (workPlan.thinking.mainAction === "ASK_MINIMUM_MISSING_DATA") {
    return "Responder de forma breve y pedir solo el dato mínimo necesario para poder ayudar bien.";
  }

  if (workPlan.thinking.mainAction === "SUGGEST_PROFILE_UPDATE") {
    return "Responder natural y aprovechar la observación detectada para sugerir actualizar el Perfil sin sonar invasivo.";
  }

  if (foodContext.isFoodRelated && foodContext.conversationMode === "FOLLOW_UP") {
    return "Responder como continuación de la comida actual, sin reiniciar la conversación ni cambiar el platillo.";
  }

  if (foodContext.isFoodRelated && foodContext.conversationMode === "CORRECTION") {
    return "Responder reconociendo la corrección o posible contradicción de forma breve, sin justificar de más.";
  }

  if (workPlan.understanding.asksForPreviousContext) {
    return "Retomar el hilo anterior sin reiniciar la conversación ni repetir información innecesaria.";
  }

  return "Responder como un asesor cercano, práctico y natural que ayuda al usuario a tomar una buena decisión sin darle una clase.";
}

function buildMustFollow(workPlan: Aida2WorkPlan): string[] {
  const { foodContext } = workPlan;

  const rules: string[] = [
    "Reconocer primero lo que el usuario dijo, pero sin repetirlo palabra por palabra.",
    "Responder primero la pregunta principal.",
    "Explicar solo lo necesario para tomar una decisión.",
    "Dar una sola recomendación principal.",
    "Mantenerse dentro del tema actual.",
    "Usar lenguaje natural, directo y humano.",
    "Usar referencias naturales al contexto inmediato: 'ahorita', 'en este momento', 'esa opción', 'esa comida'.",
    "Si el usuario ya eligió algo, ayudarlo a mejorar esa decisión en lugar de cambiarle el tema.",
    "Si la conversación ya tiene un objeto claro, usar pronombres o referencias naturales en lugar de repetir el nombre completo.",
  ];

  if (workPlan.safety.requiresImmediateSafetyFocus) {
    rules.push(
      "Priorizar seguridad antes que cualquier otro tema.",
      "Dar instrucciones concretas y fáciles de seguir.",
      "Mantener tono tranquilo, sin alarmar de más.",
      "En riesgo clínico sí se puede repetir el dato importante si ayuda a la seguridad."
    );
  }

  if (workPlan.thinking.mainAction === "ASK_MINIMUM_MISSING_DATA") {
    rules.push(
      "Pedir solo un dato faltante si es indispensable.",
      "No dar una recomendación completa si falta información crítica."
    );
  }

  if (workPlan.thinking.mainAction === "SUGGEST_PROFILE_UPDATE") {
    rules.push(
      "Mencionar que el dato no parece estar registrado solo si ayuda a mejorar la asesoría.",
      "Sugerir confirmar o registrar el dato de forma amable."
    );
  }

  if (foodContext.isFoodRelated) {
    rules.push(
      "Responder primero la decisión alimentaria principal.",
      "No convertir la respuesta en una clase de nutrición.",
      "Mantener la respuesta dentro de la comida, preparación o elemento consultado.",
      "No cambiar el alimento o preparación del usuario por otra cosa sin responder primero.",
      "Si el usuario ya eligió un alimento o preparación, ayudarlo a decidir cómo manejarlo mejor."
    );

    if (foodContext.conversationMode === "FOLLOW_UP") {
      rules.push(
        "Tratar el mensaje como continuidad de la comida previa.",
        "Usar el historial reciente para entender a qué se refiere el usuario.",
        "No responder como si fuera una pregunta aislada."
      );
    }

    if (foodContext.conversationMode === "CORRECTION") {
      rules.push(
        "Reconocer de forma breve si hubo confusión o contradicción.",
        "Corregir sin justificar de más.",
        "Volver rápido a la recomendación práctica."
      );
    }

    if (foodContext.questionType === "ADD_TO_PREVIOUS_MEAL") {
      rules.push(
        "Responder sobre el elemento que el usuario quiere agregar.",
        "No rediseñar todo el platillo si no lo pidió."
      );
    }

    if (foodContext.questionType === "WHAT_TO_PAIR") {
      rules.push(
        "Responder con acompañamiento o bebida compatible solo si está validado.",
        "No proponer un platillo nuevo."
      );
    }

    if (foodContext.questionType === "RECIPE_REQUEST") {
      rules.push(
        "Dar opciones solo si fueron validadas por los módulos.",
        "Mantener las opciones breves y prácticas."
      );
    }

    if (foodContext.shouldValidatePreparation) {
      rules.push(
        "Si faltan ingredientes para validar una preparación, pedir solo los ingredientes mínimos.",
        "No bloquear una preparación únicamente por su nombre común."
      );
    }
  }

  if (workPlan.understanding.intent === "FOLLOW_UP_CONTEXT") {
    rules.push(
      "Retomar el objetivo anterior con claridad.",
      "No contestar como si fuera una conversación nueva."
    );
  }

  return rules;
}

function buildMustAvoid(workPlan: Aida2WorkPlan): string[] {
  const { foodContext } = workPlan;

  const rules: string[] = [
    "No sonar como ChatGPT.",
    "No usar frases como: depende, cabe señalar, es importante mencionar, en conclusión.",
    "No abrir temas nuevos al final.",
    "No cerrar siempre con una pregunta.",
    "No ofrecer muchas opciones si una recomendación clara es suficiente.",
    "No mencionar WorkPlan, módulos, Decision Engine, estrategia o instrucciones internas.",
    "No inventar datos del usuario.",
    "No ajustar, suspender ni modificar medicamentos.",
    "No repetir literalmente datos que el usuario acaba de decir, salvo que sea necesario por seguridad.",
    "No empezar varias respuestas seguidas con la misma estructura.",
    "No iniciar siempre con 'Con una glucosa de...'.",
    "No decir '¿Quieres que te ayude...?' si ya diste una acción clara.",
  ];

  if (foodContext.isFoodRelated) {
    rules.push(
      "No cambiar el alimento del usuario por otro sin antes responder su pregunta.",
      "No proponer un menú completo si el usuario solo preguntó por un alimento, bebida, ingrediente o preparación.",
      "No perder el hilo de la comida actual.",
      "No tomar decisiones técnicas que correspondan al especialista.",
      "No inventar alimentos, recetas, cantidades ni acompañamientos no validados."
    );

    if (foodContext.conversationMode === "FOLLOW_UP") {
      rules.push(
        "No tratar el mensaje como tema nuevo.",
        "No ignorar la comida previa si Cerebro detectó continuidad."
      );
    }

    if (foodContext.questionType === "ADD_TO_PREVIOUS_MEAL") {
      rules.push(
        "No cambiar todo el platillo cuando el usuario solo pregunta por agregar algo."
      );
    }
  }

  if (workPlan.safety.requiresImmediateSafetyFocus) {
    rules.push(
      "No minimizar síntomas.",
      "No dar recomendaciones secundarias antes de la acción de seguridad."
    );
  }

  return rules;
}

function buildNaturalLanguageHints(workPlan: Aida2WorkPlan): string[] {
  const { foodContext } = workPlan;

  const hints: string[] = [
    "Prefiere frases cortas y conversacionales.",
    "Usa 'ahorita' o 'en este momento' cuando el usuario acaba de dar un dato actual.",
    "Usa 'esa opción', 'esa comida' o 'así' cuando ya se está hablando de algo concreto.",
    "Si el usuario pregunta algo directo, responde directo antes de explicar.",
    "Si ya quedó clara la siguiente acción, no cierres con pregunta.",
  ];

  if (workPlan.understanding.mentionedGlucose !== null) {
    hints.push(
      "Cuando el usuario acaba de mencionar su glucosa, evita repetir el número en la primera frase.",
      "En lugar de repetir el número, usa: 'con el nivel que tienes ahora', 'ahorita', 'en este momento' o 'en esas condiciones'."
    );
  }

  if (foodContext.isFoodRelated) {
    hints.push(
      "Para comida, usa frases como: 'En ese caso...', 'Yo lo manejaría así...', 'Para esta fase...', 'Esa opción...'.",
      "Evita sonar prohibitivo salvo que la validación indique que no conviene.",
      "Cuando sugieras cantidad o medición, hazlo como guía práctica, no como regla rígida."
    );

    if (foodContext.conversationMode === "FOLLOW_UP") {
      hints.push(
        "Usa referencias como: 'con esa comida', 'si lo vas a agregar', 'para esa preparación', 'en esa opción'."
      );
    }

    if (foodContext.conversationMode === "CORRECTION") {
      hints.push(
        "Puedes usar: 'Tienes razón, aquí lo correcto es...', 'Sí, ahí había que distinguir...', 'Correcto, en ese caso...'."
      );
    }
  }

  if (workPlan.safety.requiresImmediateSafetyFocus) {
    hints.push(
      "En seguridad clínica, prioriza claridad sobre naturalidad.",
      "Usa pasos concretos y evita adornar demasiado la respuesta."
    );
  }

  return hints;
}

function buildClosingStyle(workPlan: Aida2WorkPlan) {
  const { foodContext } = workPlan;

  if (workPlan.safety.requiresImmediateSafetyFocus) {
    return "Cerrar con una indicación clara de seguridad o de búsqueda de atención médica si corresponde.";
  }

  if (workPlan.thinking.mainAction === "ASK_MINIMUM_MISSING_DATA") {
    return "Cerrar pidiendo un solo dato concreto.";
  }

  if (workPlan.thinking.mainAction === "SUGGEST_PROFILE_UPDATE") {
    return "Cerrar sugiriendo confirmar o registrar el dato relevante, sin presionar.";
  }

  if (foodContext.isFoodRelated) {
    if (foodContext.conversationMode === "FOLLOW_UP") {
      return "Cerrar con una acción concreta sobre la misma comida o preparación.";
    }

    if (foodContext.conversationMode === "CORRECTION") {
      return "Cerrar con la corrección práctica ya aplicada y una acción concreta.";
    }

    return "Cerrar con una acción concreta relacionada con la decisión alimentaria.";
  }

  if (workPlan.understanding.asksForPreviousContext) {
    return "Cerrar retomando el objetivo anterior y dejando claro el siguiente paso.";
  }

  return "Cerrar con una acción concreta. Evitar cerrar con pregunta si no hace falta.";
}

export function buildAida2ConversationStrategy(
  input: Aida2ConversationStrategyInput
): Aida2ConversationStrategy {
  const { workPlan } = input;

  return {
    styleGoal: buildStyleGoal(workPlan),
    responseOrder: [
      "Reconocer sin repetir literalmente",
      "Responder",
      "Explicar breve",
      "Recomendar",
      "Cerrar con acción",
    ],
    mustFollow: buildMustFollow(workPlan),
    mustAvoid: buildMustAvoid(workPlan),
    naturalLanguageHints: buildNaturalLanguageHints(workPlan),
    closingStyle: buildClosingStyle(workPlan),
  };
}