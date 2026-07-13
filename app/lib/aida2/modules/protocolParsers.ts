// app/lib/aida2/modules/protocolParsers.ts

import type { ProtocolSections } from "./protocolModule";

export type StructuredAllowedFoods = {
  proteins: string[];
  dairy: string[];
  healthyFats: string[];
  vegetables: string[];
  legumes: string[];
  fruits: string[];
  beverages: string[];
};

export type StructuredFruits = {
  objective: string;
  schedule: string;
  portion: string[];
  foods: string[];
  avoid: string[];
  restricted: string[];
};

export type StructuredIdentification = {
  name: string;
  duration: string;
  minimumDuration: string;
  status: string;
};

export type StructuredPlateComponent = {
  percentage: number | null;
  category: string;
  description: string;
  sources: string[];
};

export type StructuredPlateDistribution = {
  summary: string;
  components: StructuredPlateComponent[];
};

export type StructuredOperationalCategories = {
  allowed: string[];
  allowedWithCondition: string[];
  allowedWithValidation: string[];
  restricted: string[];
};

export type StructuredValidationRule = {
  measurementTiming: string;
  targetMinMgDl: number | null;
  targetMaxMgDl: number | null;
  toleratedAction: string;
  exceededAction: string;
  retryTiming: string;
  steps: string[];
};

export type StructuredPortions = {
  generalRules: string[];
  examples: string[];
  bySection: Record<string, string[]>;
};

export type StructuredProtocol = {
  identification: StructuredIdentification;
  objectives: string[];
  purpose: string;
  philosophy: string;
  generalPrinciple: string;
  generalGuidelines: string[];

  plateDistribution: StructuredPlateDistribution;

  operationalCategories: StructuredOperationalCategories;
  allowedFoods: StructuredAllowedFoods;
  restrictedFoods: string[];

  fruits: StructuredFruits;
  legumes: {
    foods: string[];
    schedule: string;
    portion: string[];
    rules: string[];
  };

  portions: StructuredPortions;
  validationRule: StructuredValidationRule;
  advancementCriteria: string[];
  mealConstruction: string[];
  controlSheet: string[];
  aidaRole: {
    should: string[];
    shouldNot: string[];
  };
};

const SECTION_KEYS = {
  identification: ["identification", "identificacin"],
  purpose: ["purpose", "propsito_del_protocolo"],
  philosophy: ["philosophy", "filosofa_del_protocolo"],
  plateDistribution: ["plateDistribution", "distribucin_del_plato"],
  generalPrinciple: ["generalPrinciple", "principio_general"],
  generalGuidelines: ["generalGuidelines", "lineamientos_generales"],
  operationalCategories: [
    "operationalCategories",
    "categoras_operativas",
    "categorias_operativas",
  ],
  restrictedFoods: ["restrictedFoods", "alimentos_no_recomendados"],
  fruits: ["fruits", "frutas"],
  legumes: ["legumes", "leguminosas"],
  mealConstruction: ["mealConstruction", "construccin_de_platos"],
  portions: ["portions", "porciones"],
  controlSheet: ["controlSheet", "hoja_de_control"],
  aidaRole: ["aidaRole", "papel_de_aida"],
  allowedFoods: ["allowedFoods", "lista_de_alimentos_permitidos"],
  validationRule: [
    "validationRule",
    "regla_de_validacin_de_carbohidratos",
    "regla_de_validacion_de_carbohidratos",
  ],
  advancementCriteria: [
    "advancementCriteria",
    "criterios_de_avance",
  ],
} as const;

