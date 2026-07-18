import { Aida3Brain } from "../brain/brain";
import type { BrainContext, CurrentTurnAnalyzer } from "../brain/contracts";
import type { Aida3TurnOutcome, Aida3TurnPlan } from "../core/contracts";
import type { Aida3TurnOrchestrator } from "../core/turnOrchestrator";
import type { Aida3DeterministicResponseAssembler } from "../humanizer/deterministicResponseAssembler";
import type { ComposedTurnResponse } from "../humanizer/contracts";

export type Aida3BrainTurnExecution = { plan: Aida3TurnPlan; outcome: Aida3TurnOutcome;
  response: ComposedTurnResponse; timings: { analysisMs: number; expertsMs: number; assemblyMs: number; totalMs: number } };

export class Aida3BrainTurnEngine {
  constructor(private readonly analyzer: CurrentTurnAnalyzer, private readonly brain: Aida3Brain,
    private readonly orchestrator: Aida3TurnOrchestrator,
    private readonly assembler: Aida3DeterministicResponseAssembler) {}

  async execute(input: { turnId: string; message: string; context: BrainContext }): Promise<Aida3BrainTurnExecution> {
    if (!input.turnId.trim() || !input.message.trim()) throw new Error("AIDA3_INVALID_BRAIN_TURN");
    const startedAt = performance.now();
    const analysis = await this.analyzer.analyze({ currentMessage: input.message, referenceContext: input.context });
    const analyzedAt = performance.now();
    const { plan } = this.brain.compile({ turnId: input.turnId, message: input.message, analysis, context: input.context });
    const outcome = await this.orchestrator.execute(plan);
    const expertsAt = performance.now();
    const response = this.assembler.compose(outcome);
    const completedAt = performance.now();
    return { plan, outcome, response, timings: { analysisMs: Math.round(analyzedAt - startedAt),
      expertsMs: Math.round(expertsAt - analyzedAt), assemblyMs: Math.round(completedAt - expertsAt),
      totalMs: Math.round(completedAt - startedAt) } };
  }
}
