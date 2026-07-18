export const CHEF_EXPERT_ID = "CHEF";
export const GENERATE_MEAL_OPTIONS_ACTION = "GENERATE_MEAL_OPTIONS";
export const GENERATE_BEVERAGE_OPTIONS_ACTION = "GENERATE_BEVERAGE_OPTIONS";
export const EXPLAIN_RECIPE_ACTION = "EXPLAIN_RECIPE";

export type StoredRecipeOption = {
  id: string;
  name: string;
  ingredients: string[];
};

export type RecipeDetailRequest = {
  recipeIds: string[];
};

export type RecipeDetailPolicyResult =
  | { valid: true; recipeId: string }
  | { valid: false; status: "NEEDS_USER_INPUT"; missingUserFields: ["selectedRecipeId"]; reason: string };
