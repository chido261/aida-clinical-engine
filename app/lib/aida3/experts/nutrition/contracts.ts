import type { ProtocolId } from "../../protocols/contracts";

export const NUTRITION_EXPERT_ID = "NUTRITION";
export const VALIDATE_FOODS_ACTION = "VALIDATE_FOODS";

export type NutritionCategory =
  | "PROTEIN"
  | "DAIRY"
  | "HEALTHY_FAT"
  | "VEGETABLE"
  | "LEGUME"
  | "FRUIT"
  | "BEVERAGE"
  | "SWEETENER"
  | "CARBOHYDRATE"
  | "UNKNOWN";

export type NutritionCandidate = {
  name: string;
  canonicalName?: string;
  category?: NutritionCategory;
};

export type NutritionTaskInput = {
  protocolId: ProtocolId;
  foods: NutritionCandidate[];
};

export type NutritionFoodStatus = "ALLOWED" | "CONDITIONAL" | "NOT_ALLOWED" | "UNKNOWN";

export type NutritionFoodDecision = {
  food: string;
  canonicalFood: string;
  status: NutritionFoodStatus;
  reason: string;
  evidence: string | null;
};

export type NutritionNarrativeInput = {
  originalMessage: string;
  protocolName: string;
  foods: NutritionFoodDecision[];
};

export interface NutritionResponseWriter {
  write(input: NutritionNarrativeInput): Promise<string>;
}