export function buildStructuredProtocol(
  sections: ProtocolSections
): StructuredProtocol {
  const identificationText = getSection(
    sections,
    SECTION_KEYS.identification
  );

  const purposeText = getSection(
    sections,
    SECTION_KEYS.purpose
  );

  const operationalCategoriesText = getSection(
    sections,
    SECTION_KEYS.operationalCategories
  );

  const fruitsText = getSection(
    sections,
    SECTION_KEYS.fruits
  );

  const legumesText = getSection(
    sections,
    SECTION_KEYS.legumes
  );

  const portionsText = getSection(
    sections,
    SECTION_KEYS.portions
  );

  const validationText = getSection(
    sections,
    SECTION_KEYS.validationRule
  );

  return {
    identification: parseIdentification(identificationText),

    objectives: parseObjectives(purposeText),

    purpose: cleanNarrative(purposeText),

    philosophy: cleanNarrative(
      getSection(sections, SECTION_KEYS.philosophy)
    ),

    generalPrinciple: cleanNarrative(
      getSection(sections, SECTION_KEYS.generalPrinciple)
    ),

    generalGuidelines: extractBullets(
      getSection(sections, SECTION_KEYS.generalGuidelines)
    ),

    plateDistribution: parsePlateDistribution(
      getSection(sections, SECTION_KEYS.plateDistribution)
    ),

    operationalCategories: parseOperationalCategories(
      operationalCategoriesText
    ),

    allowedFoods: parseAllowedFoods(
      getSection(sections, SECTION_KEYS.allowedFoods)
    ),

    restrictedFoods: uniqueStrings([
      ...extractBullets(
        getSection(sections, SECTION_KEYS.restrictedFoods)
      ),
      ...extractSubsectionBullets(
        operationalCategoriesText,
        [
          "No recomendados",
          "No recomendado",
          "Restringidos",
          "Restringido",
        ]
      ),
    ]),

    fruits: parseFruits(fruitsText),

    legumes: parseLegumes(legumesText),

    portions: parsePortions(portionsText, sections),

    validationRule: parseValidationRule(
      validationText ||
        getSection(sections, SECTION_KEYS.generalPrinciple)
    ),

    advancementCriteria: parseNumberedItems(
      getSection(sections, SECTION_KEYS.advancementCriteria)
    ),

    mealConstruction: parseNumberedOrBulletedItems(
      getSection(sections, SECTION_KEYS.mealConstruction)
    ),

    controlSheet: parseControlSheet(
      getSection(sections, SECTION_KEYS.controlSheet)
    ),

    aidaRole: parseAidaRole(
      getSection(sections, SECTION_KEYS.aidaRole)
    ),
  };
}

/* =======================================================
   IDENTIFICATION
======================================================= */

function parseIdentification(
  text: string
): StructuredIdentification {
  return {
    name: extractLabeledValue(text, ["Nombre"]),
    duration: extractLabeledValue(text, ["Duración", "Duracion"]),
    minimumDuration: extractLabeledValue(text, [
      "Duración mínima sugerida",
      "Duracion minima sugerida",
    ]),
    status: extractLabeledBlock(text, ["Estado"]),
  };
}

/* =======================================================
   OBJECTIVES
======================================================= */

function parseObjectives(text: string): string[] {
  const blocks = extractSubsections(text);

  const objectives = blocks
    .filter(({ title }) => /^objetivo\s+\d+/i.test(title))
    .map(({ body }) => cleanNarrative(body))
    .filter(Boolean);

  if (objectives.length > 0) {
    return uniqueStrings(objectives);
  }

  return [];
}

/* =======================================================
   PLATE DISTRIBUTION
======================================================= */

