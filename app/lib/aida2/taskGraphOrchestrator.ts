import type { Aida2TaskGraphAudit } from "./turnCognition";
import type { Aida2MultiTaskResult } from "./multiTaskExecutor";
import {
  composeTaskGraphOutcome,
  type Aida2TaskGraphOutcome,
} from "./taskGraphResponseComposer";

export type Aida2OrchestratedTaskGraphResult = {
  handled: boolean;
  outcome: Aida2TaskGraphOutcome;
  reply: string;
};

export function resolveTaskGraphTurn(params: {
  audit: Aida2TaskGraphAudit;
  execution: Aida2MultiTaskResult;
}): Aida2OrchestratedTaskGraphResult {
  const { audit, execution } = params;
  let outcome: Aida2TaskGraphOutcome;

  if (audit.audited && !audit.complete) {
    outcome = {
      status: "NEEDS_CLARIFICATION",
      missingObligations: audit.missingObligations,
    };
  } else if (execution.handled && execution.valid) {
    outcome = { status: "COMPLETED", content: execution.reply };
  } else if (execution.handled) {
    outcome = { status: "EXECUTION_FAILED", violations: execution.violations };
  } else {
    outcome = { status: "NOT_APPLICABLE" };
  }

  return {
    handled: outcome.status !== "NOT_APPLICABLE",
    reply: composeTaskGraphOutcome(outcome),
    outcome,
  };
}
