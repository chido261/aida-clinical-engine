import type OpenAI from "openai";
import type { SemanticRequest, SemanticRequestKind, SemanticTurnUnderstanding, SemanticUnderstandingProvider } from "./contracts";

const KINDS: SemanticRequestKind[] = ["FOOD_VALIDATION", "MEAL_OPTIONS", "BEVERAGE_OPTIONS", "RECIPE_STEPS", "SAFETY_REVIEW"];
const LENGTHS = ["SHORT", "MEDIUM", "DETAILED"] as const;

const OUTPUT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["responseLength", "requests"],
  properties: {
    responseLength: { type: "string", enum: LENGTHS },
    requests: { type: "array", minItems: 1, items: {
      type: "object", additionalProperties: false,
      required: ["id", "kind", "subject", "foods", "constraints", "dependsOn", "required"],
      properties: {
        id: { type: "string" }, kind: { type: "string", enum: KINDS }, subject: { type: "string" },
        foods: { type: "array", items: { type: "object", additionalProperties: false,
          required: ["name", "canonicalName", "category"], properties: {
            name: { type: "string" }, canonicalName: { type: ["string", "null"] },
            category: { type: "string", enum: ["PROTEIN", "DAIRY", "HEALTHY_FAT", "VEGETABLE", "LEGUME", "FRUIT", "BEVERAGE", "SWEETENER", "CARBOHYDRATE", "UNKNOWN"] },
          } }, },
        constraints: { type: "object", additionalProperties: false,
          required: ["count", "atLeastOneIncludes", "exclude", "recipeIds"], properties: {
            count: { type: ["integer", "null"], minimum: 1 },
            atLeastOneIncludes: { type: "array", items: { type: "string" } },
            exclude: { type: "array", items: { type: "string" } },
            recipeIds: { type: "array", items: { type: "string" } },
          } },
        dependsOn: { type: "array", items: { type: "string" } }, required: { type: "boolean" },
      },
    } },
  },
} as const;

function parseRequests(value: unknown): { responseLength: SemanticTurnUnderstanding["responseLength"]; requests: SemanticRequest[] } {
  if (!value || typeof value !== "object") throw new Error("AIDA3_SEMANTIC_OUTPUT_NOT_OBJECT");
  const record = value as Record<string, unknown>;
  if (!LENGTHS.includes(record.responseLength as typeof LENGTHS[number]) || !Array.isArray(record.requests) || record.requests.length === 0) {
    throw new Error("AIDA3_SEMANTIC_OUTPUT_INVALID");
  }
  for (const item of record.requests) {
    const request = item as Partial<SemanticRequest>;
    if (!request || typeof request !== "object" || typeof request.id !== "string" ||
      !KINDS.includes(request.kind as SemanticRequestKind) || typeof request.subject !== "string" ||
      !Array.isArray(request.foods) || !request.constraints || typeof request.constraints !== "object" ||
      !Array.isArray(request.dependsOn) || typeof request.required !== "boolean") {
      throw new Error("AIDA3_SEMANTIC_REQUEST_INVALID");
    }
  }
  return record as { responseLength: SemanticTurnUnderstanding["responseLength"]; requests: SemanticRequest[] };
}

export class OpenAiSemanticProvider implements SemanticUnderstandingProvider {
  constructor(private readonly openai: OpenAI, private readonly model = process.env.OPENAI_SEMANTIC_MODEL ?? "gpt-4.1-mini") {}

  async understand(params: { message: string; relevantContext: Record<string, unknown> }): Promise<SemanticTurnUnderstanding> {
    const response = await this.openai.responses.create({
      model: this.model,
      instructions: [
        "Eres la capa semántica de AIDA. Comprende y organiza; no tomes decisiones clínicas ni redactes la respuesta al paciente.",
        "Separa todas las solicitudes explícitas e implícitas sin perder cantidades, exclusiones ni obligaciones.",
        "La cantidad de opciones culinarias es dinámica: conserva exactamente la solicitada en constraints.count.",
        "FOOD_VALIDATION pertenece a NUTRITION; opciones, bebidas y receta paso a paso pertenecen a CHEF.",
        "Declara dependencias sólo cuando una tarea necesita el resultado de otra.",
        "Usa el contexto únicamente para resolver referencias como 'esa', 'la opción 2' o un platillo seleccionado.",
      ].join("\n"),
      input: JSON.stringify({ message: params.message, relevantContext: params.relevantContext }),
      text: { format: { type: "json_schema", name: "aida3_semantic_turn", strict: true, schema: OUTPUT_SCHEMA } },
    }, { timeout: Number(process.env.OPENAI_SEMANTIC_TIMEOUT_MS ?? 20_000), maxRetries: 0 });
    const output = response.output_text?.trim();
    if (!output) throw new Error("AIDA3_SEMANTIC_EMPTY_OUTPUT");
    let parsed: unknown;
    try { parsed = JSON.parse(output); } catch { throw new Error("AIDA3_SEMANTIC_INVALID_JSON"); }
    const understood = parseRequests(parsed);
    return { originalMessage: params.message, responseLength: understood.responseLength,
      requests: understood.requests, relevantContext: { ...params.relevantContext } };
  }
}
