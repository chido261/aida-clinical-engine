// app/lib/aida/conversationManager.ts

import type { AidaBrainResult } from "@/app/lib/aida/aidaBrain";

export type AidaConversationTone =
  | "DIRECTO"
  | "EMPATICO"
  | "TRANQUILIZADOR"
  | "MOTIVADOR"
  | "EDUCATIVO"
  | "PRACTICO";

export type AidaConversationPlan = {
  tone: AidaConversationTone[];
  mainTopic: string;
  mustMention: string[];
  shouldAvoid: string[];
  suggestedAction: string | null;
  questionToAsk: string | null;
  responseMode: "DETERMINISTIC" | "GPT_ASSISTED";
  deterministicReply: string | null;
};

export function buildConversationPlan(
  brainResult: AidaBrainResult
): AidaConversationPlan {
  const { decision, context, semaforo, clinical } = brainResult;

  if (semaforo?.riskType === "HYPOGLYCEMIA") {
    return {
      tone: ["DIRECTO", "EMPATICO"],
      mainTopic: "Hipoglucemia",
      mustMention: [
        "La lectura está por debajo de 70 mg/dL.",
        "Debe aplicar protocolo 15-15.",
        "Debe volver a medir en 15 minutos.",
        "Debe buscar atención médica si empeora, hay confusión, desmayo o no sube.",
      ],
      shouldAvoid: [
        "No sugerir ejercicio.",
        "No sugerir esperar sin actuar.",
        "No ajustar medicamentos.",
        "No dar una respuesta larga.",
      ],
      suggestedAction:
        "Aplicar protocolo 15-15 y reportar nueva lectura en 15 minutos.",
      questionToAsk: null,
      responseMode: "DETERMINISTIC",
      deterministicReply:
        "Tu lectura está por debajo de 70 mg/dL, eso cuenta como hipoglucemia. ⚠️\n\n" +
        "Aplica el protocolo 15-15:\n" +
        "1) Toma 15 g de carbohidrato de absorción rápida.\n" +
        "2) Espera 15 minutos.\n" +
        "3) Vuelve a medirte y dime el número.\n\n" +
        "Si hay confusión, desmayo, empeoras o no sube después de repetir el protocolo, busca atención médica urgente.",
    };
  }

  if (semaforo?.riskType === "SEVERE_HYPERGLYCEMIA") {
    return {
      tone: ["DIRECTO", "EMPATICO"],
      mainTopic: "Hiperglucemia severa",
      mustMention: [
        "La lectura está por arriba de 250 mg/dL.",
        "Debe revisar síntomas de alerta.",
        "Debe hidratarse con agua natural.",
        "Debe considerar atención médica si hay malestar importante o si se repite.",
      ],
      shouldAvoid: [
        "No ajustar medicamentos.",
        "No indicar dosis.",
        "No minimizar la lectura.",
        "No dar menú como prioridad.",
      ],
      suggestedAction:
        "Revisar síntomas, hidratarse y mantener seguimiento de glucosa.",
      questionToAsk:
        "¿Tienes dolor de pecho, dificultad para respirar, vómito, confusión o debilidad intensa?",
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.needsMoreInfo && decision.missingInfo === "Momento de la lectura") {
    return {
      tone: ["EDUCATIVO", "PRACTICO"],
      mainTopic: "Aclarar momento de glucosa",
      mustMention: [
        "Hay una lectura de glucosa, pero falta saber el momento.",
        "No se debe interpretar igual ayuno, postcomida o noche.",
      ],
      shouldAvoid: [
        "No clasificar como ayuno si el usuario no lo dijo.",
        "No asumir postcomida.",
        "No dar conclusión clínica sin contexto.",
      ],
      suggestedAction: "Pedir el momento de la medición.",
      questionToAsk:
        "¿Fue en ayunas, después de comer o antes de dormir?",
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.intent === "GLUCOSE_REPORT") {
    const name = context.profile.name;

    return {
      tone: ["TRANQUILIZADOR", "EDUCATIVO", "PRACTICO"],
      mainTopic: "Reporte de glucosa",
      mustMention: [
        ...(name ? [`Nombre del usuario: ${name}.`] : []),
        context.profile.baselineA1c != null
          ? `HbA1c registrada: ${context.profile.baselineA1c}.`
          : "No hay HbA1c registrada.",
        context.progressMetrics.avgLast7 != null
          ? `Promedio últimos 7 registros: ${context.progressMetrics.avgLast7} mg/dL.`
          : "No hay suficientes registros para promedio de 7.",
        `Protocolo activo: ${context.profile.activeProtocol}.`,
        `Fase activa: ${context.profile.activePhase}.`,
        semaforo
          ? `Semáforo: ${semaforo.color} - ${semaforo.label}.`
          : "Sin semáforo disponible.",
      ],
      shouldAvoid: [
        "No alarmar si el semáforo no es rojo.",
        "No ajustar medicamentos.",
        "No prometer reversión ni suspensión de medicamentos.",
        "No dar demasiadas recomendaciones juntas.",
      ],
      suggestedAction:
        semaforo?.recommendedAction ??
        "Dar una orientación breve según el perfil, progreso y fase.",
      questionToAsk: decision.missingInfo ? decision.missingInfo : null,
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.intent === "MEAL_IDEAS") {
    return {
      tone: ["PRACTICO", "EDUCATIVO"],
      mainTopic: "Ideas de comidas",
      mustMention: [
        `Protocolo activo: ${context.profile.activeProtocol}.`,
        `Fase activa: ${context.profile.activePhase}.`,
        "Las sugerencias deben respetar alimentos permitidos del protocolo activo.",
      ],
      shouldAvoid: [
        "No sugerir alimentos excluidos del protocolo.",
        "No sugerir tortilla, pan, arroz, pasta, papa, camote, jugos o azúcar si está en Protocolo 1.",
        "No dar explicación larga.",
      ],
      suggestedAction:
        "Dar ideas de comidas simples, variadas y compatibles con la fase actual.",
      questionToAsk: null,
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.intent === "MEAL_REVIEW") {
    return {
      tone: ["EDUCATIVO", "EMPATICO", "PRACTICO"],
      mainTopic: "Revisión de comida",
      mustMention: [
        `Protocolo activo: ${context.profile.activeProtocol}.`,
        `Fase activa: ${context.profile.activePhase}.`,
        "Revisar qué alimentos ayudan y cuáles pueden elevar glucosa.",
      ],
      shouldAvoid: [
        "No regañar.",
        "No culpar al usuario.",
        "No contradecir el protocolo.",
        "No dar plan completo si solo pidió revisión.",
      ],
      suggestedAction:
        "Identificar el elemento más importante del plato y sugerir un ajuste concreto.",
      questionToAsk: null,
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.intent === "PROGRESS_REVIEW") {
    return {
      tone: ["MOTIVADOR", "EDUCATIVO"],
      mainTopic: "Revisión de progreso",
      mustMention: [
        context.progressContext,
      ],
      shouldAvoid: [
        "No exagerar avances.",
        "No prometer resultados.",
        "No ajustar medicamentos.",
      ],
      suggestedAction:
        "Explicar tendencia y dar un siguiente paso concreto.",
      questionToAsk: null,
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  if (decision.intent === "PROTOCOL_QUESTION") {
    return {
      tone: ["EDUCATIVO", "PRACTICO"],
      mainTopic: "Consulta de protocolo",
      mustMention: [
        `Protocolo activo: ${context.profile.activeProtocol}.`,
        `Fase activa: ${context.profile.activePhase}.`,
      ],
      shouldAvoid: [
        "No cambiar fase sin evaluación.",
        "No prometer avance automático.",
        "No contradecir reglas del protocolo.",
      ],
      suggestedAction:
        "Responder según fase actual y, si aplica, explicar qué falta para avanzar.",
      questionToAsk: null,
      responseMode: "GPT_ASSISTED",
      deterministicReply: null,
    };
  }

  return {
    tone: ["EMPATICO", "EDUCATIVO", "PRACTICO"],
    mainTopic: "Mensaje general",
    mustMention: [
      `Protocolo activo: ${context.profile.activeProtocol}.`,
      `Fase activa: ${context.profile.activePhase}.`,
    ],
    shouldAvoid: [
      "No inventar datos clínicos.",
      "No ajustar medicamentos.",
      "No dar respuestas largas innecesarias.",
    ],
    suggestedAction:
      "Responder de forma útil, breve y personalizada.",
    questionToAsk: null,
    responseMode: "GPT_ASSISTED",
    deterministicReply: null,
  };
}