function parsePlateDistribution(
  text: string
): StructuredPlateDistribution {
  const normalized = normalizeNewlines(text);
  const components: StructuredPlateComponent[] = [];

  const percentagePattern =
    /(\d{1,3})\s*%\s*\n+\s*([^\n]+)([\s\S]*?)(?=\n+\s*\d{1,3}\s*%|\n+\s*##\s+|$)/g;

  let match: RegExpExecArray | null;

  while ((match = percentagePattern.exec(normalized)) !== null) {
    const percentage = Number(match[1]);
    const category = cleanInline(match[2]);
    const body = match[3].trim();

    components.push({
      percentage: Number.isFinite(percentage)
        ? percentage
        : null,
      category,
      description: cleanNarrative(removeBullets(body)),
      sources: extractBullets(body),
    });
  }

  return {
    summary: cleanNarrative(text),
    components,
  };
}

/* =======================================================
   OPERATIONAL CATEGORIES
======================================================= */

function parseOperationalCategories(
  text: string
): StructuredOperationalCategories {
  return {
    allowed: extractSubsectionBullets(text, [
      "Permitidos base",
      "Permitido base",
      "Permitidos",
    ]),

    allowedWithCondition: extractSubsectionBullets(text, [
      "Permitidos con condición",
      "Permitidos con condicion",
      "Permitido con condición",
      "Permitido con condicion",
    ]),

    allowedWithValidation: extractSubsectionBullets(text, [
      "Permitidos con validación",
      "Permitidos con validacion",
      "Permitido con validación",
      "Permitido con validacion",
    ]),

    restricted: extractSubsectionBullets(text, [
      "No recomendados",
      "No recomendado",
      "Restringidos",
      "Restringido",
    ]),
  };
}

/* =======================================================
   ALLOWED FOODS
======================================================= */

function parseAllowedFoods(
  text: string
): StructuredAllowedFoods {
  return {
    proteins: extractHeadingBullets(text, [
      "PROTEÍNAS",
      "PROTEINAS",
    ]),

    dairy: extractHeadingBullets(text, [
      "LÁCTEOS",
      "LACTEOS",
    ]),

    healthyFats: extractHeadingBullets(text, [
      "GRASAS SALUDABLES",
    ]),

    vegetables: extractHeadingBullets(text, [
      "VEGETALES SIN ALMIDÓN",
      "VEGETALES SIN ALMIDON",
      "VERDURAS SIN ALMIDÓN",
      "VERDURAS SIN ALMIDON",
    ]),

    legumes: extractHeadingBullets(text, [
      "LEGUMINOSAS",
    ]),

    fruits: extractHeadingBullets(text, [
      "FRUTAS PERMITIDAS",
      "FRUTAS",
    ]),

    beverages: extractHeadingBullets(text, [
      "BEBIDAS",
    ]),
  };
}

/* =======================================================
   FRUITS
======================================================= */

function parseFruits(
  text: string
): StructuredFruits {
  return {
    objective: extractLabeledBlock(text, ["Objetivo"]),

    schedule: extractLabeledBlock(text, [
      "Horario permitido",
      "Horario",
    ]),

    portion: extractLabeledListOrText(text, [
      "Porción sugerida",
      "Porcion sugerida",
      "Porción",
      "Porcion",
    ]),

    foods: extractLabeledList(text, [
      "Frutas permitidas no tropicales",
      "Frutas permitidas",
      "Permitidas",
    ]),

    avoid: extractLabeledList(text, [
      "Evitar",
    ]),

    restricted: extractLabeledList(text, [
      "Frutas no recomendadas durante diagnóstico",
      "Frutas no recomendadas durante diagnostico",
      "Frutas no recomendadas",
      "No recomendadas",
    ]),
  };
}

/* =======================================================
   LEGUMES
======================================================= */

function parseLegumes(text: string) {
  return {
    foods: uniqueStrings([
      ...extractLabeledList(text, [
        "Ejemplos compatibles",
        "Permitidas",
        "Permitidos",
      ]),
      ...extractBullets(text).filter(
        (item) =>
          !looksLikeInstruction(item) &&
          !looksLikeTimeOrPortion(item)
      ),
    ]),

    schedule: extractLabeledBlock(text, [
      "Preferentemente",
      "Horario permitido",
      "Horario",
    ]),

    portion: extractLabeledListOrText(text, [
      "Porción habitual",
      "Porcion habitual",
      "Porción sugerida",
      "Porcion sugerida",
      "Porción",
      "Porcion",
    ]),

    rules: extractSentences(text).filter(
      (sentence) =>
        /25%|combinar|glucosa|porci[oó]n|plato|horario/i.test(
          sentence
        )
    ),
  };
}

/* =======================================================
   PORTIONS
======================================================= */

function parsePortions(
  text: string,
  sections: ProtocolSections
): StructuredPortions {
  const bySection: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(sections)) {
    const portions = extractAllPortionBlocks(value);

    if (portions.length > 0) {
      bySection[key] = portions;
    }
  }

  return {
    generalRules: extractSentences(text),
    examples: extractBullets(text),
    bySection,
  };
}

/* =======================================================
   VALIDATION RULE
======================================================= */

