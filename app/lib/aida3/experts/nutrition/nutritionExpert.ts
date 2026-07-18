import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import type { Aida3ExpertResult } from "../../core/contracts";
import { ProtocolRepository } from "../../protocols/protocolRepository";
import {
  NUTRITION_EXPERT_ID,
  VALIDATE_FOODS_ACTION,
  type NutritionCandidate,
  type NutritionTaskInput,
} from "./contracts";
import { ProtocolFoodValidator } from "./protocolFoodValidator";

function isCandidate(value: unknown): value is NutritionCandidate {
  return Boolean(value && typeof value === "object" && typeof (value as NutritionCandidate).name === "string");
}

function readInput(input: Record<string, unknown>): NutritionTaskInput | null {
  const protocolId = input.protocolId;
  const foods = input.foods;
  if (!(["DIAGNOSTICO_7_DIAS", "FASE_1", "FASE_2"] as unknown[]).includes(protocolId)) return null;
  if (!Array.isArray(foods) || foods.length === 0 || !foods.every(isCandidate)) return null;
  return { protocolId: protocolId as NutritionTaskInput["protocolId"], foods };
}

export class NutritionExpert implements Aida3Expert {
  readonly id = NUTRITION_EXPERT_ID;

  constructor(
    private readonly protocols = new ProtocolRepository(),
    private readonly validator = new ProtocolFoodValidator()
  ) {}

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    if (context.task.action !== VALIDATE_FOODS_ACTION) {
      return this.failure(context, "UNSUPPORTED_NUTRITION_ACTION");
    }
    const input = readInput(context.task.input);
    if (!input) return this.failure(context, "INVALID_NUTRITION_INPUT");

    const protocol = this.protocols.get(input.protocolId);
    const foods = input.foods.map(food => this.validator.validate(protocol, food));
    const hasUnknown = foods.some(food => food.status === "UNKNOWN");
    const hasRestricted = foods.some(food => food.status === "NOT_ALLOWED");
    const hasConditional = foods.some(food => food.status === "CONDITIONAL");
    const decision = hasUnknown ? "REQUIRES_REVIEW" : hasRestricted ? "PARTIALLY_COMPATIBLE" :
      hasConditional ? "COMPATIBLE_WITH_CONDITIONS" : "COMPATIBLE";

    return {
      taskId: context.task.id, expertId: this.id, status: "COMPLETED", subject: context.task.subject,
      decision, patientSummary: foods.map(food => `${food.food}: ${food.status}`).join("; "),
      data: { protocolId: input.protocolId, foods }, missingUserFields: [], errorCode: null,
    };
  }

  private failure(context: Aida3ExpertContext, errorCode: string): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status: "FAILED", subject: context.task.subject,
      decision: null, patientSummary: null, data: {}, missingUserFields: [], errorCode };
  }
}
