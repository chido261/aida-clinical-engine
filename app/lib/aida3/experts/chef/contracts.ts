export const CHEF_EXPERT_ID = "CHEF";
export const GENERATE_MEAL_OPTIONS_ACTION = "GENERATE_MEAL_OPTIONS";
export const GENERATE_BEVERAGE_OPTIONS_ACTION = "GENERATE_BEVERAGE_OPTIONS";
export const EXPLAIN_RECIPE_ACTION = "EXPLAIN_RECIPE";

export type StoredRecipeOption = {
  id: string;
  name: string;
  ingredients: string[];
  description: string;
};

export type ChefGenerationContext = {
  protocolId: string;
  approvedFoods: string[];
  conditionalFoods: string[];
  count: number;
  constraints: {
    requiredEveryOption: string[];
    requiredAtLeastOne: string[];
    rejectedFoods: string[];
    exclude: string[];
  };
};

export type GeneratedBeverage = {
  id: string;
  name: string;
  ingredients: string[];
};

export type RecipeInstructions = {
  recipeId: string;
  title: string;
  steps: string[];
};

export interface MealOptionsTool {
  generate(context: ChefGenerationContext): Promise<StoredRecipeOption[]>;
}

export interface BeverageOptionsTool {
  generate(context: ChefGenerationContext): Promise<GeneratedBeverage[]>;
}

export interface RecipeStepsTool {
  explain(recipe: StoredRecipeOption): Promise<RecipeInstructions>;
}

export type RecipeDetailRequest = {
  recipeIds: string[];
};

export type RecipeDetailPolicyResult =
  | { valid: true; recipeId: string }
  | { valid: false; status: "NEEDS_USER_INPUT"; missingUserFields: ["selectedRecipeId"]; reason: string };
