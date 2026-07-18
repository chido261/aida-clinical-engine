import type { Aida3ResponseLength } from "../core/contracts";
import type { NutritionCandidate } from "../experts/nutrition";

export type SemanticRequestKind =
  | "FOOD_VALIDATION"
  | "MEAL_OPTIONS"
  | "BEVERAGE_OPTIONS"
  | "RECIPE_STEPS"
  | "SAFETY_REVIEW";

export type SemanticRequest = {
  id: string;
  kind: SemanticRequestKind;
  subject: string;
  foods: NutritionCandidate[];
  constraints: Record<string, unknown>;
  dependsOn: string[];
  required: boolean;
};

export type SemanticTurnUnderstanding = {
  originalMessage: string;
  responseLength: Aida3ResponseLength;
  requests: SemanticRequest[];
  relevantContext: Record<string, unknown>;
};

export interface SemanticUnderstandingProvider {
  understand(params: {
    message: string;
    relevantContext: Record<string, unknown>;
  }): Promise<SemanticTurnUnderstanding>;
}
