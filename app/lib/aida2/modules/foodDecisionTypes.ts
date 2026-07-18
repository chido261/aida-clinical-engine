import type { ProtocolId } from "./protocolModule";

export type FoodCategory =
  | "proteína"
  | "grasa saludable"
  | "vegetal bajo en carga glucémica"
  | "leguminosa"
  | "fruta"
  | "bebida"
  | "endulzante compatible"
  | "carbohidrato de alta carga glucémica"
  | "carbohidrato saludable con validación"
  | "preparación"
  | "preparación compatible condicionada"
  | "desconocido";

export type FoodValidationSource =
  | "protocol_reference"
  | "protocol_conditional"
  | "clinical_classification"
  | "restricted"
  | "preparation"
  | "ingredient_based_preparation"
  | "unknown";

export type FoodValidation = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  isCompatible: boolean;
  reason: string;
  source: FoodValidationSource;
};

export type SemanticFoodInterpretation = {
  originalText: string;
  dishName: string | null;
  semanticType:
    | "literal_food"
    | "composite_dish"
    | "plant_based_substitute"
    | "shape_or_style"
    | "commercial_product"
    | "unknown";
  baseIngredients: string[];
  declaredIngredients: string[];
  styleReferences: string[];
  isCommercialProduct: boolean;
  requiresClarification: boolean;
  clarificationReason: string | null;
  confidence: number;
  source: "semantic_model" | "semantic_fallback" | "web_knowledge";
};

export type FoodKnowledgeResolution = {
  needed: boolean;
  resolved: boolean;
  definition: string | null;
  likelyBaseIngredients: string[];
  sourceUrls: string[];
  source: "not_needed" | "web" | "unresolved";
};

export type CulinaryRecipe = {
  title: string;
  ingredients: Array<{ name: string; amount: string }>;
  steps: string[];
  verified: boolean;
  rejectedIngredients: string[];
};

export type CulinaryPlan = {
  requested: boolean;
  requestedCount: number;
  presentation: "choices" | "full_recipe";
  constraints: string[];
  recipes: CulinaryRecipe[];
  rejectedIngredients: string[];
  error: string | null;
};

export type MealDecisionStatus =
  | "ALLOWED"
  | "ALLOWED_WITH_VALIDATION"
  | "NOT_ALLOWED"
  | "NEEDS_INGREDIENTS"
  | "UNKNOWN";

export type MealFoodDecision = {
  food: string;
  canonicalFood: string;
  category: FoodCategory;
  status: MealDecisionStatus;
  reason: string;
  source: FoodValidationSource;
};

export type MealSpecialistDecision = {
  protocolId: ProtocolId;
  foods: MealFoodDecision[];
  conditionalFoods: string[];
  requestedConditionalFoodList: boolean;
  shouldMeasureGlucose: boolean;
  shouldBuildRecipes: boolean;
  shouldExplainValidation: boolean;
  hasAllowedFoods: boolean;
  hasConditionalFoods: boolean;
  hasNotAllowedFoods: boolean;
  hasUnknownFoods: boolean;
};
