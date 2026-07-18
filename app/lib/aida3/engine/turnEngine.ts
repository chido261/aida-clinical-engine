import type { Aida3TurnOrchestrator } from "../core/turnOrchestrator";
import type { Aida3TurnResponseComposer } from "../humanizer/turnResponseComposer";
import { buildTurnPlan } from "../semantics/semanticPlanBuilder";
import type { SemanticUnderstandingProvider } from "../semantics/contracts";
import type { Aida3TurnExecution, Aida3TurnRequest } from "./contracts";

export class Aida3TurnEngine {
  constructor(private readonly semantics: SemanticUnderstandingProvider,
    private readonly orchestrator: Aida3TurnOrchestrator,
    private readonly responses: Aida3TurnResponseComposer) {}

  async execute(request: Aida3TurnRequest): Promise<Aida3TurnExecution> {
    if (!request.turnId.trim() || !request.message.trim()) throw new Error("AIDA3_INVALID_TURN_REQUEST");
    const understanding = await this.semantics.understand({ message: request.message,
      relevantContext: { ...request.relevantContext, protocolId: request.protocolId } });
    if (understanding.originalMessage !== request.message) throw new Error("AIDA3_SEMANTICS_CHANGED_ORIGINAL_MESSAGE");
    const plan = buildTurnPlan({ turnId: request.turnId, protocolId: request.protocolId, understanding });
    const outcome = await this.orchestrator.execute(plan);
    const response = await this.responses.compose(outcome);
    return { understanding, plan, outcome, response };
  }
}
