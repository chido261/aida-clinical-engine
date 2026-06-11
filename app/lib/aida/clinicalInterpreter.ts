// app/lib/aida/clinicalInterpreter.ts

export type AidaReadingMoment =
  | "FASTING"
  | "POST_MEAL"
  | "BEDTIME"
  | "UNKNOWN";

export type AidaDetectedSymptom =
  | "LOW_SYMPTOMS"
  | "VOMITING"
  | "CHEST_OR_BREATHING"
  | "SEVERE_WEAKNESS"
  | "CONFUSION_OR_FAINTING";

export type AidaInterpretedReading = {
  glucose: number;
  moment: AidaReadingMoment;
  sourceText: string;
  confidence: "high" | "medium" | "low";
};

export type AidaClinicalInterpretation = {
  readings: AidaInterpretedReading[];
  symptoms: AidaDetectedSymptom[];
  hasMultipleReadings: boolean;
  needsMomentClarification: boolean;
  originalText: string;
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidGlucose(value: number) {
  return Number.isFinite(value) && value >= 40 && value <= 600;
}

function detectMomentNearText(text: string): {
  moment: AidaReadingMoment;
  confidence: "high" | "medium" | "low";
} {
  const normalized = normalizeText(text);

  if (
    /\b(ayuno|ayunas|en ayunas|al despertar|despertando|amaneci|amanecer|sin comer)\b/.test(
      normalized
    )
  ) {
    return { moment: "FASTING", confidence: "high" };
  }

  if (
    /\b(postcomida|post comida|despues de comer|despues de desayunar|despues del desayuno|despues de almorzar|despues de la comida|despues de cenar|2h|2 horas|dos horas)\b/.test(
      normalized
    )
  ) {
    return { moment: "POST_MEAL", confidence: "high" };
  }

  if (
    /\b(antes de dormir|al dormir|me voy a dormir|noche|por la noche|antes de acostarme|acostarme)\b/.test(
      normalized
    )
  ) {
    return { moment: "BEDTIME", confidence: "high" };
  }

  return { moment: "UNKNOWN", confidence: "low" };
}

function getContextWindow(text: string, index: number, length: number) {
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + length + 75);
  return text.slice(start, end);
}

function extractReadingsFromText(text: string): AidaInterpretedReading[] {
  const readings: AidaInterpretedReading[] = [];
  const matches = Array.from(text.matchAll(/\b(\d{2,3})\b/g));

  for (const match of matches) {
    const rawValue = match[1];
    const glucose = Number(rawValue);

    if (!isValidGlucose(glucose)) {
      continue;
    }

    const index = match.index ?? 0;
    const sourceText = getContextWindow(text, index, rawValue.length);
    const detected = detectMomentNearText(sourceText);

    readings.push({
      glucose,
      moment: detected.moment,
      sourceText: sourceText.trim(),
      confidence: detected.confidence,
    });
  }

  return readings;
}

function detectSymptoms(text: string): AidaDetectedSymptom[] {
  const normalized = normalizeText(text);
  const symptoms = new Set<AidaDetectedSymptom>();

  if (
    /\b(mareo|mareado|mareada|temblor|sudor frio|sudoracion fria|palpitaciones|taquicardia|ansiedad|debilidad)\b/.test(
      normalized
    )
  ) {
    symptoms.add("LOW_SYMPTOMS");
  }

  if (/\b(vomito|vomitos|vomitando|nausea|nauseas|arcadas)\b/.test(normalized)) {
    symptoms.add("VOMITING");
  }

  if (
    /\b(dolor de pecho|pecho apretado|falta de aire|dificultad para respirar|ahogo|respiracion agitada)\b/.test(
      normalized
    )
  ) {
    symptoms.add("CHEST_OR_BREATHING");
  }

  if (/\b(muy debil|debilidad severa|no puedo levantarme|sin fuerzas)\b/.test(normalized)) {
    symptoms.add("SEVERE_WEAKNESS");
  }

  if (/\b(confusion|confundido|confundida|desmayo|desmayado|desmayada|me desmaye)\b/.test(normalized)) {
    symptoms.add("CONFUSION_OR_FAINTING");
  }

  return Array.from(symptoms);
}

function improveSequentialMoments(
  readings: AidaInterpretedReading[],
  text: string
): AidaInterpretedReading[] {
  if (readings.length < 2) {
    return readings;
  }

  const normalized = normalizeText(text);

  const mentionsFastingAndPostMeal =
    /\b(ayuno|ayunas|en ayunas|al despertar|despertando|amaneci|amanecer)\b/.test(
      normalized
    ) &&
    /\b(despues de desayunar|despues del desayuno|despues de comer|postcomida|post comida|2h|2 horas|dos horas)\b/.test(
      normalized
    );

  if (!mentionsFastingAndPostMeal) {
    return readings;
  }

  const next = [...readings];

  if (next[0]?.moment === "FASTING" && next[1]?.moment === "FASTING") {
    next[1] = {
      ...next[1],
      moment: "POST_MEAL",
      confidence: "medium",
    };
  }

  if (next[0]?.moment === "UNKNOWN") {
    next[0] = {
      ...next[0],
      moment: "FASTING",
      confidence: "medium",
    };
  }

  if (next[1]?.moment === "UNKNOWN") {
    next[1] = {
      ...next[1],
      moment: "POST_MEAL",
      confidence: "medium",
    };
  }

  return next;
}

export function interpretAidaClinicalText(text: string): AidaClinicalInterpretation {
  const safeText = typeof text === "string" ? text : "";

  const rawReadings = extractReadingsFromText(safeText);
  const readings = improveSequentialMoments(rawReadings, safeText);
  const symptoms = detectSymptoms(safeText);

  const needsMomentClarification =
    readings.length === 1 && readings[0]?.moment === "UNKNOWN";

  return {
    readings,
    symptoms,
    hasMultipleReadings: readings.length > 1,
    needsMomentClarification,
    originalText: safeText,
  };
}

export function getPrimaryReading(
  interpretation: AidaClinicalInterpretation
): AidaInterpretedReading | null {
  if (!interpretation.readings.length) {
    return null;
  }

  return interpretation.readings[interpretation.readings.length - 1] ?? null;
}