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

function hasFastingElevationAndPostMealHyperglycemia(
  classification: AidaClinicalClassification
) {
  return hasFastingElevation(classification) && hasPostMealHyperglycemia(classification);
}

function buildForbiddenRules() {
  return [
    "No ajustes medicamentos.",
    "No indiques dosis.",
    "No sugieras usar medicamento si la lectura está en rango saludable.",
    "No digas que el usuario puede suspender medicamentos.",
    "No inventes el momento de una lectura.",
    "No inventes el tiempo exacto después de comer si el usuario no lo dijo.",
    "No digas 'a las 2 horas' si el usuario solo dijo 'después de comer'.",
    "No uses la frase 'rango ideal'. Usa 'rango saludable' o 'por arriba del rango saludable'.",
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
      "Responde en 3 a 5 líneas, de forma breve, clara y tranquila. " +
      "Menciona cada lectura detectada y di que está en rango saludable según su momento. " +
      "No agregues consejos sobre antojos, peso, dieta específica, proteínas, grasas, fibra, ejercicio ni medicamentos si el usuario no lo pidió. " +
      "No sugieras acciones para bajar más la glucosa. " +
      "Además de interpretar la lectura, anticipa una ayuda útil según el momento, sin saturar: " +
"si es ayuno saludable pero cercano al límite bajo, sugiere desayunar algo estable y evitar ejercicio en ayunas por ahora; " +
"si es ayuno saludable normal, refuerza mantener el patrón y puedes ofrecer revisar el desayuno; " +
"si es postcomida saludable, refuerza que esa comida respondió bien y puedes preguntar qué comió para identificar qué le funcionó; " +
"si es antes de dormir saludable, refuerza cierre estable del día y descanso; no sugieras comer ni planear algo para la noche salvo que el usuario diga que tiene hambre o que aún no cenó. " +
"Haz máximo una sugerencia o una pregunta útil. " +
"Si falta el tiempo postcomida, pide máximo una aclaración breve.",
    forbidden: [
      ...buildForbiddenRules(),
      "No hables de antojos si el usuario no los mencionó.",
      "No hables de peso si el usuario no lo mencionó.",
      "No des plan alimentario si el usuario solo reportó lecturas saludables.",
      "No recomiendes proteínas, grasas, fibra, carbohidratos ni ejercicio si el usuario no pidió recomendaciones.",
      "No agregues consejos extra cuando la lectura ya está en rango saludable.",
      "No sugieras comer antes de dormir si el usuario no dijo que tiene hambre o que aún no cenó.",
    ],
    expectedResponseGoals: [
      "Mencionar cada lectura detectada.",
      "Decir que las lecturas están en rango saludable.",
      "Evitar acciones innecesarias para bajar más la glucosa.",
      "Reforzar mantener el patrón actual.",
      "No sugerir medicamentos.",
      "No agregar consejos no solicitados.",
    ],
  };
}

function composeFastingAndPostMealElevationDirective(params: {
  classification: AidaClinicalClassification;
}): AidaResponseDirective {
  const readingsBlock = buildReadingsBlock(params.classification.readings);

  return {
    situation: "Ayuno elevado y postcomida elevada",
    priority: "follow_up",
    shouldUseDeterministicResponse: false,
    deterministicResponse: null,
    instructionsForGpt:
      `Situación clínica: hay dos puntos a revisar: ayuno elevado y postcomida elevada.\n\nLecturas:\n${readingsBlock}\n\n` +
      "Responde en 4 a 6 líneas, ordenado y sin alarmar. " +
      "Menciona ambos puntos por separado: " +
      "1) el ayuno está por arriba del rango saludable y conviene revisar cena, sueño, estrés u horario; " +
      "2) la postcomida está por arriba del objetivo y conviene revisar el plato. " +
      "No digas 'rango ideal'. " +
      "No enfoques toda la respuesta en bajar glucosa. " +
      "No des plan alimentario completo. " +
      "Haz máximo una pregunta, preferentemente sobre qué comió en esa comida.",
    forbidden: [
      ...buildForbiddenRules(),
      "No respondas como si solo importara la última lectura.",
      "No mezcles el ayuno y la postcomida en una sola causa.",
      "No digas 'rango ideal'.",
      "No hagas más de una pregunta.",
      "No sugieras medicamentos ni ajustes de dosis.",
      "No des plan alimentario completo.",
    ],
    expectedResponseGoals: [
      "Mencionar el ayuno elevado.",
      "Mencionar la postcomida elevada.",
      "Separar revisión de ayuno: cena, sueño, estrés u horario.",
      "Separar revisión de postcomida: plato.",
      "Hacer máximo una pregunta útil.",
      "No indicar medicamentos ni dosis.",
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
      "Responde en 3 a 5 líneas, breve y sin alarmar. " +
      "Di que la lectura está por arriba del rango saludable en postcomida, sin decir 'a las 2 horas' salvo que el usuario haya dicho explícitamente ese tiempo. " +
      "No inventes el tiempo exacto de la medición. " +
      "En este primer mensaje NO indiques caminata todavía, porque primero necesitamos saber si el usuario se siente bien o qué comió. " +
      "Haz una sola pregunta útil: si se siente bien y qué comió, o qué comió y cuánto tiempo pasó desde que comió. " +
      "No ajustes medicamentos.",
    forbidden: [
      ...buildForbiddenRules(),
      "No sugieras caminata en este primer mensaje si todavía no sabes si el usuario se siente bien.",
      "No digas que fue a las 2 horas si el usuario no lo especificó.",
      "No inventes horario postcomida.",
      "No digas 'rango ideal'.",
      "No des una explicación larga.",
      "No des plan alimentario completo.",
    ],
    expectedResponseGoals: [
      "Identificar hiperglucemia postcomida.",
      "No inventar tiempo después de comer.",
      "Pedir contexto antes de sugerir caminata.",
      "Preguntar máximo una cosa útil para decidir el siguiente paso.",
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
      "Responde breve. No alarmes. Di que está por arriba del rango saludable. Sugiere revisar cena, sueño, estrés u horario. No sugieras medicamento ni ajuste de dosis. Si se repite, puede recomendar comentarlo con su médico.",
    forbidden: [
      ...buildForbiddenRules(),
      "No digas 'rango ideal'.",
      "No sugieras medicamentos ni ajustes de dosis.",
    ],
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

  if (hasFastingElevationAndPostMealHyperglycemia(classification)) {
    return composeFastingAndPostMealElevationDirective({ classification });
  }

  if (hasPostMealHyperglycemia(classification)) {
    return composePostMealHyperglycemiaDirective({ classification });
  }

  if (hasFastingElevation(classification)) {
    return composeFastingElevationDirective({ classification });
  }

  return composeGeneralDirective({ classification });
}