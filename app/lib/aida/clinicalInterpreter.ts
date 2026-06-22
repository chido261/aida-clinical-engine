// app/lib/aida/clinicalInterpreter.ts

export type AidaReadingMoment =
  | "FASTING"
  | "PRE_MEAL"
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

type ReadingMatch = {
  glucose: number;
  rawValue: string;
  index: number;
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

function getContextWindow(text: string, index: number, length: number) {
  const start = Math.max(0, index - 55);
  const end = Math.min(text.length, index + length + 75);
  return text.slice(start, end).trim();
}

function detectMomentInText(text: string): {
  moment: AidaReadingMoment;
  confidence: "high" | "medium" | "low";
} {
  const normalized = normalizeText(text);

  if (
    /\b(ayuno|ayunas|en ayunas|al despertar|despertando|desperte|desperté|amaneci|amanecí|amanecer|sin comer)\b/.test(
      normalized
    )
  ) {
    return { moment: "FASTING", confidence: "high" };
  }

  if (
    /\b(antes de comer|antes de la comida|antes de desayunar|antes del desayuno|antes de almorzar|antes del almuerzo|antes de cenar|antes de la cena|previo a comer|previo a la comida|previo a cenar|previo a la cena)\b/.test(
      normalized
    )
  ) {
    return { moment: "PRE_MEAL", confidence: "high" };
  }

  if (
    /\b(postcomida|post comida|despues de comer|despues de desayunar|despues del desayuno|despues de almorzar|despues de la comida|despues de cenar|despues tuve|despues me salio|despues marque|2h|2 horas|dos horas)\b/.test(
      normalized
    )
  ) {
    return { moment: "POST_MEAL", confidence: "high" };
  }

  if (
    /\b(antes de dormir|al dormir|me voy a dormir|noche|por la noche|en la noche|antes de acostarme|acostarme)\b/.test(
      normalized
    )
  ) {
    return { moment: "BEDTIME", confidence: "high" };
  }

  return { moment: "UNKNOWN", confidence: "low" };
}

function extractReadingMatches(text: string): ReadingMatch[] {
  const matches = Array.from(text.matchAll(/\b(\d{2,3})\b/g));
  const readings: ReadingMatch[] = [];

  for (const match of matches) {
    const rawValue = match[1];
    const glucose = Number(rawValue);

    if (!isValidGlucose(glucose)) continue;

    readings.push({
      glucose,
      rawValue,
      index: match.index ?? 0,
    });
  }

  return readings;
}

function getSegmentForReading(text: string, matches: ReadingMatch[], currentIndex: number) {
  const current = matches[currentIndex];
  const previous = matches[currentIndex - 1];
  const next = matches[currentIndex + 1];

  const start = previous
    ? Math.max(previous.index + previous.rawValue.length, current.index - 80)
    : 0;

  const end = next
    ? Math.min(next.index, current.index + current.rawValue.length + 90)
    : text.length;

  return text.slice(start, end).trim();
}

function getPrefixForReading(text: string, current: ReadingMatch) {
  return text.slice(0, current.index).trim();
}

function getSuffixForReading(text: string, current: ReadingMatch) {
  return text.slice(current.index + current.rawValue.length).trim();
}

function inferMomentByPosition(params: {
  text: string;
  matches: ReadingMatch[];
  currentIndex: number;
  currentMoment: AidaReadingMoment;
}): {
  moment: AidaReadingMoment;
  confidence: "high" | "medium" | "low";
} {
  const { text, matches, currentIndex, currentMoment } = params;

  if (currentMoment !== "UNKNOWN") {
    return { moment: currentMoment, confidence: "high" };
  }

  const normalized = normalizeText(text);
  const current = matches[currentIndex];
  const prefix = normalizeText(getPrefixForReading(text, current));
  const suffix = normalizeText(getSuffixForReading(text, current));

  const localContext = `${prefix.slice(-120)} ${suffix.slice(0, 100)}`;

  if (
    /\b(antes de comer|antes de la comida|antes de desayunar|antes del desayuno|antes de almorzar|antes del almuerzo|antes de cenar|antes de la cena|previo a comer|previo a la comida|previo a cenar|previo a la cena)\b/.test(
      localContext
    )
  ) {
    return { moment: "PRE_MEAL", confidence: "medium" };
  }

  if (
    currentIndex === 0 &&
    /\b(desperte|desperté|al despertar|amaneci|amanecí|amanecer|ayuno|ayunas|en ayunas)\b/.test(
      prefix + " " + suffix.slice(0, 50)
    )
  ) {
    return { moment: "FASTING", confidence: "medium" };
  }

  if (
    currentIndex > 0 &&
    /\b(despues|después|postcomida|post comida|2h|2 horas|dos horas)\b/.test(
      prefix.slice(-120) + " " + suffix.slice(0, 80)
    )
  ) {
    return { moment: "POST_MEAL", confidence: "medium" };
  }

  const mentionsWakeThenMealThenAfter =
    /\b(desperte|desperté|amaneci|amanecí|al despertar)\b/.test(normalized) &&
    /\b(desayune|desayuné|comi|comí|cene|cené|almorce|almorcé)\b/.test(normalized) &&
    /\b(despues|después)\b/.test(normalized);

  if (mentionsWakeThenMealThenAfter && matches.length >= 2) {
    if (currentIndex === 0) return { moment: "FASTING", confidence: "medium" };
    if (currentIndex === 1) return { moment: "POST_MEAL", confidence: "medium" };
  }

  return { moment: "UNKNOWN", confidence: "low" };
}

function repairSequentialMoments(
  readings: AidaInterpretedReading[],
  originalText: string
): AidaInterpretedReading[] {
  if (readings.length < 2) return readings;

  const normalized = normalizeText(originalText);
  const next = [...readings];

  const mentionsFasting =
    /\b(ayuno|ayunas|en ayunas|al despertar|despertando|desperte|desperté|amaneci|amanecí|amanecer)\b/.test(
      normalized
    );

  const mentionsPostMeal =
    /\b(despues de desayunar|despues del desayuno|despues de comer|despues de comida|despues de la comida|postcomida|post comida|2h|2 horas|dos horas|despues tuve)\b/.test(
      normalized
    );

  const mentionsNight =
    /\b(antes de dormir|al dormir|noche|por la noche|en la noche|antes de acostarme)\b/.test(
      normalized
    );

  if (mentionsFasting && mentionsPostMeal && next.length >= 2) {
    next[0] = { ...next[0], moment: "FASTING", confidence: "medium" };
    next[1] = { ...next[1], moment: "POST_MEAL", confidence: "medium" };
  }

  if (mentionsNight && next.length >= 3) {
    next[2] = { ...next[2], moment: "BEDTIME", confidence: "medium" };
  }

  return next;
}

function extractReadingsFromText(text: string): AidaInterpretedReading[] {
  const matches = extractReadingMatches(text);

  const readings = matches.map((match, index) => {
    const segment = getSegmentForReading(text, matches, index);
    const sourceText = getContextWindow(text, match.index, match.rawValue.length);

    const segmentMoment = detectMomentInText(segment);
    const inferred = inferMomentByPosition({
      text,
      matches,
      currentIndex: index,
      currentMoment: segmentMoment.moment,
    });

    return {
      glucose: match.glucose,
      moment: inferred.moment,
      sourceText,
      confidence:
        inferred.moment === segmentMoment.moment
          ? segmentMoment.confidence
          : inferred.confidence,
    };
  });

  return repairSequentialMoments(readings, text);
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

export function interpretAidaClinicalText(text: string): AidaClinicalInterpretation {
  const safeText = typeof text === "string" ? text : "";

  const readings = extractReadingsFromText(safeText);
  const symptoms = detectSymptoms(safeText);

  const hasMultipleReadings = readings.length > 1;

  const needsMomentClarification =
    readings.length === 1 && readings[0]?.moment === "UNKNOWN";

  return {
    readings,
    symptoms,
    hasMultipleReadings,
    needsMomentClarification,
    originalText: safeText,
  };
}

export function getPrimaryReading(
  interpretation: AidaClinicalInterpretation
): AidaInterpretedReading | null {
  if (!interpretation.readings.length) return null;

  return interpretation.readings[interpretation.readings.length - 1] ?? null;
}