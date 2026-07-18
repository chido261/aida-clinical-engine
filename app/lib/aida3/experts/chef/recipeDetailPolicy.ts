import type { RecipeDetailPolicyResult, RecipeDetailRequest } from "./contracts";

export function validateRecipeDetailRequest(request: RecipeDetailRequest): RecipeDetailPolicyResult {
  const recipeIds = [...new Set(request.recipeIds.map(id => id.trim()).filter(Boolean))];
  if (recipeIds.length === 1) return { valid: true, recipeId: recipeIds[0] };
  return {
    valid: false,
    status: "NEEDS_USER_INPUT",
    missingUserFields: ["selectedRecipeId"],
    reason: "Para no saturar el chat, puedo desglosarte una receta a la vez. Elige cuál quieres primero.",
  };
}
