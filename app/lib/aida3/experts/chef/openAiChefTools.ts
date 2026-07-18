import type OpenAI from "openai";
import type { ChefGenerationContext, GeneratedBeverage, RecipeInstructions, StoredRecipeOption } from "./contracts";

const MEALS_SCHEMA = { type: "object", additionalProperties: false, required: ["options"], properties: {
  options: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["id", "name", "ingredients", "description"], properties: {
      id: { type: "string" }, name: { type: "string" }, ingredients: { type: "array", items: { type: "string" } },
      description: { type: "string" },
    } } },
} } as const;
const BEVERAGES_SCHEMA = { type: "object", additionalProperties: false, required: ["beverages"], properties: {
  beverages: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["id", "name", "ingredients"], properties: { id: { type: "string" }, name: { type: "string" },
      ingredients: { type: "array", items: { type: "string" } } } } },
} } as const;
const RECIPE_SCHEMA = { type: "object", additionalProperties: false, required: ["recipeId", "title", "steps"], properties: {
  recipeId: { type: "string" }, title: { type: "string" }, steps: { type: "array", minItems: 1, items: { type: "string" } },
} } as const;

function json(text: string | undefined, errorCode: string) {
  if (!text?.trim()) throw new Error(errorCode);
  try { return JSON.parse(text); } catch { throw new Error(errorCode); }
}

export class OpenAiChefTools {
  constructor(private readonly openai: OpenAI, private readonly model = process.env.OPENAI_CHEF_MODEL ?? "gpt-4.1-mini") {}

  async generateMeals(context: ChefGenerationContext): Promise<StoredRecipeOption[]> {
    const response = await this.openai.responses.create({ model: this.model,
      instructions: ["Eres la herramienta de opciones del chef de AIDA.",
        "Genera exactamente count opciones distintas usando sólo approvedFoods y conditionalFoods.",
        "Nunca uses rejectedFoods. Cumple atLeastOneIncludes. No tomes decisiones clínicas.",
        "Si recibes validationFeedback, corrige cada violación indicada antes de responder.",
        "Usa ids option-1, option-2, etc."].join("\n"), input: JSON.stringify(context),
      text: { format: { type: "json_schema", name: "aida3_meal_options", strict: true, schema: MEALS_SCHEMA } },
    }, { timeout: Number(process.env.OPENAI_CHEF_TIMEOUT_MS ?? 25_000), maxRetries: 0 });
    return (json(response.output_text, "AIDA3_CHEF_INVALID_MEALS") as { options: StoredRecipeOption[] }).options;
  }

  async generateBeverages(context: ChefGenerationContext): Promise<GeneratedBeverage[]> {
    const response = await this.openai.responses.create({ model: this.model,
      instructions: ["Eres la herramienta de bebidas del chef de AIDA.",
        "Genera exactamente count bebidas compatibles con el protocolo y distintas de exclude.",
        "No agregues azúcar. Usa ids beverage-1, beverage-2, etc. No tomes otras decisiones clínicas."].join("\n"),
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", name: "aida3_beverage_options", strict: true, schema: BEVERAGES_SCHEMA } },
    }, { timeout: Number(process.env.OPENAI_CHEF_TIMEOUT_MS ?? 25_000), maxRetries: 0 });
    return (json(response.output_text, "AIDA3_CHEF_INVALID_BEVERAGES") as { beverages: GeneratedBeverage[] }).beverages;
  }

  async explain(recipe: StoredRecipeOption): Promise<RecipeInstructions> {
    const response = await this.openai.responses.create({ model: this.model,
      instructions: "Explica únicamente la receta recibida, con pasos claros y breves. No cambies nombre, id ni ingredientes.",
      input: JSON.stringify(recipe),
      text: { format: { type: "json_schema", name: "aida3_recipe_steps", strict: true, schema: RECIPE_SCHEMA } },
    }, { timeout: Number(process.env.OPENAI_CHEF_TIMEOUT_MS ?? 25_000), maxRetries: 0 });
    return json(response.output_text, "AIDA3_CHEF_INVALID_RECIPE") as RecipeInstructions;
  }
}
