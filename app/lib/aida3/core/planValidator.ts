import type { Aida3TurnPlan } from "./contracts";

export function validateAida3TurnPlan(plan: Aida3TurnPlan) {
  const violations: string[] = [];
  const ids = new Set<string>();

  for (const task of plan.tasks) {
    if (!task.id.trim()) violations.push("TASK_ID_REQUIRED");
    if (ids.has(task.id)) violations.push(`DUPLICATE_TASK_ID:${task.id}`);
    ids.add(task.id);
    if (!task.expertId.trim()) violations.push(`EXPERT_ID_REQUIRED:${task.id}`);
    if (!task.action.trim()) violations.push(`ACTION_REQUIRED:${task.id}`);
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn) {
      if (!ids.has(dependency)) violations.push(`UNKNOWN_DEPENDENCY:${task.id}:${dependency}`);
      if (dependency === task.id) violations.push(`SELF_DEPENDENCY:${task.id}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(plan.tasks.map(task => [task.id, task]));
  function visit(taskId: string): boolean {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    const cyclic = byId.get(taskId)?.dependsOn.some(visit) ?? false;
    visiting.delete(taskId);
    visited.add(taskId);
    return cyclic;
  }
  if (plan.tasks.some(task => visit(task.id))) violations.push("CYCLIC_DEPENDENCY");

  return { valid: violations.length === 0, violations };
}

