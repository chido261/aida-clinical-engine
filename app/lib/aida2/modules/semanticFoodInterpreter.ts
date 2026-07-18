import type OpenAI from "openai";

import type { ProtocolModuleOutput } from "./protocolModule";
import type { SemanticFoodInterpretation } from "./foodDecisionTypes";

const EMPTY: Omit<SemanticFoodInterpretation, "originalText"> = {
  dishName: null,
  semanticType: "unknown",
  baseIngredients: [],
  declaredIngredients: [],
  styleReferences: [],
  isCommercialProduct: false,
  requiresClarification: false,
  clarificationReason: null,
  confidence: 0,
  source: "semantic_fallback",
};

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
    : [];
}

function parseInterpretation(text: string, originalText: string): SemanticFoodInterpretation | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const semanticTypes = new Set([
      "literal_food", "composite_dish", "plant_based_substitute",
      "shape_or_style", "commercial_product", "unknown",
    ]);
    return {
      originalText,
      dishName: typeof value.dishName === "string" ? value.dishName.trim() : null,
      semanticType: (typeof value.semanticType === "string" && semanticTypes.has(value.semanticType)
        ? value.semanticType
        : "unknown") as SemanticFoodInterpretation["semanticType"],
      baseIngredients: strings(value.baseIngredients),
      declaredIngredients: strings(value.declaredIngredients),
      styleReferences: strings(value.styleReferences),
      isCommercialProduct: value.isCommercialProduct === true,
      requiresClarification: value.requiresClarification === true,
      clarificationReason: typeof value.clarificationReason === "string" ? value.clarificationReason.trim() : null,
      confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
      source: "semantic_model",
    };
  } catch {
    return null;
  }
}

export async function interpretFoodSemantics(params: {
  openai: OpenAI;
  userMessage: string;
  protocol: ProtocolModuleOutput;
}): Promise<SemanticFoodInterpretation> {
  const { openai, userMessage, protocol } = params;
  const allowed = protocol.structured.allowedFoods;
  const protocolVocabulary = Object.values(allowed).flat().slice(0, 160).join(", ");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Interpreta semánticamente una consulta de comida. No decidas si está permitida.",
            "Distingue el alimento base de palabras que sólo describen forma, estilo o imitación.",
            "Ejemplos: atún de soya = sustituto con base soya y atún como referencia; pastel de carne = platillo con base carne; ceviche de lentejas = platillo con base lentejas y ceviche como estilo; arroz de coliflor = base coliflor.",
            "No inventes ingredientes. Los ingredientes probables no son ingredientes declarados.",
            "Palabras como vegano, sin azúcar, sin gluten o bajo en carbohidratos son restricciones, no ingredientes.",
            "requiresClarification sólo debe ser true cuando falta información que realmente podría cambiar la evaluación; una receta solicitada puede construirse usando ingredientes compatibles.",
            "Devuelve JSON con dishName, semanticType, baseIngredients, declaredIngredients, styleReferences, isCommercialProduct, requiresClarification, clarificationReason y confidence (0 a 1).",
            `Vocabulario del protocolo para reconocer equivalencias, no para decidir: ${protocolVocabulary}`,
          ].join("\n"),
        },
        { role: "user", content: userMessage },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (content) return parseInterpretation(content, userMessage) ?? { originalText: userMessage, ...EMPTY };
  } catch {
    // El flujo determinista continúa si el intérprete semántico no está disponible.
  }

  return { originalText: userMessage, ...EMPTY };
}
