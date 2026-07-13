// app/lib/aida2/modules/protocolModule.ts

import crypto from "crypto";
import fs from "fs";
import path from "path";

import { buildStructuredProtocol } from "./protocolParsers";

export type ProtocolId =
  | "DIAGNOSTICO_7_DIAS"
  | "FASE_1"
  | "FASE_2";

export type ProtocolSections = Record<string, string>;

export type ProtocolModuleInput = {
  protocolId?: ProtocolId;
};

export type ProtocolModuleOutput = {
  protocolId: ProtocolId;
  protocolName: string;
  protocolVersion: string;
  sourceFile: string;
  sections: ProtocolSections;
  structured: ReturnType<typeof buildStructuredProtocol>;
};

export type ProtocolFoodStatus =
  | "ALLOWED"
  | "ALLOWED_WITH_CONDITION"
  | "ALLOWED_WITH_VALIDATION"
  | "RESTRICTED"
  | "UNKNOWN";

export type ProtocolFoodCategory =
  | "allowed"
  | "allowedWithCondition"
  | "allowedWithValidation"
  | "restricted"
  | "unknown";

export type ProtocolFoodDecision = {
  protocolId: ProtocolId;
  protocolVersion: string;
  requestedFood: string;
  canonicalFood: string | null;
  category: ProtocolFoodCategory;
  status: ProtocolFoodStatus;
  reason: string;
  shouldMeasureGlucose: boolean;
};

export type ValidateFoodWithProtocolInput = {
  protocolId?: ProtocolId;
  food: string;
};

type CachedProtocol = {
  modifiedAtMs: number;
  output: ProtocolModuleOutput;
};

type FoodRule = {
  canonicalFood: string;
  normalizedFood: string;
  category: Exclude<ProtocolFoodCategory, "unknown">;
  status: Exclude<ProtocolFoodStatus, "UNKNOWN">;
  shouldMeasureGlucose: boolean;
  priority: number;
};

const PROTOCOL_FILES: Record<ProtocolId, string> = {
  DIAGNOSTICO_7_DIAS: "docs/protocols/diagnostico_7_dias.md",
  FASE_1: "docs/protocols/fase1.md",
  FASE_2: "docs/protocols/fase2.md",
};

// FASE_3 queda reservada para una etapa futura fuera de AIDA2,
// posiblemente enfocada en resistencia a la insulina, músculo,
// recomposición corporal y mantenimiento metabólico avanzado.

const PROTOCOL_NAMES: Record<ProtocolId, string> = {
  DIAGNOSTICO_7_DIAS: "Fase Diagnóstico 7 días",
  FASE_1: "Fase 1 - Vencer los Antojos",
  FASE_2: "Fase 2 - Reeducar Células Grasas y Fortalecer el Páncreas",
};

const SECTION_MAP: Record<string, string> = {
  "IDENTIFICACIÓN": "identification",
  "PROPÓSITO DEL PROTOCOLO": "purpose",
  "FILOSOFÍA DEL PROTOCOLO": "philosophy",
  "DISTRIBUCIÓN DEL PLATO": "plateDistribution",
  "PRINCIPIO GENERAL": "generalPrinciple",
  "LINEAMIENTOS GENERALES": "generalGuidelines",
  "CATEGORÍAS OPERATIVAS": "operationalCategories",
  "CATEGORIAS OPERATIVAS": "operationalCategories",
  "ALIMENTOS NO RECOMENDADOS": "restrictedFoods",
  "FRUTAS": "fruits",
  "LEGUMINOSAS": "legumes",
  "CONSTRUCCIÓN DE PLATOS": "mealConstruction",
  "PORCIONES": "portions",
  "EJEMPLOS DE PLATOS": "examples",
  "HOJA DE CONTROL": "controlSheet",
  "PAPEL DE AIDA": "aidaRole",
  "LISTA DE ALIMENTOS PERMITIDOS": "allowedFoods",
  "REGLA DE VALIDACIÓN DE CARBOHIDRATOS": "validationRule",
  "REGLA DE VALIDACION DE CARBOHIDRATOS": "validationRule",
  "CRITERIOS DE AVANCE": "advancementCriteria",
};

const protocolCache = new Map<ProtocolId, CachedProtocol>();

function resolveProtocol(
  protocolId: ProtocolId = "DIAGNOSTICO_7_DIAS"
) {
  return {
    protocolId,
    protocolName: PROTOCOL_NAMES[protocolId],
    sourceFile: PROTOCOL_FILES[protocolId],
  };
}

function resolveAbsolutePath(file: string) {
  return path.join(process.cwd(), file);
}

