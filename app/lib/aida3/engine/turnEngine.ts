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
    const startedAt = performance.now();
    const understanding = await this.semantics.understand({ message: request.message,
      relevantContext: { ...request.relevantContext, protocolId: request.protocolId } });
    const understoodAt = performance.now();
    if (understanding.originalMessage !== request.message) throw new Error("AIDA3_SEMANTICS_CHANGED_ORIGINAL_MESSAGE");
    const plan = buildTurnPlan({ turnId: request.turnId, protocolId: request.protocolId, understanding });
    const outcome = await this.orchestrator.execute(plan);
    const expertsCompletedAt = performance.now();
    const response = await this.responses.compose(outcome);
    const completedAt = performance.now();
    return { understanding, plan, outcome, response, timings: {
      semanticsMs: Math.round(understoodAt - startedAt), expertsMs: Math.round(expertsCompletedAt - understoodAt),
      humanizerMs: Math.round(completedAt - expertsCompletedAt), totalMs: Math.round(completedAt - startedAt),
    } };
  }
}
