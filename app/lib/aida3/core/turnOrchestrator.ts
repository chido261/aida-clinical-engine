import type { Aida3ExpertResult, Aida3Task, Aida3TurnPlan } from "./contracts";
import { Aida3ExpertRegistry } from "./expertRegistry";
import { validateAida3TurnPlan } from "./planValidator";
import { aggregateAida3Results } from "./resultAggregator";
import { Aida3WorkingMemory } from "./workingMemory";

function dependenciesCompleted(task: Aida3Task, memory: Aida3WorkingMemory) {
  return task.dependsOn.every(dependency => memory.status(dependency) === "COMPLETED");
}

function dependencyStopped(task: Aida3Task, memory: Aida3WorkingMemory) {
  return task.dependsOn.some(dependency =>
    ["FAILED", "BLOCKED", "NEEDS_USER_INPUT"].includes(memory.status(dependency) ?? "")
  );
}

export class Aida3TurnOrchestrator {
  constructor(private readonly registry: Aida3ExpertRegistry) {}

  async execute(plan: Aida3TurnPlan) {
    const validation = validateAida3TurnPlan(plan);
    if (!validation.valid) {
      throw new Error(`AIDA3_INVALID_TURN_PLAN:${validation.violations.join("|")}`);
    }

    const memory = new Aida3WorkingMemory(plan);
    while (memory.pendingTasks().length > 0) {
      for (const task of memory.pendingTasks().filter(item => dependencyStopped(item, memory))) {
        memory.block(task.id, "DEPENDENCY_NOT_COMPLETED");
      }

      const ready = memory.pendingTasks().filter(task => dependenciesCompleted(task, memory));
      if (ready.length === 0) {
        for (const task of memory.pendingTasks()) memory.block(task.id, "NO_EXECUTABLE_PATH");
        break;
      }

      await Promise.all(ready.map(async task => {
        memory.markRunning(task.id);
        const expert = this.registry.get(task.expertId);
        if (!expert) {
          memory.storeResult(failedResult(task, "EXPERT_NOT_REGISTERED"));
          return;
        }
        try {
          const dependencyResults = task.dependsOn.flatMap(id => {
            const result = memory.result(id);
            return result ? [result] : [];
          });
          const result = await expert.execute({ plan, task, memory, dependencyResults });
          if (result.taskId !== task.id || result.expertId !== task.expertId) {
            memory.storeResult(failedResult(task, "INVALID_EXPERT_RESULT_IDENTITY"));
            return;
          }
          memory.storeResult(result);
        } catch {
          memory.storeResult(failedResult(task, "EXPERT_EXECUTION_ERROR"));
        }
      }));
    }

    return aggregateAida3Results(plan, memory);
  }
}

function failedResult(task: Aida3Task, errorCode: string): Aida3ExpertResult {
  return {
    taskId: task.id,
    expertId: task.expertId,
    status: "FAILED",
    subject: task.subject,
    decision: null,
    patientSummary: null,
    data: {},
    missingUserFields: [],
    errorCode,
  };
}

