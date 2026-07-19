import type { Aida3ResponseLength, Aida3TurnPlan } from "../core/contracts";
import type { NutritionCandidate } from "../experts/nutrition";
import type { ProtocolId } from "../protocols/contracts";

export type BrainRequest =
  | { id: string; type: "GREETING" }
  | { id: string; type: "GENERAL_EDUCATION"; topic: string; answer: string }
  | { id: string; type: "PROTOCOL_STATUS" }
  | { id: string; type: "GLUCOSE_READING"; valueMgDl: number; moment: string | null }
  | { id: string; type: "FOOD_VALIDATION"; foods: NutritionCandidate[] }
  | { id: string; type: "MEAL_OPTIONS"; count: number; requiredEveryOption: NutritionCandidate[];
      requiredAtLeastOne: NutritionCandidate[]; validateOnly: NutritionCandidate[] }
  | { id: string; type: "BEVERAGE_OPTIONS"; count: number; exclude: string[] }
  | { id: string; type: "RECIPE_STEPS"; recipeIds: string[] };

export type CurrentTurnAnalysis = {
  currentMessage: string;
  responseLength: Aida3ResponseLength;
  requests: BrainRequest[];
};

export type BrainContext = {
  protocolId: ProtocolId;
  conversationId: string;
  patientName?: string | null;
  selectedRecipeId?: string | null;
  availableRecipes?: Array<{ id: string; name: string }>;
  pendingClarification?: { type: string; requestedAtTurnId: string } | null;
  recentConversation?: Array<{ role: "user" | "assistant"; content: string }>;
};

export interface CurrentTurnAnalyzer {
  analyze(input: { currentMessage: string; referenceContext: BrainContext }): Promise<CurrentTurnAnalysis>;
}

export type BrainCompilation = {
  analysis: CurrentTurnAnalysis;
  plan: Aida3TurnPlan;
};
