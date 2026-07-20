import type OpenAI from "openai";
import { GENERAL_CONVERSATION_RULES } from "../experts/conversation";
import type { NutritionCandidate } from "../experts/nutrition";
import type { BrainRequest, CurrentTurnAnalysis, CurrentTurnAnalyzer } from "./contracts";

const DOMAINS = ["CONVERSATION", "NUTRITION", "CHEF", "GLUCOSE", "PROTOCOL"] as const;
const TYPES = ["GREETING", "GENERAL_EDUCATION", "PROTOCOL_STATUS", "GLUCOSE_READING", "FOOD_VALIDATION", "MEAL_OPTIONS", "BEVERAGE_OPTIONS", "RECIPE_STEPS"] as const;
const CATEGORIES = ["PROTEIN", "DAIRY", "HEALTHY_FAT", "VEGETABLE", "LEGUME", "FRUIT", "BEVERAGE", "SWEETENER", "CARBOHYDRATE", "UNKNOWN"] as const;
const LENGTHS = ["SHORT", "MEDIUM", "DETAILED"] as const;
const FOOD_SCHEMA = { type: "object", additionalProperties: false, required: ["name", "canonicalName", "category"],
  properties: { name: { type: "string" }, canonicalName: { type: ["string", "null"] },
    category: { type: "string", enum: CATEGORIES } } } as const;
const SCHEMA = { type: "object", additionalProperties: false, required: ["responseLength", "requests"], properties: {
  responseLength: { type: "string", enum: LENGTHS },
  requests: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false,
    required: ["id", "domain", "type", "topic", "answer", "valueMgDl", "moment", "foods", "count", "requiredEveryOption",
      "requiredAtLeastOne", "validateOnly", "exclude", "recipeIds"], properties: {
      id: { type: "string" }, domain: { type: "string", enum: DOMAINS },
      type: { type: "string", enum: TYPES }, topic: { type: "string" },
      answer: { type: "string" }, valueMgDl: { type: ["number", "null"] },
      moment: { type: ["string", "null"] }, foods: { type: "array", items: FOOD_SCHEMA },
      count: { type: ["integer", "null"], minimum: 1 }, requiredEveryOption: { type: "array", items: FOOD_SCHEMA },
      requiredAtLeastOne: { type: "array", items: FOOD_SCHEMA }, validateOnly: { type: "array", items: FOOD_SCHEMA },
      exclude: { type: "array", items: { type: "string" } }, recipeIds: { type: "array", items: { type: "string" } },
    } } },
} } as const;

type RawRequest = { id: string; domain?: typeof DOMAINS[number]; type: typeof TYPES[number]; topic: string; answer: string;
  valueMgDl: number | null; moment: string | null;
  foods: NutritionCandidate[]; count: number | null; requiredEveryOption: NutritionCandidate[];
  requiredAtLeastOne: NutritionCandidate[]; validateOnly: NutritionCandidate[]; exclude: string[]; recipeIds: string[] };

function defaultDomain(type: RawRequest["type"]): typeof DOMAINS[number] {
  if (type === "FOOD_VALIDATION") return "NUTRITION";
  if (type === "MEAL_OPTIONS" || type === "BEVERAGE_OPTIONS" || type === "RECIPE_STEPS") return "CHEF";
  if (type === "GLUCOSE_READING") return "GLUCOSE";
  if (type === "PROTOCOL_STATUS") return "PROTOCOL";
  return "CONVERSATION";
}

function request(raw: RawRequest): BrainRequest {
  if (!raw.id.trim() || !TYPES.includes(raw.type)) throw new Error("AIDA3_CURRENT_ANALYSIS_INVALID_REQUEST");
  const domain = raw.domain ?? defaultDomain(raw.type);
  if (raw.type === "GENERAL_EDUCATION" && domain === "NUTRITION" && raw.foods.length > 0) {
    return { id: raw.id, type: "FOOD_VALIDATION", foods: raw.foods };
  }
  if (domain !== defaultDomain(raw.type)) throw new Error("AIDA3_CURRENT_ANALYSIS_DOMAIN_MISMATCH");
  if (raw.type === "GREETING") return { id: raw.id, type: raw.type };
  if (raw.type === "GENERAL_EDUCATION") {
    if (!raw.topic.trim() || !raw.answer.trim()) throw new Error("AIDA3_CURRENT_ANALYSIS_GENERAL_ANSWER_MISSING");
    return { id: raw.id, type: raw.type, topic: raw.topic.trim(), answer: raw.answer.trim() };
  }
  if (raw.type === "PROTOCOL_STATUS") return { id: raw.id, type: raw.type };
  if (raw.type === "GLUCOSE_READING") {
    if (typeof raw.valueMgDl !== "number") throw new Error("AIDA3_CURRENT_ANALYSIS_GLUCOSE_MISSING");
    return { id: raw.id, type: raw.type, valueMgDl: raw.valueMgDl, moment: raw.moment };
  }
  if (raw.type === "FOOD_VALIDATION") return { id: raw.id, type: raw.type, foods: raw.foods };
  if (raw.type === "MEAL_OPTIONS") {
    if (!Number.isInteger(raw.count) || (raw.count ?? 0) < 1) throw new Error("AIDA3_CURRENT_ANALYSIS_COUNT_MISSING");
    return { id: raw.id, type: raw.type, count: raw.count!, requiredEveryOption: raw.requiredEveryOption,
      requiredAtLeastOne: raw.requiredAtLeastOne, validateOnly: raw.validateOnly };
  }
  if (raw.type === "BEVERAGE_OPTIONS") {
    if (!Number.isInteger(raw.count) || (raw.count ?? 0) < 1) throw new Error("AIDA3_CURRENT_ANALYSIS_COUNT_MISSING");
    return { id: raw.id, type: raw.type, count: raw.count!, exclude: raw.exclude };
  }
  return { id: raw.id, type: "RECIPE_STEPS", recipeIds: raw.recipeIds };
}

