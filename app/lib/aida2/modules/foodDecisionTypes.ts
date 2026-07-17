import type { ProtocolId } from "./protocolModule";

export type FoodCategory =
  | "proteína"
  | "grasa saludable"
  | "vegetal bajo en carga glucémica"
  | "leguminosa"
  | "fruta"
  | "bebida"
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
