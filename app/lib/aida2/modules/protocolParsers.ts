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
  schedule: string;
  foods: string[];
};

export function buildStructuredProtocol(
  sections: ProtocolSections
) {
  return {
    allowedFoods: parseAllowedFoods(
      sections.allowedFoods ?? ""
    ),

    fruits: parseFruits(
      sections.fruits ?? ""
    ),

    controlSheet: parseControlSheet(
      sections.controlSheet ?? ""
    ),
  };
}

/* =======================================================
   ALLOWED FOODS
======================================================= */

function parseAllowedFoods(
  text: string
): StructuredAllowedFoods {

  return {

    proteins: extractCategory(text, [
      "## PROTEÍNAS",
      "## LÁCTEOS"
    ]),

    dairy: extractCategory(text, [
      "## LÁCTEOS",
      "## GRASAS SALUDABLES"
    ]),

    healthyFats: extractCategory(text, [
      "## GRASAS SALUDABLES",
      "## VEGETALES SIN ALMIDÓN"
    ]),

    vegetables: extractCategory(text, [
      "## VEGETALES SIN ALMIDÓN",
      "## LEGUMINOSAS"
    ]),

    legumes: extractCategory(text, [
      "## LEGUMINOSAS",
      "## FRUTAS PERMITIDAS"
    ]),

    fruits: extractCategory(text, [
      "## FRUTAS PERMITIDAS",
      "## BEBIDAS"
    ]),

    beverages: extractCategory(text, [
      "## BEBIDAS"
    ])
  };
}

/* =======================================================
   FRUITS
======================================================= */

function parseFruits(
  text: string
): StructuredFruits {

  const scheduleMatch =
    text.match(/Horario permitido:([\s\S]*?)Restricciones:/i);

  const schedule =
    scheduleMatch?.[1]
      ?.replace(/\r/g, "")
      ?.replace(/\n/g, " ")
      ?.trim() ?? "";

  const foodsMatch =
    text.match(/Frutas permitidas:([\s\S]*?)Horario permitido:/i);

  const foods =
    foodsMatch
      ? extractBullets(foodsMatch[1])
      : [];

  return {

    schedule,

    foods

  };
}

/* =======================================================
   CONTROL SHEET
======================================================= */

function parseControlSheet(
  text: string
): string[] {

  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => /^\d+\.\s+/.test(line))
    .map(line => line.replace(/^\d+\.\s*/, ""));
}

/* =======================================================
   HELPERS
======================================================= */

function extractCategory(
  text: string,
  headers: string[]
): string[] {

  const start = text.indexOf(headers[0]);

  if (start === -1) return [];

  let end = text.length;

  if (headers[1]) {

    const next = text.indexOf(headers[1]);

    if (next !== -1) {

      end = next;

    }

  }

  return extractBullets(
    text.substring(start, end)
  );
}

function extractBullets(
  text: string
): string[] {

  return text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.startsWith("- "))
    .map(l => l.replace("- ", "").trim());
}