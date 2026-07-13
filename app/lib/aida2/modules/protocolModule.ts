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

export type ProtocolDecisionStatus =
  | "ALLOWED"
  | "ALLOWED_WITH_VALIDATION"
  | "NOT_ALLOWED"
  | "UNKNOWN";

export type ProtocolFoodCategory =
  | "PROTEIN"
  | "DAIRY"
  | "HEALTHY_FAT"
  | "VEGETABLE"
  | "LEGUME"
  | "FRUIT"
  | "BEVERAGE"
  | "OPERATIONAL_CATEGORY"
  | "UNKNOWN";

export type ProtocolFoodDecision = {
  protocolId: ProtocolId;
  protocolVersion: string;
  requestedFood: string;
  canonicalFood: string | null;
  category: ProtocolFoodCategory;
  status: ProtocolDecisionStatus;
  reason: string;
  shouldMeasureGlucose: boolean;
  validationRules: ReturnType<
    typeof buildStructuredProtocol
  >["validationRules"];
};

export type ProtocolModuleOutput = {
  protocolId: ProtocolId;
  protocolName: string;
  protocolVersion: string;
  sourceFile: string;
  sections: ProtocolSections;
  structured: ReturnType<typeof buildStructuredProtocol>;
};

type CachedProtocol = {
  modifiedAtMs: number;
  output: ProtocolModuleOutput;
};

type FoodGroup = {
  category: ProtocolFoodCategory;
  foods: string[];
};

const PROTOCOL_FILES: Record<ProtocolId, string> = {
  DIAGNOSTICO_7_DIAS: "docs/protocols/diagnostico_7_dias.md",
  FASE_1: "docs/protocols/fase1.md",
  FASE_2: "docs/protocols/fase2.md",
};

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

function parseSections(markdown: string): ProtocolSections {
  const result: ProtocolSections = {};
  const lines = markdown.split("\n");

  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("# ")) {
      const title = line.replace(/^#\s*/, "").trim().toUpperCase();

      currentKey =
        SECTION_MAP[title] ??
        title
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
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
  const sections = parseSections(params.markdown);
  const structured = buildStructuredProtocol(sections);

  return {
    protocolId: params.protocolId,
    protocolName: params.protocolName,
    protocolVersion: buildProtocolVersion(params.markdown),
    sourceFile: params.sourceFile,
    sections,
    structured,
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestMatch(
  requestedFood: string,
  foods: string[]
): string | null {
  const normalizedRequested = normalizeText(requestedFood);

  if (!normalizedRequested) {
    return null;
  }

  const exactMatch = foods.find(
    (food) => normalizeText(food) === normalizedRequested
  );

  if (exactMatch) {
    return exactMatch;
  }

  const orderedFoods = [...foods].sort(
    (a, b) => normalizeText(b).length - normalizeText(a).length
  );

  return (
    orderedFoods.find((food) => {
      const normalizedFood = normalizeText(food);

      return (
        normalizedRequested.includes(normalizedFood) ||
        normalizedFood.includes(normalizedRequested)
      );
    }) ?? null
  );
}

function getAllowedFoodGroups(
  protocol: ProtocolModuleOutput
): FoodGroup[] {
  const foods = protocol.structured.allowedFoods;

  return [
    { category: "PROTEIN", foods: foods.proteins },
    { category: "DAIRY", foods: foods.dairy },
    { category: "HEALTHY_FAT", foods: foods.healthyFats },
    { category: "VEGETABLE", foods: foods.vegetables },
    { category: "LEGUME", foods: foods.legumes },
    { category: "FRUIT", foods: foods.fruits },
    { category: "BEVERAGE", foods: foods.beverages },
  ];
}

function findAllowedFood(
  requestedFood: string,
  protocol: ProtocolModuleOutput
): {
  canonicalFood: string;
  category: ProtocolFoodCategory;
} | null {
  for (const group of getAllowedFoodGroups(protocol)) {
    const match = findBestMatch(requestedFood, group.foods);

    if (match) {
      return {
        canonicalFood: match,
        category: group.category,
      };
    }
  }

  return null;
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

export function validateFoodWithProtocol(params: {
  protocolId: ProtocolId;
  food: string;
}): ProtocolFoodDecision {
  const protocol = runProtocolModule({
    protocolId: params.protocolId,
  });

  const requestedFood = params.food.trim();
  const validationRules = protocol.structured.validationRules;

  const conditionalMatch = findBestMatch(
    requestedFood,
    protocol.structured.operationalCategories.conditional
  );

  if (conditionalMatch) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: conditionalMatch,
      category: "OPERATIONAL_CATEGORY",
      status: "ALLOWED_WITH_VALIDATION",
      reason:
        "El protocolo activo permite este alimento únicamente bajo sus condiciones de validación.",
      shouldMeasureGlucose: validationRules.required,
      validationRules,
    };
  }

  const restrictedMatch = findBestMatch(
    requestedFood,
    protocol.structured.restrictedFoods
  );

  if (restrictedMatch) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: restrictedMatch,
      category: "UNKNOWN",
      status: "NOT_ALLOWED",
      reason:
        "El protocolo activo incluye este alimento entre los no recomendados.",
      shouldMeasureGlucose: false,
      validationRules,
    };
  }

  const allowedFood = findAllowedFood(
    requestedFood,
    protocol
  );

  if (allowedFood) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: allowedFood.canonicalFood,
      category: allowedFood.category,
      status: "ALLOWED",
      reason:
        "El alimento aparece dentro de las listas permitidas del protocolo activo.",
      shouldMeasureGlucose: false,
      validationRules,
    };
  }

  const operationalAllowedMatch = findBestMatch(
    requestedFood,
    protocol.structured.operationalCategories.allowed
  );

  if (operationalAllowedMatch) {
    return {
      protocolId: protocol.protocolId,
      protocolVersion: protocol.protocolVersion,
      requestedFood,
      canonicalFood: operationalAllowedMatch,
      category: "OPERATIONAL_CATEGORY",
      status: "ALLOWED",
      reason:
        "El alimento o su categoría aparece como permitido base en el protocolo activo.",
      shouldMeasureGlucose: false,
      validationRules,
    };
  }

  return {
    protocolId: protocol.protocolId,
    protocolVersion: protocol.protocolVersion,
    requestedFood,
    canonicalFood: null,
    category: "UNKNOWN",
    status: "UNKNOWN",
    reason:
      "El protocolo activo no contiene una regla suficiente para decidir sobre este alimento.",
    shouldMeasureGlucose: false,
    validationRules,
  };
}