function parseValidationRule(
  text: string
): StructuredValidationRule {
  const normalized = cleanNarrative(text);

  const rangeMatch = normalized.match(
    /(?:entre|de)\s*(\d{2,3})\s*(?:a|-|y)\s*(\d{2,3})\s*mg\/?dL/i
  );

  const maxMatch = normalized.match(
    /(?:no\s+supera|no\s+supere|por\s+debajo\s+de|menor\s+a)\s*(\d{2,3})\s*mg\/?dL/i
  );

  const measurementTimingMatch = normalized.match(
    /medir(?:\s+la)?\s+glucosa\s+([^.!?]*(?:despu[eé]s|posterior)[^.!?]*)/i
  );

  const toleratedAction =
    extractSubsectionNarrative(text, [
      "Si la glucosa no supera 140 mg/dL",
      "Si la glucosa postcomida queda entre 100 y 140 mg/dL",
    ]) ||
    findSentence(normalized, /tolerad|puede mantener/i);

  const exceededAction =
    extractSubsectionNarrative(text, [
      "Si la glucosa supera 140 mg/dL",
      "Si supera 140 mg/dL",
    ]) ||
    findSentence(normalized, /reducir|demasiad|volver a probar/i);

  return {
    measurementTiming:
      measurementTimingMatch?.[1]?.trim() ?? "",

    targetMinMgDl: rangeMatch
      ? Number(rangeMatch[1])
      : null,

    targetMaxMgDl: rangeMatch
      ? Number(rangeMatch[2])
      : maxMatch
        ? Number(maxMatch[1])
        : null,

    toleratedAction,

    exceededAction,

    retryTiming:
      findSentence(
        normalized,
        /pr[oó]xima semana|una semana|volver a validar|volver a probar/i
      ),

    steps: parseNumberedItems(text),
  };
}

/* =======================================================
   CONTROL SHEET
======================================================= */

function parseControlSheet(
  text: string
): string[] {
  return parseNumberedItems(text);
}

/* =======================================================
   AIDA ROLE
======================================================= */

function parseAidaRole(text: string) {
  return {
    should: extractLabeledList(text, [
      "Durante esta fase AIDA debe",
      "AIDA debe",
    ]),

    shouldNot: extractLabeledList(text, [
      "AIDA no debe",
    ]),
  };
}

/* =======================================================
   HELPERS
======================================================= */

function getSection(
  sections: ProtocolSections,
  keys: readonly string[]
): string {
  for (const key of keys) {
    const value = sections[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function extractHeadingBullets(
  text: string,
  headings: string[]
): string[] {
  const blocks = extractSubsections(text);

  for (const heading of headings) {
    const normalizedHeading = normalizeForComparison(heading);

    const match = blocks.find(
      ({ title }) =>
        normalizeForComparison(title) === normalizedHeading
    );

    if (match) {
      return extractBullets(match.body);
    }
  }

  return [];
}

function extractSubsectionBullets(
  text: string,
  headings: string[]
): string[] {
  const blocks = extractSubsections(text);
  const normalizedHeadings = headings.map(
    normalizeForComparison
  );

  const match = blocks.find(({ title }) =>
    normalizedHeadings.includes(
      normalizeForComparison(title)
    )
  );

  return match ? extractBullets(match.body) : [];
}

function extractSubsectionNarrative(
  text: string,
  headings: string[]
): string {
  const blocks = extractSubsections(text);
  const normalizedHeadings = headings.map(
    normalizeForComparison
  );

  const match = blocks.find(({ title }) =>
    normalizedHeadings.includes(
      normalizeForComparison(title)
    )
  );

  return match ? cleanNarrative(match.body) : "";
}

function extractSubsections(
  text: string
): Array<{ title: string; body: string }> {
  const normalized = normalizeNewlines(text);
  const regex = /^##\s+(.+?)\s*$([\s\S]*?)(?=^##\s+|\s*$)/gm;
  const result: Array<{ title: string; body: string }> = [];

  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    result.push({
      title: cleanInline(match[1]),
      body: match[2].trim(),
    });
  }

  return result;
}

function extractLabeledValue(
  text: string,
  labels: string[]
): string {
  const lines = normalizeNewlines(text).split("\n");

  for (const label of labels) {
    const normalizedLabel = normalizeForComparison(label);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) continue;

      const left = normalizeForComparison(
        line.slice(0, separatorIndex)
      );

      if (left !== normalizedLabel) continue;

      return cleanInline(
        line.slice(separatorIndex + 1)
      );
    }
  }

  return "";
}

