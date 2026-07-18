import type {
  Aida3ExpertResult,
  Aida3TaskId,
  Aida3TurnPlan,
} from "./contracts";

export type Aida3TaskRuntimeStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "NEEDS_USER_INPUT"
  | "FAILED"
  | "BLOCKED";

export class Aida3WorkingMemory {
  private readonly statuses = new Map<Aida3TaskId, Aida3TaskRuntimeStatus>();
  private readonly results = new Map<Aida3TaskId, Aida3ExpertResult>();

  constructor(readonly plan: Aida3TurnPlan) {
    for (const task of plan.tasks) this.statuses.set(task.id, "PENDING");
  }

  status(taskId: Aida3TaskId) {
    return this.statuses.get(taskId) ?? null;
  }

  markRunning(taskId: Aida3TaskId) {
    this.transition(taskId, "PENDING", "RUNNING");
  }

  storeResult(result: Aida3ExpertResult) {
    if (this.results.has(result.taskId)) {
      throw new Error(`AIDA3_RESULT_ALREADY_STORED:${result.taskId}`);
    }
    if (this.status(result.taskId) !== "RUNNING") {
      throw new Error(`AIDA3_TASK_NOT_RUNNING:${result.taskId}`);
    }
    this.results.set(result.taskId, result);
    this.statuses.set(result.taskId, result.status);
  }

  block(taskId: Aida3TaskId, errorCode: string) {
    if (this.status(taskId) !== "PENDING") return;
    this.statuses.set(taskId, "BLOCKED");
    const task = this.plan.tasks.find(item => item.id === taskId);
    this.results.set(taskId, {
      taskId,
      expertId: task?.expertId ?? "UNKNOWN",
      status: "BLOCKED",
      subject: task?.subject ?? null,
      decision: null,
      patientSummary: null,
      data: {},
      missingUserFields: [],
      errorCode,
    });
  }

  result(taskId: Aida3TaskId) {
    return this.results.get(taskId) ?? null;
  }

  allResults() {
    return this.plan.tasks.flatMap(task => {
      const result = this.results.get(task.id);
      return result ? [result] : [];
    });
  }

  pendingTasks() {
    return this.plan.tasks.filter(task => this.status(task.id) === "PENDING");
  }

  private transition(
    taskId: Aida3TaskId,
    expected: Aida3TaskRuntimeStatus,
    next: Aida3TaskRuntimeStatus
  ) {
    if (this.status(taskId) !== expected) {
      throw new Error(`AIDA3_INVALID_TASK_TRANSITION:${taskId}:${this.status(taskId)}:${next}`);
    }
    this.statuses.set(taskId, next);
  }
}

