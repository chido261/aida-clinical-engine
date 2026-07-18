import type {
  Aida3AggregatedTurn,
  Aida3TurnOutcome,
  Aida3TurnPlan,
} from "./contracts";
import type { Aida3WorkingMemory } from "./workingMemory";

export function aggregateAida3Results(
  plan: Aida3TurnPlan,
  memory: Aida3WorkingMemory
): Aida3TurnOutcome {
  const results = memory.allResults();
  const byTask = new Map(results.map(result => [result.taskId, result]));
  const missingRequiredTasks = plan.tasks
    .filter(task => task.required && !byTask.has(task.id))
    .map(task => task.id);
  const missingUserFields = [...new Set(results.flatMap(result => result.missingUserFields))];
  const failures = results.flatMap(result =>
    result.status === "FAILED" || result.status === "BLOCKED"
      ? [{ taskId: result.taskId, errorCode: result.errorCode ?? result.status }]
      : []
  );
  const complete = missingRequiredTasks.length === 0 &&
    missingUserFields.length === 0 && failures.length === 0;
  const bundle: Aida3AggregatedTurn = {
    turnId: plan.turnId,
    originalMessage: plan.originalMessage,
    responseLength: plan.responseLength,
    complete,
    results,
    missingRequiredTasks,
    missingUserFields,
    failures,
  };

  if (missingUserFields.length > 0) return { status: "NEEDS_USER_INPUT", bundle };
  if (!complete) return { status: "EXECUTION_FAILED", bundle };
  return { status: "READY_FOR_HUMANIZER", bundle };
}

