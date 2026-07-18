import type { Aida3TurnOutcome, Aida3TurnPlan } from "../core/contracts";
import type { ComposedTurnResponse } from "../humanizer/contracts";
import type { ProtocolId } from "../protocols/contracts";
import type { SemanticTurnUnderstanding } from "../semantics/contracts";

export type Aida3TurnRequest = {
  turnId: string;
  message: string;
  protocolId: ProtocolId;
  relevantContext: Record<string, unknown>;
};

export type Aida3TurnExecution = {
  understanding: SemanticTurnUnderstanding;
  plan: Aida3TurnPlan;
  outcome: Aida3TurnOutcome;
  response: ComposedTurnResponse;
  timings: { semanticsMs: number; expertsMs: number; humanizerMs: number; totalMs: number };
};
