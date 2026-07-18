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
type FoodReference = { name?: string; canonicalName?: string };

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

function foodNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    const food = item as FoodReference;
    return food.canonicalName ?? food.name ?? "";
  }).map(item => item.trim()).filter(Boolean);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

  private mealGenerationContext(context: Aida3ExpertContext): ChefGenerationContext | null {
    const count = positiveCount(context.task.input.count);
    const protocolId = context.task.input.protocolId;
    if (!count || typeof protocolId !== "string" || context.dependencyResults.length === 0) return null;
    const decisions = nutritionFoods(context);
    const requiredEveryOption = foodNames(context.task.input.requiredEveryOption);
    const requiredAtLeastOne = foodNames(context.task.input.requiredAtLeastOne);
    const approved = new Set([...decisions.approved, ...decisions.conditional].map(normalized));
    if ([...requiredEveryOption, ...requiredAtLeastOne].some(food => !approved.has(normalized(food)))) return null;
    return { protocolId, approvedFoods: decisions.approved, conditionalFoods: decisions.conditional, count,
      constraints: { requiredEveryOption, requiredAtLeastOne, rejectedFoods: decisions.rejected, exclude: [] } };
  }

  private beverageGenerationContext(context: Aida3ExpertContext): ChefGenerationContext | null {
    const count = positiveCount(context.task.input.count);
    const protocolId = context.task.input.protocolId;
    if (!count || typeof protocolId !== "string") return null;
    const exclude = Array.isArray(context.task.input.exclude) ? context.task.input.exclude.map(String) : [];
    return { protocolId, approvedFoods: [], conditionalFoods: [], count,
      constraints: { requiredEveryOption: [], requiredAtLeastOne: [], rejectedFoods: [], exclude } };
  }

  private async generateMeals(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    const input = this.mealGenerationContext(context);
    if (!input) return this.failed(context, "NUTRITION_DECISION_OR_COUNT_REQUIRED");
    const options = await this.meals.generate(input);
    const violations = this.optionViolations(options, input);
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
    const input = this.beverageGenerationContext(context);
    if (!input) return this.failed(context, "INVALID_BEVERAGE_REQUEST");
    const options = await this.beverages.generate(input);
    const excluded = input.constraints.exclude.map(normalized);
    if (options.length !== input.count || new Set(options.map(option => option.id)).size !== options.length ||
      options.some(option => excluded.includes(normalized(option.name)))) {
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

  private optionViolations(options: StoredRecipeOption[], input: ChefGenerationContext) {
    const violations: string[] = [];
    if (options.length !== input.count) violations.push(`COUNT_MISMATCH:expected=${input.count}:received=${options.length}`);
    if (new Set(options.map(option => option.id)).size !== options.length) violations.push("DUPLICATE_OPTION_IDS");
    if (options.some(option => !option.id.trim() || !option.name.trim() || option.ingredients.length === 0)) {
      violations.push("INCOMPLETE_OPTION");
    }
    for (const value of input.constraints.requiredEveryOption) {
      const wanted = normalized(value);
      const missing = options.some(option => !option.ingredients.some(ingredient => normalized(ingredient).includes(wanted)));
      if (missing) violations.push(`REQUIRED_EVERY_OPTION_MISSING:${value}`);
    }
    for (const value of input.constraints.requiredAtLeastOne) {
      const wanted = normalized(value);
      const found = options.some(option => option.ingredients.some(ingredient =>
        normalized(ingredient).includes(wanted)));
      if (!found) violations.push(`REQUIRED_AT_LEAST_ONE_MISSING:${value}`);
    }
    for (const value of input.constraints.rejectedFoods) if (options.some(option =>
      option.ingredients.some(ingredient => normalized(ingredient).includes(normalized(value))))) {
      violations.push(`REJECTED_INGREDIENT_USED:${value}`);
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
