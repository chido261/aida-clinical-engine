import type OpenAI from "openai";
import { auditTaskGraphCoverage, type Aida2TaskGraphAudit, type Aida2TurnCognition } from "./turnCognition";
import { executeMultiTaskGraph, type Aida2MultiTaskResult } from "./multiTaskExecutor";
import type { Aida2CulinaryMemory } from "./culinaryMemoryTypes";
import type { ProtocolModuleOutput } from "./modules/protocolModule";
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

  if (audit.requiresUserInput) {
    outcome = {
      status: "NEEDS_CLARIFICATION",
      missingObligations: audit.missingUserInformation,
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

export async function runTaskGraphBrainTurn(params: {
  openai: OpenAI;
  message: string;
  cognition: Aida2TurnCognition;
  culinaryMemory?: Aida2CulinaryMemory | null;
  protocol: ProtocolModuleOutput;
}) {
  const audit = await auditTaskGraphCoverage(params);
  const execution = await executeMultiTaskGraph({
    openai: params.openai,
    cognition: audit.cognition,
    protocol: params.protocol,
  });
  return {
    cognition: audit.cognition,
    audit,
    execution,
    resolution: resolveTaskGraphTurn({ audit, execution }),
  };
}
