// app/lib/aida2/modules/protocolModule.ts

import fs from "fs";
import path from "path";

import { buildStructuredProtocol } from "./protocolParsers";

export type ProtocolId =
  | "DIAGNOSTICO_7_DIAS"
  | "FASE_1"
  | "FASE_2"
  | "FASE_3";

export type ProtocolSections = Record<string, string>;

export type ProtocolModuleInput = {
  protocolId?: ProtocolId;
};

export type ProtocolModuleOutput = {
  protocolId: ProtocolId;
  protocolName: string;
  sourceFile: string;

  sections: ProtocolSections;

  structured: ReturnType<typeof buildStructuredProtocol>;
};

const PROTOCOL_FILES: Record<ProtocolId, string> = {
  DIAGNOSTICO_7_DIAS: "docs/protocols/diagnostico_7_dias.md",
  FASE_1: "docs/protocols/fase1.md",
  FASE_2: "docs/protocols/fase2.md",
  FASE_3: "docs/protocols/fase3.md",
};

const SECTION_MAP: Record<string, string> = {
  "IDENTIFICACIÓN": "identification",
  "PROPÓSITO DEL PROTOCOLO": "purpose",
  "FILOSOFÍA DEL PROTOCOLO": "philosophy",
  "DISTRIBUCIÓN DEL PLATO": "plateDistribution",
  "PRINCIPIO GENERAL": "generalPrinciple",
  "LINEAMIENTOS GENERALES": "generalGuidelines",
  "ALIMENTOS NO RECOMENDADOS": "restrictedFoods",
  "FRUTAS": "fruits",
  "LEGUMINOSAS": "legumes",
  "CONSTRUCCIÓN DE PLATOS": "mealConstruction",
  "PORCIONES": "portions",
  "EJEMPLOS DE PLATOS": "examples",
  "HOJA DE CONTROL": "controlSheet",
  "PAPEL DE AIDA": "aidaRole",
  "LISTA DE ALIMENTOS PERMITIDOS": "allowedFoods",
};

function resolveProtocol(
  protocolId: ProtocolId = "DIAGNOSTICO_7_DIAS"
) {
  return {
    protocolId,
    protocolName:
      protocolId === "DIAGNOSTICO_7_DIAS"
        ? "Fase Diagnóstico 7 días"
        : protocolId.replaceAll("_", " "),
    sourceFile: PROTOCOL_FILES[protocolId],
  };
}

function readProtocol(file: string) {
  const absolute = path.join(process.cwd(), file);

  if (!fs.existsSync(absolute)) {
    throw new Error(`Protocol file not found: ${file}`);
  }

  return fs.readFileSync(absolute, "utf8");
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

export function runProtocolModule(
  input: ProtocolModuleInput = {}
): ProtocolModuleOutput {

  // Temporalmente todos los usuarios utilizan Diagnóstico 7 días.
  // Más adelante este valor vendrá desde Licencia / Perfil.

  const protocol = resolveProtocol(
    input.protocolId ?? "DIAGNOSTICO_7_DIAS"
  );

  const markdown = readProtocol(protocol.sourceFile);

  const sections = parseSections(markdown);

  const structured = buildStructuredProtocol(sections);

  return {

    protocolId: protocol.protocolId,

    protocolName: protocol.protocolName,

    sourceFile: protocol.sourceFile,

    sections,

    structured,

  };
}