function readProtocol(absolutePath: string) {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Protocol file not found: ${absolutePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function getModifiedAtMs(absolutePath: string) {
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Protocol file not found: ${absolutePath}`);
  }

  return fs.statSync(absolutePath).mtimeMs;
}

function buildProtocolVersion(markdown: string) {
  return crypto
    .createHash("sha256")
    .update(markdown, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function normalizeSectionTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseSections(markdown: string): ProtocolSections {
  const result: ProtocolSections = {};
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^#\s+/.test(line)) {
      const rawTitle = line.replace(/^#\s*/, "").trim();
      const normalizedTitle = normalizeSectionTitle(rawTitle);

      const mappedEntry = Object.entries(SECTION_MAP).find(
        ([title]) => normalizeSectionTitle(title) === normalizedTitle
      );

      currentKey =
        mappedEntry?.[1] ??
        rawTitle
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "_");

      result[currentKey] = "";
      continue;
    }

    if (!currentKey) continue;

    result[currentKey] += rawLine + "\n";
  }

  Object.keys(result).forEach((key) => {
    result[key] = result[key].trim();
  });

  return result;
}

function buildProtocolOutput(params: {
  protocolId: ProtocolId;
  protocolName: string;
  sourceFile: string;
  markdown: string;
}): ProtocolModuleOutput {
  const {
    protocolId,
    protocolName,
    sourceFile,
    markdown,
  } = params;

  const sections = parseSections(markdown);
  const structured = buildStructuredProtocol(sections);

  return {
    protocolId,
    protocolName,
    protocolVersion: buildProtocolVersion(markdown),
    sourceFile,
    sections,
    structured,
  };
}

function normalizeFood(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()[\]{}.,;:!?¿¡"'`´]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueFoodNames(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();

    if (!cleaned) continue;

    const normalized = normalizeFood(cleaned);

    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    result.push(cleaned);
  }

  return result;
}

function flattenAllowedFoods(
  allowedFoods: ProtocolModuleOutput["structured"]["allowedFoods"]
) {
  return uniqueFoodNames([
    ...allowedFoods.proteins,
    ...allowedFoods.dairy,
    ...allowedFoods.healthyFats,
    ...allowedFoods.vegetables,
    ...allowedFoods.legumes,
    ...allowedFoods.fruits,
    ...allowedFoods.beverages,
  ]);
}

function buildFoodRules(
  protocol: ProtocolModuleOutput
): FoodRule[] {
  const { structured } = protocol;

  const restricted = uniqueFoodNames([
    ...structured.restrictedFoods,
    ...structured.operationalCategories.restricted,
    ...structured.fruits.restricted,
  ]);

  const allowedWithValidation = uniqueFoodNames([
    ...structured.operationalCategories.allowedWithValidation,
  ]);

  const allowedWithCondition = uniqueFoodNames([
    ...structured.operationalCategories.allowedWithCondition,
    ...structured.legumes.foods,
    ...structured.fruits.foods,
  ]);

  const allowed = uniqueFoodNames([
    ...structured.operationalCategories.allowed,
    ...flattenAllowedFoods(structured.allowedFoods),
  ]);

  const rules: FoodRule[] = [];

  const appendRules = (
    foods: string[],
    rule: Omit<FoodRule, "canonicalFood" | "normalizedFood">
  ) => {
    for (const food of foods) {
      rules.push({
        canonicalFood: food,
        normalizedFood: normalizeFood(food),
        ...rule,
      });
    }
  };

  appendRules(restricted, {
    category: "restricted",
    status: "RESTRICTED",
    shouldMeasureGlucose: false,
    priority: 400,
  });

  appendRules(allowedWithValidation, {
    category: "allowedWithValidation",
    status: "ALLOWED_WITH_VALIDATION",
    shouldMeasureGlucose: true,
    priority: 300,
  });

  appendRules(allowedWithCondition, {
    category: "allowedWithCondition",
    status: "ALLOWED_WITH_CONDITION",
    shouldMeasureGlucose: false,
    priority: 200,
  });

  appendRules(allowed, {
    category: "allowed",
    status: "ALLOWED",
    shouldMeasureGlucose: false,
    priority: 100,
  });

  return rules;
}

function containsWholePhrase(
  fullText: string,
  phrase: string
) {
  if (!fullText || !phrase) return false;

  return ` ${fullText} `.includes(` ${phrase} `);
}

function getRuleMatchScore(
  requestedFood: string,
  ruleFood: string
) {
  if (!requestedFood || !ruleFood) return -1;

  if (requestedFood === ruleFood) {
    return 10_000 + ruleFood.length;
  }

  if (containsWholePhrase(requestedFood, ruleFood)) {
    return 5_000 + ruleFood.length;
  }

  if (containsWholePhrase(ruleFood, requestedFood)) {
    return 1_000 + requestedFood.length;
  }

  return -1;
}

function findBestFoodRule(
  requestedFood: string,
  rules: FoodRule[]
) {
  const normalizedRequestedFood = normalizeFood(requestedFood);

  return rules
    .map((rule) => ({
      rule,
      matchScore: getRuleMatchScore(
        normalizedRequestedFood,
        rule.normalizedFood
      ),
    }))
    .filter(({ matchScore }) => matchScore >= 0)
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      if (right.rule.normalizedFood.length !== left.rule.normalizedFood.length) {
        return (
          right.rule.normalizedFood.length -
          left.rule.normalizedFood.length
        );
      }

      return right.rule.priority - left.rule.priority;
    })[0]?.rule;
}