export class OpenAiCurrentTurnAnalyzer implements CurrentTurnAnalyzer {
  constructor(private readonly openai: OpenAI,
    private readonly model = process.env.OPENAI_SEMANTIC_MODEL ?? "gpt-4.1-mini") {}

  async analyze(input: Parameters<CurrentTurnAnalyzer["analyze"]>[0]): Promise<CurrentTurnAnalysis> {
    const response = await this.openai.responses.create({ model: this.model, instructions: [
      "Eres exclusivamente el enrutador de AIDA. Primero asigna un domain y después un type a cada solicitud. No tomes decisiones clínicas. Sólo redacta answer cuando domain sea CONVERSATION y type sea GENERAL_EDUCATION.",
      "Nunca conviertas datos del contexto en solicitudes. El contexto sólo resuelve referencias explícitas como 'la opción 2'.",
      "GREETING es sólo saludo. GLUCOSE_READING registra el número indicado y no crea solicitudes de comida.",
      "PROTOCOL_STATUS se usa cuando el paciente pregunta en qué fase o protocolo se encuentra.",
      "CONVERSATION cubre conversación cotidiana y educación general que no requiere una decisión personal. NUTRITION cubre cualquier pregunta sobre si la persona puede comer, combinar, sustituir o validar un alimento.",
      "Ejemplos: qué es diabetes, resistencia a la insulina, glucosa, hemoglobina glucosilada, metabolismo, carbohidratos, fibra, sueño o ejercicio en términos generales.",
      "Regla obligatoria: preguntas como ¿puedo comer atún?, ¿me conviene el pan? o ¿es válida esta comida? son domain NUTRITION y type FOOD_VALIDATION; nunca GENERAL_EDUCATION.",
      "Para GENERAL_EDUCATION redacta la respuesta final en answer y el tema breve en topic. Resuelve referencias usando sólo la conversación reciente. No crees otra solicitud salvo que el mensaje también la pida explícitamente.",
      ...GENERAL_CONVERSATION_RULES,
      "FOOD_VALIDATION valida alimentos sin pedir recetas. MEAL_OPTIONS conserva exactamente la cantidad solicitada.",
      "En MEAL_OPTIONS: requiredEveryOption contiene lo que debe aparecer en todas; requiredAtLeastOne lo que debe aparecer al menos en una; validateOnly lo que sólo se consulta.",
      "BEVERAGE_OPTIONS es independiente y conserva cantidad y exclusiones. RECIPE_STEPS contiene únicamente ids resueltos de recetas elegidas.",
      "Usa SHORT para saludo, registro o pregunta sencilla; MEDIUM para varias solicitudes; DETAILED sólo para receta paso a paso.",
      "Domain y type deben ser coherentes. Completa todos los campos del esquema; usa null, arreglos vacíos o cadenas vacías cuando no correspondan.",
    ].join("\n"), input: JSON.stringify({ currentMessage: input.currentMessage,
      recentConversation: input.referenceContext.recentConversation ?? [],
      culinaryReferences: { selectedRecipeId: input.referenceContext.selectedRecipeId ?? null,
        availableRecipes: input.referenceContext.availableRecipes ?? [],
        pendingClarification: input.referenceContext.pendingClarification ?? null } }),
    text: { format: { type: "json_schema", name: "aida3_current_turn_analysis", strict: true, schema: SCHEMA } },
    }, { timeout: Number(process.env.OPENAI_SEMANTIC_TIMEOUT_MS ?? 12_000), maxRetries: 0 });
    const output = response.output_text?.trim();
    if (!output) throw new Error("AIDA3_CURRENT_ANALYSIS_EMPTY");
    let parsed: { responseLength?: unknown; requests?: unknown };
    try { parsed = JSON.parse(output) as typeof parsed; } catch { throw new Error("AIDA3_CURRENT_ANALYSIS_INVALID_JSON"); }
    if (!LENGTHS.includes(parsed.responseLength as typeof LENGTHS[number]) || !Array.isArray(parsed.requests)) {
      throw new Error("AIDA3_CURRENT_ANALYSIS_INVALID_OUTPUT");
    }
    return { currentMessage: input.currentMessage, responseLength: parsed.responseLength as CurrentTurnAnalysis["responseLength"],
      requests: (parsed.requests as RawRequest[]).map(request) };
  }
}
