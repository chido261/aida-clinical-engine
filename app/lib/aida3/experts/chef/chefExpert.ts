import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import type { Aida3ExpertResult } from "../../core/contracts";
import type { CulinaryMemory } from "./culinaryMemory";
import {
  CHEF_EXPERT_ID, EXPLAIN_RECIPE_ACTION, GENERATE_BEVERAGE_OPTIONS_ACTION, GENERATE_MEAL_OPTIONS_ACTION,
  type BeverageOptionsTool, type ChefGenerationContext, type MealOptionsTool, type RecipeStepsTool,
  type StoredRecipeOption,
} from "./contracts";
import { validateRecipeDetailRequest } from "./recipeDetailPolicy";

type NutritionFood = { canonicalFood?: string; food?: string; status?: string };

function positiveCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function nutritionFoods(context: Aida3ExpertContext) {
  const foods = context.dependencyResults.flatMap(result => Array.isArray(result.data.foods) ? result.data.foods as NutritionFood[] : []);
  return {
    approved: foods.filter(food => food.status === "ALLOWED").map(food => food.canonicalFood ?? food.food ?? "").filter(Boolean),
    conditional: foods.filter(food => food.status === "CONDITIONAL").map(food => food.canonicalFood ?? food.food ?? "").filter(Boolean),
    rejected: foods.filter(food => food.status === "NOT_ALLOWED" || food.status === "UNKNOWN")
      .map(food => food.canonicalFood ?? food.food ?? "").filter(Boolean),
  };
}

export class ChefExpert implements Aida3Expert {
  readonly id = CHEF_EXPERT_ID;
  constructor(private readonly meals: MealOptionsTool, private readonly beverages: BeverageOptionsTool,
    private readonly recipes: RecipeStepsTool, private readonly memory: CulinaryMemory) {}

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    if (context.task.action === GENERATE_MEAL_OPTIONS_ACTION) return this.generateMeals(context);
    if (context.task.action === GENERATE_BEVERAGE_OPTIONS_ACTION) return this.generateBeverages(context);
    if (context.task.action === EXPLAIN_RECIPE_ACTION) return this.explainRecipe(context);
    return this.failed(context, "UNSUPPORTED_CHEF_ACTION");
  }

  private generationContext(context: Aida3ExpertContext): ChefGenerationContext | null {
    const count = positiveCount(context.task.input.count);
    const protocolId = context.task.input.protocolId;
    if (!count || typeof protocolId !== "string" || context.dependencyResults.length === 0) return null;
    const decisions = nutritionFoods(context);
    return { protocolId, approvedFoods: decisions.approved, conditionalFoods: decisions.conditional,
      count, constraints: { ...context.task.input, rejectedFoods: decisions.rejected } };
  }

  private async generateMeals(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    const input = this.generationContext(context);
    if (!input) return this.failed(context, "NUTRITION_DECISION_OR_COUNT_REQUIRED");
    let options: StoredRecipeOption[] = [];
    let violations: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      options = await this.meals.generate({ ...input, constraints: { ...input.constraints,
        ...(violations.length ? { validationFeedback: violations } : {}) } });
      violations = this.optionViolations(options, input.count, input.constraints.atLeastOneIncludes);
      if (violations.length === 0) break;
    }
    if (violations.length > 0) {
      return this.failed(context, "INVALID_MEAL_OPTIONS_TOOL_OUTPUT", {
        violations, requestedCount: input.count, receivedCount: options.length,
        receivedOptions: options.map(option => ({ id: option.id, name: option.name, ingredients: option.ingredients })),
      });
    }
    await this.memory.saveOptions(this.conversationId(context), options);
    return this.completed(context, "OPTIONS_GENERATED", { options, count: options.length }, `${options.length} opciones preparadas`);
  }

  private async generateBeverages(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    const input = this.generationContext(context);
    if (!input) return this.failed(context, "NUTRITION_DECISION_OR_COUNT_REQUIRED");
    const options = await this.beverages.generate(input);
    const excluded = Array.isArray(input.constraints.exclude) ? input.constraints.exclude.map(String).map(value => value.toLowerCase()) : [];
    if (options.length !== input.count || new Set(options.map(option => option.id)).size !== options.length ||
      options.some(option => excluded.includes(option.name.toLowerCase()))) {
      return this.failed(context, "INVALID_BEVERAGE_TOOL_OUTPUT");
    }
    return this.completed(context, "BEVERAGES_GENERATED", { beverages: options, count: options.length }, `${options.length} bebidas preparadas`);
  }

  private async explainRecipe(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    const recipeIds = Array.isArray(context.task.input.recipeIds) ? context.task.input.recipeIds.map(String) : [];
    const policy = validateRecipeDetailRequest({ recipeIds });
    if (!("recipeId" in policy)) return { taskId: context.task.id, expertId: this.id, status: policy.status,
      subject: context.task.subject, decision: "SELECT_ONE_RECIPE", patientSummary: policy.reason, data: {},
      missingUserFields: policy.missingUserFields, errorCode: null };
    const option = await this.memory.getOption(this.conversationId(context), policy.recipeId);
    if (!option) return { taskId: context.task.id, expertId: this.id, status: "NEEDS_USER_INPUT", subject: context.task.subject,
      decision: "RECIPE_NOT_IN_MEMORY", patientSummary: "Necesito que elijas una opción disponible de esta conversación.",
      data: {}, missingUserFields: ["selectedRecipeId"], errorCode: null };
    const instructions = await this.recipes.explain(option);
    if (instructions.recipeId !== option.id || instructions.title !== option.name || instructions.steps.length === 0) {
      return this.failed(context, "INVALID_RECIPE_TOOL_OUTPUT");
    }
    return this.completed(context, "RECIPE_EXPLAINED", { recipe: option, instructions }, instructions.title);
  }

  private optionViolations(options: StoredRecipeOption[], count: number, required: unknown) {
    const violations: string[] = [];
    if (options.length !== count) violations.push(`COUNT_MISMATCH:expected=${count}:received=${options.length}`);
    if (new Set(options.map(option => option.id)).size !== options.length) violations.push("DUPLICATE_OPTION_IDS");
    if (options.some(option => !option.id.trim() || !option.name.trim() || option.ingredients.length === 0)) {
      violations.push("INCOMPLETE_OPTION");
    }
    if (Array.isArray(required)) for (const value of required) {
      const wanted = String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const found = options.some(option => option.ingredients.some(ingredient =>
        ingredient.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(wanted)));
      if (!found) violations.push(`REQUIRED_INGREDIENT_MISSING:${String(value)}`);
    }
    return violations;
  }

  private conversationId(context: Aida3ExpertContext) {
    const value = context.plan.relevantContext.conversationId;
    return typeof value === "string" && value ? value : context.plan.turnId;
  }

  private completed(context: Aida3ExpertContext, decision: string, data: Record<string, unknown>, summary: string): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status: "COMPLETED", subject: context.task.subject,
      decision, patientSummary: summary, data, missingUserFields: [], errorCode: null };
  }

  private failed(context: Aida3ExpertContext, errorCode: string, data: Record<string, unknown> = {}): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status: "FAILED", subject: context.task.subject,
      decision: null, patientSummary: null, data, missingUserFields: [], errorCode };
  }
}