function buildValidationReason(
  protocol: ProtocolModuleOutput
) {
  const rule = protocol.structured.validationRule;
  const details: string[] = [];

  if (rule.measurementTiming) {
    details.push(`medir glucosa ${rule.measurementTiming}`);
  }

  if (rule.targetMaxMgDl !== null) {
    details.push(
      `usar ${rule.targetMaxMgDl} mg/dL como límite de referencia`
    );
  }

  if (rule.toleratedAction) {
    details.push(rule.toleratedAction);
  }

  if (details.length === 0) {
    return "El protocolo permite este alimento únicamente con validación de la respuesta de glucosa.";
  }

  return `El protocolo permite este alimento con validación: ${details.join(
    "; "
  )}.`;
}

function buildDecisionReason(
  protocol: ProtocolModuleOutput,
  rule: FoodRule
) {
  switch (rule.status) {
    case "RESTRICTED":
      return `El protocolo activo clasifica “${rule.canonicalFood}” como alimento no recomendado o restringido.`;

    case "ALLOWED_WITH_VALIDATION":
      return buildValidationReason(protocol);

    case "ALLOWED_WITH_CONDITION":
      return `El protocolo activo permite “${rule.canonicalFood}” únicamente bajo las condiciones y porciones definidas en el Markdown.`;

    case "ALLOWED":
      return `El protocolo activo incluye “${rule.canonicalFood}” entre los alimentos permitidos.`;
  }
}

export function clearProtocolCache(protocolId?: ProtocolId) {
  if (protocolId) {
    protocolCache.delete(protocolId);
    return;
  }

  protocolCache.clear();
}

export function runProtocolModule(
  input: ProtocolModuleInput = {}
): ProtocolModuleOutput {
  const protocol = resolveProtocol(
    input.protocolId ?? "DIAGNOSTICO_7_DIAS"
  );

  const absolutePath = resolveAbsolutePath(protocol.sourceFile);
  const modifiedAtMs = getModifiedAtMs(absolutePath);
  const cached = protocolCache.get(protocol.protocolId);

  if (cached && cached.modifiedAtMs === modifiedAtMs) {
    return cached.output;
  }

  const markdown = readProtocol(absolutePath);

  const output = buildProtocolOutput({
    protocolId: protocol.protocolId,
    protocolName: protocol.protocolName,
    sourceFile: protocol.sourceFile,
    markdown,
  });

  protocolCache.set(protocol.protocolId, {
    modifiedAtMs,
    output,
  });

  return output;
}

export function validateFoodWithProtocol(
  input: ValidateFoodWithProtocolInput
): ProtocolFoodDecision {
  const requestedFood = input.food.trim();
  const protocol = runProtocolModule({
    protocolId: input.protocolId ?? "DIAGNOSTICO_7_DIAS",
  });

  if (!requestedFood) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: null,
      category: "unknown",
      status: "UNKNOWN",
      reason: "No se recibió un alimento válido para consultar.",
      shouldMeasureGlucose: false,
    };
  }

  const rules = buildFoodRules(protocol);
  const matchedRule = findBestFoodRule(requestedFood, rules);

  if (!matchedRule) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: null,
      category: "unknown",
      status: "UNKNOWN",
      reason:
        "El alimento no aparece de forma suficientemente clara en las reglas del protocolo activo. No debe asumirse que está permitido ni restringido.",
      shouldMeasureGlucose: false,
    };
  }

  return {
    protocolId: protocol.protocolId,
    protocolVersion: protocol.protocolVersion,
    requestedFood,
    canonicalFood: matchedRule.canonicalFood,
    category: matchedRule.category,
    status: matchedRule.status,
    reason: buildDecisionReason(protocol, matchedRule),
    shouldMeasureGlucose: matchedRule.shouldMeasureGlucose,
  };
}