function extractLabeledBlock(
  text: string,
  labels: string[]
): string {
  const normalized = normalizeNewlines(text);

  for (const label of labels) {
    const pattern = new RegExp(
      `^${escapeRegExp(label)}:\\s*(.*(?:\\n(?!\\s*(?:[\\wÁÉÍÓÚÜÑáéíóúüñ ]+):).*)*)`,
      "im"
    );

    const match = normalized.match(pattern);

    if (match?.[1]) {
      const block = match[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line &&
            line !== "---" &&
            !line.startsWith("## ")
        )
        .join(" ");

      return cleanInline(block);
    }
  }

  return "";
}

function extractLabeledList(
  text: string,
  labels: string[]
): string[] {
  const block = extractBlockAfterLabel(text, labels);

  return block ? extractBullets(block) : [];
}

function extractLabeledListOrText(
  text: string,
  labels: string[]
): string[] {
  const block = extractBlockAfterLabel(text, labels);

  if (!block) return [];

  const bullets = extractBullets(block);

  if (bullets.length > 0) {
    return bullets;
  }

  const narrative = cleanNarrative(block);

  return narrative ? [narrative] : [];
}

function extractBlockAfterLabel(
  text: string,
  labels: string[]
): string {
  const normalized = normalizeNewlines(text);

  for (const label of labels) {
    const regex = new RegExp(
      `^${escapeRegExp(label)}:\\s*\\n?([\\s\\S]*?)(?=^[^\\n#-][^\\n]*:\\s*$|^##\\s+|^---\\s*$|$)`,
      "im"
    );

    const match = normalized.match(regex);

    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return "";
}

function extractAllPortionBlocks(
  text: string
): string[] {
  const normalized = normalizeNewlines(text);
  const regex =
    /^(Porción(?: habitual| sugerida)?|Porcion(?: habitual| sugerida)?|Límite máximo|Limite maximo):\s*\n?([\s\S]*?)(?=^[^#\n][^:\n]{1,80}:\s*$|^##\s+|^---\s*$|$)/gim;

  const result: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const label = cleanInline(match[1]);
    const body = cleanNarrative(match[2]);

    if (body) {
      result.push(`${label}: ${body}`);
    }
  }

  return uniqueStrings(result);
}

function parseNumberedItems(text: string): string[] {
  return normalizeNewlines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) =>
      line.replace(/^\d+\.\s*/, "").trim()
    )
    .filter(Boolean);
}

function parseNumberedOrBulletedItems(
  text: string
): string[] {
  return uniqueStrings([
    ...parseNumberedItems(text),
    ...extractBullets(text),
  ]);
}

function extractBullets(
  text: string
): string[] {
  return normalizeNewlines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) =>
      line.replace(/^[-*]\s+/, "").trim()
    )
    .filter(Boolean);
}

function extractSentences(text: string): string[] {
  const narrative = cleanNarrative(removeBullets(text));

  if (!narrative) return [];

  return uniqueStrings(
    narrative
      .split(/(?<=[.!?])\s+/)
      .map(cleanInline)
      .filter(Boolean)
  );
}

function findSentence(
  text: string,
  pattern: RegExp
): string {
  return (
    extractSentences(text).find((sentence) =>
      pattern.test(sentence)
    ) ?? ""
  );
}

function cleanNarrative(text: string): string {
  return normalizeNewlines(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        line !== "---" &&
        !line.startsWith("## ") &&
        !/^[-*]\s+/.test(line)
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeBullets(text: string): string {
  return normalizeNewlines(text)
    .split("\n")
    .filter(
      (line) => !/^\s*[-*]\s+/.test(line)
    )
    .join("\n");
}

function cleanInline(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function normalizeForComparison(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(
  values: string[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanInline(value);

    if (!cleaned) continue;

    const key = normalizeForComparison(cleaned);

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function looksLikeInstruction(
  value: string
): boolean {
  return /cuenta|combinar|recordar|debe|puede|preferentemente|porci[oó]n/i.test(
    value
  );
}

function looksLikeTimeOrPortion(
  value: string
): boolean {
  return /\b(?:taza|gramos?|horas?|comida|desayuno|cena|pm|am|%)\b/i.test(
    value
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}