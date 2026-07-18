import type OpenAI from "openai";

import type {
  FoodKnowledgeResolution,
  SemanticFoodInterpretation,
} from "./foodDecisionTypes";

function extractUrls(response: unknown) {
  const text = JSON.stringify(response);
  return [...text.matchAll(/https?:\\?\/\\?\/[^"\\\s]+/g)]
    .map(match => match[0].replaceAll("\\/", "/"))
    .filter((url, index, values) => values.indexOf(url) === index)
    .slice(0, 5);
}

function parseWebKnowledge(output: string) {
  const json = output.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    return {
      dishName: typeof value.dishName === "string" ? value.dishName.trim() : null,
      definition: typeof value.definition === "string" ? value.definition.trim() : null,
      baseIngredients: Array.isArray(value.baseIngredients)
        ? value.baseIngredients.filter((item): item is string => typeof item === "string")
        : [],
      styleReferences: Array.isArray(value.styleReferences)
        ? value.styleReferences.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

export async function resolveUnknownFoodKnowledge(params: {
  openai: OpenAI;
  userMessage: string;
  interpretation: SemanticFoodInterpretation;
}): Promise<{ interpretation: SemanticFoodInterpretation; knowledge: FoodKnowledgeResolution }> {
  const { openai, userMessage, interpretation } = params;
  const needsKnowledge =
    interpretation.semanticType === "unknown" ||
    interpretation.confidence < 0.55 ||
    (!interpretation.dishName && interpretation.baseIngredients.length === 0);

  if (!needsKnowledge) {
    return {
      interpretation,
      knowledge: {
        needed: false,
        resolved: true,
        definition: null,
        likelyBaseIngredients: [],
        sourceUrls: [],
        source: "not_needed",
      },
    };
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: [
        "Busca únicamente qué alimento o platillo describe el usuario.",
        "No des recomendaciones médicas ni decidas si puede comerlo.",
        "Identifica nombre, definición breve, ingrediente base y si otras palabras sólo indican forma o estilo.",
        "No asumas la receta exacta de un producto comercial.",
        "Responde exclusivamente JSON: {dishName, definition, baseIngredients, styleReferences}.",
        `Consulta: ${userMessage}`,
      ].join("\n"),
    });
    const output = response.output_text?.trim() ?? "";
    const parsed = parseWebKnowledge(output);
    if (!parsed?.dishName || parsed.baseIngredients.length === 0) {
      throw new Error("invalid_web_resolution");
    }

    return {
      interpretation: {
        ...interpretation,
        dishName: parsed.dishName,
        baseIngredients: parsed.baseIngredients,
        styleReferences: parsed.styleReferences,
        confidence: Math.max(interpretation.confidence, 0.6),
        source: "web_knowledge",
      },
      knowledge: {
        needed: true,
        resolved: true,
        definition: parsed.definition,
        likelyBaseIngredients: parsed.baseIngredients,
        sourceUrls: extractUrls(response),
        source: "web",
      },
    };
  } catch {
    return {
      interpretation,
      knowledge: {
        needed: true,
        resolved: false,
        definition: null,
        likelyBaseIngredients: [],
        sourceUrls: [],
        source: "unresolved",
      },
    };
  }
}
