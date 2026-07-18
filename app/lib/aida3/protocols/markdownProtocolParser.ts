import type {
  OperationalProtocolConfig,
  ProtocolFoodCatalog,
  ProtocolPhase,
  ProtocolPolicyCatalog,
} from "./contracts";

const SECTION_NAMES: Record<string, string> = {
  "CONFIGURACION OPERATIVA": "operationalConfiguration", IDENTIFICACION: "identification",
  "PROPOSITO DEL PROTOCOLO": "purpose", "FILOSOFIA DEL PROTOCOLO": "philosophy",
  "DISTRIBUCION DEL PLATO": "plateDistribution", "PRINCIPIO GENERAL": "generalPrinciple",
  "LINEAMIENTOS GENERALES": "generalGuidelines", "ALIMENTOS NO RECOMENDADOS": "restrictedFoods",
  FRUTAS: "fruits", ENDULZANTES: "sweeteners", "ENDULZANTES Y AZUCAR": "sweeteners",
  LEGUMINOSAS: "legumes", "CONSTRUCCION DE PLATOS": "mealConstruction", PORCIONES: "portions",
  "EJEMPLOS DE PLATOS": "examples", "HOJA DE CONTROL": "controlSheet", "PAPEL DE AIDA": "aidaRole",
  "LISTA DE ALIMENTOS PERMITIDOS": "allowedFoods",
};

function normalizeHeading(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

export function parseProtocolSections(markdown: string) {
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  for (const rawLine of markdown.replace(/\r/g, "").split("\n")) {
    const levelTwoHeading = rawLine.match(/^##\s+(.+)$/)?.[1]?.trim();
    if (levelTwoHeading && normalizeHeading(levelTwoHeading) === "IDENTIFICACION") {
      currentKey = "identification";
      sections[currentKey] = "";
      continue;
    }
    const heading = rawLine.match(/^#\s+(.+)$/)?.[1]?.trim();
    if (heading) {
      const normalized = normalizeHeading(heading);
      if (normalized.startsWith("PROTOCOLO ")) { currentKey = null; continue; }
      currentKey = SECTION_NAMES[normalized] ?? normalized.toLowerCase().replace(/\s+/g, "_");
      sections[currentKey] = "";
      continue;
    }
    if (currentKey) sections[currentKey] += `${rawLine}\n`;
  }
  for (const key of Object.keys(sections)) sections[key] = sections[key].trim();
  return sections;
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Configuración operativa inválida: ${path}.`);
}

export function parseOperationalConfig(text: string, expectedPhase: ProtocolPhase): OperationalProtocolConfig {
  const json = text.match(/```json\s*([\s\S]*?)```/i)?.[1];
  if (!json) throw new Error("El protocolo no contiene configuración operativa JSON.");
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error("La configuración operativa no contiene JSON válido."); }
  const config = value as OperationalProtocolConfig;
  if (!config.version || config.phase !== expectedPhase) throw new Error(`La fase declarada no coincide con ${expectedPhase}.`);
  if (!Array.isArray(config.readings?.slots) || config.readings.slots.length !== 6) {
    throw new Error("La configuración operativa debe declarar seis horarios de medición.");
  }
  if (new Set(config.readings.slots).size !== 6) throw new Error("La configuración contiene horarios repetidos.");
  assertNumber(config.readings.hypoglycemiaBelow, "readings.hypoglycemiaBelow");
  assertNumber(config.readings.severeHypoglycemiaBelow, "readings.severeHypoglycemiaBelow");
  assertNumber(config.weeklyReview?.expectedReadings, "weeklyReview.expectedReadings");
  return config;
}

function bullets(text: string) {
  return text.split("\n").map(line => line.trim().match(/^[-*]\s+(.+)$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function subsection(text: string, wantedHeading: string) {
  const wanted = normalizeHeading(wantedHeading);
  const body: string[] = [];
  let collecting = false;
  for (const line of text.split("\n")) {
    const heading = line.match(/^##+\s+(.+)$/)?.[1]?.trim();
    if (heading) {
      if (collecting) break;
      collecting = normalizeHeading(heading) === wanted;
    } else if (collecting) body.push(line);
  }
  return body.join("\n");
}

function unique(values: string[]) {
  return [...new Map(values.map(value => [normalizeHeading(value), value])).values()];
}

export function parseFoodCatalog(sections: Readonly<Record<string, string>>): ProtocolFoodCatalog {
  const allowed = sections.allowedFoods ?? "";
  const sweetenerText = sections.sweeteners ?? "";
  const permittedSweeteners = sweetenerText.match(/Permitidos:\s*([\s\S]*?)(?=\n(?:No recomendados:|No permitidos:)|$)/i)?.[1] ?? "";
  const read = (heading: string) => unique(bullets(subsection(allowed, heading)));
  return {
    proteins: read("PROTEÍNAS"), dairy: read("LÁCTEOS"), healthyFats: read("GRASAS SALUDABLES"),
    vegetables: read("VEGETALES SIN ALMIDÓN"), legumes: read("LEGUMINOSAS"),
    fruits: read("FRUTAS PERMITIDAS"), beverages: read("BEBIDAS"), sweeteners: unique(bullets(permittedSweeteners)),
  };
}

export function parsePolicyCatalog(sections: Readonly<Record<string, string>>): ProtocolPolicyCatalog {
  const categories = sections.categorias_operativas ?? "";
  const restricted = sections.restrictedFoods ?? "";
  return {
    base: unique(bullets(subsection(categories, "Permitidos base"))),
    conditional: unique([
      ...bullets(subsection(categories, "Permitidos con condición")),
      ...bullets(subsection(categories, "Permitidos con validación")),
    ]),
    restricted: unique([
      ...bullets(subsection(categories, "No recomendados")),
      ...bullets(restricted),
    ]),
  };
}
