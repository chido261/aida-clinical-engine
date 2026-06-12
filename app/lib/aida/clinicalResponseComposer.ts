// app/lib/aida/clinicalResponseComposer.ts

import type { AidaClinicalInterpretation } from "@/app/lib/aida/clinicalInterpreter";
import type {
  AidaClinicalClassification,
  AidaClassifiedReading,
} from "@/app/lib/aida/clinicalClassifier";

export type AidaResponseDirective = {
  situation: string;
  priority: "safety" | "follow_up" | "clarification" | "education" | "maintenance";
  shouldUseDeterministicResponse: boolean;
  deterministicResponse: string | null;
  instructionsForGpt: string;
  forbidden: string[];
  expectedResponseGoals: string[];
};

function momentLabel(moment: string) {
  if (moment === "FASTING") return "ayuno";
  if (moment === "POST_MEAL") return "postcomida";
  if (moment === "BEDTIME") return "antes de dormir";
  return "momento no definido";
}

function readingLine(reading: AidaClassifiedReading) {
  return `- ${reading.glucose} mg/dL (${momentLabel(reading.moment)}): ${reading.label}, Nivel ${reading.level}. Acción interna: ${reading.action}.`;
}

function buildReadingsBlock(readings: AidaClassifiedReading[]) {
  if (!readings.length) {
    return "No se detectaron lecturas de glucosa.";
  }

  return readings.map(readingLine).join("\n");
}

function hasOnlyHealthyReadings(classification: AidaClinicalClassification) {
  return (
    classification.readings.length > 0 &&
    classification.readings.every((reading) => reading.level === 1)
  );
}

function hasHypoglycemia(classification: AidaClinicalClassification) {
  return classification.readings.some((reading) => reading.glucose < 70);
}

function hasUnknownMomentClarification(interpretation: AidaClinicalInterpretation) {
  return interpretation.needsMomentClarification;
}

function hasPostMealHyperglycemia(classification: AidaClinicalClassification) {
  return classification.readings.some(
    (reading) =>
      reading.moment === "POST_MEAL" &&
      reading.glucose > 140 &&
      reading.glucose <= 250
  );
}

function hasFastingElevation(classification: AidaClinicalClassification) {
  return classification.readings.some(
    (reading) =>
      reading.moment === "FASTING" &&
      reading.glucose > 100 &&
      reading.glucose <= 250
  );
}

function buildForbiddenRules() {
  return [
    "No ajustes medicamentos.",
    "No indiques dosis.",
    "No sugieras usar medicamento si la lectura está en rango saludable.",
    "No digas que el usuario puede suspender medicamentos.",
    "No inventes el momento de una lectura.",
    "No hagas más de una pregunta.",
    "No prometas normalizar glucosa ni retirar medicamentos.",
  ];
}

function composeHypoglycemiaDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Hipoglucemia detectada",
    priority: "safety",
    shouldUseDeterministicResponse: true,
    deterministicResponse:
      "Tu lectura está por debajo de 70 mg/dL, eso cuenta como hipoglucemia. ⚠️\n\n" +
      "Aplica el protocolo 15-15:\n" +
      "1) Toma 15 g de carbohidrato de absorción rápida.\n" +
      "2) Espera 15 minutos.\n" +
      "3) Vuelve a medirte y dime el número.\n\n" +
      "Si hay confusión, desmayo, empeoras o no sube después de repetir el protocolo, busca atención médica urgente.",
    instructionsForGpt:
      `Situación clínica: hipoglucemia.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Prioriza seguridad. Respuesta breve, clara y operativa. Activar protocolo 15-15.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Decir que menor de 70 es hipoglucemia.",
      "Dar protocolo 15-15.",
      "Pedir nueva medición en 15 minutos.",
      "Enviar a atención médica si hay síntomas graves o no mejora.",
    ],
  };
}

function composeClarificationDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Lectura con momento no definido",
    priority: "clarification",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica: hay lectura numérica, pero falta el momento.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde breve. No clasifiques como ayuno o postcomida. Haz solo una pregunta: si fue en ayunas, después de comer o antes de dormir.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Confirmar la lectura sin inventar el momento.",
      "No sugerir medicamento.",
      "Pedir una sola aclaración sobre el momento.",
    ],
  };
}

function composeHealthyDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);
  const hasMultiple = params.classification.readings.length > 1;

  return {
    situation: hasMultiple
      ? "Múltiples lecturas en rango saludable"
      : "Lectura en rango saludable",
    priority: "maintenance",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica: lectura(s) en rango saludable.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde como coach cercano. Reconoce que va bien. No sugieras medicamento ni medidas para bajar más la glucosa. Recomienda mantener el patrón. Si la postcomida no especifica tiempo, puedes pedir solo una aclaración breve.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Reconocer que las lecturas están en rango saludable.",
      "Evitar acciones innecesarias para bajar más la glucosa.",
      "Reforzar mantener patrón de comida/hábitos.",
      "No sugerir medicamentos.",
    ],
  };
}

function composePostMealHyperglycemiaDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Hiperglucemia postcomida",
    priority: "follow_up",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica: glucosa elevada después de comer.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde breve. Explica que después de comida mayor de 140 está elevada. Sugiere agua y caminata ligera 10-15 min solo si se siente bien. Pide revisar el plato con una sola pregunta. No ajustes medicamentos.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Identificar hiperglucemia postcomida.",
      "Sugerir revisión de plato.",
      "Sugerir caminata ligera solo si es seguro.",
      "No indicar medicamentos ni dosis.",
    ],
  };
}

function composeFastingElevationDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Ayuno elevado",
    priority: "follow_up",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica: ayuno por arriba de rango saludable.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde breve. No alarmes. Sugiere revisar cena, sueño, estrés o horario. No sugieras medicamento ni ajuste de dosis. Si se repite, puede recomendar comentarlo con su médico.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Identificar ayuno elevado.",
      "Revisar cena, sueño, estrés u horario.",
      "No indicar medicamentos.",
      "Pedir máximo una información útil.",
    ],
  };
}

function composeGeneralDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Seguimiento clínico general",
    priority: params.classification.hasFollowUp ? "follow_up" : "education",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica general.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde breve, humano y operativo. Usa la clasificación como guía. Da una acción concreta y máximo una pregunta.",
    forbidden: buildForbiddenRules(),
    expectedResponseGoals: [
      "Responder con base en la clasificación.",
      "Dar una acción concreta.",
      "No ajustar medicamentos.",
      "No inventar contexto.",
    ],
  };
}

export function composeAidaClinicalResponseDirective(params: {
  interpretation: AidaClinicalInterpretation;
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const { interpretation, classification } = params;

  if (hasHypoglycemia(classification)) {
    return composeHypoglycemiaDirective({ classification });
  }

  if (hasUnknownMomentClarification(interpretation)) {
    return composeClarificationDirective({ classification });
  }

  if (hasOnlyHealthyReadings(classification)) {
    return composeHealthyDirective({ classification });
  }

  if (hasPostMealHyperglycemia(classification)) {
    return composePostMealHyperglycemiaDirective({ classification });
  }

  if (hasFastingElevation(classification)) {
    return composeFastingElevationDirective({ classification });
  }

  return composeGeneralDirective({ classification });
}