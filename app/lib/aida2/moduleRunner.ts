// app/lib/aida2/moduleRunner.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import {
  buildAida2ExecutionPlan,
  type Aida2ExecutionPlan,
} from "@/app/lib/aida2/decisionEngine";
import {
  runContextModule,
  type Aida2ContextModuleOutput,
} from "@/app/lib/aida2/modules/contextModule";

export type Aida2ModuleRunnerInput = {
  workPlan: Aida2WorkPlan;
  history: string;
  userMessage: string;
};

export type Aida2ModuleResults = {
  executionPlan: Aida2ExecutionPlan;
  context?: Aida2ContextModuleOutput;
};

export function runAida2Modules(
  input: Aida2ModuleRunnerInput
): Aida2ModuleResults {
  const { workPlan, history, userMessage } = input;

  const executionPlan = buildAida2ExecutionPlan(workPlan);

  const results: Aida2ModuleResults = {
    executionPlan,
  };

  if (executionPlan.modulesToRun.includes("CONTEXT")) {
    results.context = runContextModule({
      workPlan,
      executionPlan,
      history,
      userMessage,
    });
  }

  return results;
}