import assert from "node:assert/strict";

import {
  Aida3ExpertRegistry,
  Aida3TurnOrchestrator,
  type Aida3Expert,
  type Aida3ExpertResult,
  type Aida3TurnPlan,
} from "../app/lib/aida3";

const executionOrder: string[] = [];

const sourceExpert: Aida3Expert = {
  id: "SOURCE",
  async execute({ task }) {
    executionOrder.push(task.id);
    return completed(task.id, this.id, String(task.input.value));
  },
};

const dependentExpert: Aida3Expert = {
  id: "DEPENDENT",
  async execute({ task, dependencyResults }) {
    executionOrder.push(task.id);
    assert.equal(dependencyResults.length, 2);
    return completed(
      task.id,
      this.id,
      dependencyResults.map(result => result.patientSummary).join(" + ")
    );
  },
};

const plan: Aida3TurnPlan = {
  turnId: "smoke-turn",
  originalMessage: "Ejecutar dos solicitudes y reunirlas",
  responseLength: "SHORT",
  relevantContext: {},
  tasks: [
    task("one", "SOURCE", [], "uno"),
    task("two", "SOURCE", [], "dos"),
    task("join", "DEPENDENT", ["one", "two"], ""),
  ],
};

async function main() {
  const registry = new Aida3ExpertRegistry()
    .register(sourceExpert)
    .register(dependentExpert);
  const outcome = await new Aida3TurnOrchestrator(registry).execute(plan);

  assert.equal(outcome.status, "READY_FOR_HUMANIZER");
  assert.equal(outcome.bundle.complete, true);
  assert.equal(outcome.bundle.results.length, 3);
  assert.deepEqual(new Set(executionOrder.slice(0, 2)), new Set(["one", "two"]));
  assert.equal(executionOrder[2], "join");
  assert.equal(outcome.bundle.results[2]?.patientSummary, "uno + dos");

  console.log("AIDA3 CORE OK");
  console.log(JSON.stringify(outcome, null, 2));
}

void main();

function task(
  id: string,
  expertId: string,
  dependsOn: string[],
  value: string
) {
  return {
    id,
    expertId,
    action: "TEST",
    subject: id,
    input: { value },
    dependsOn,
    required: true,
  };
}

function completed(
  taskId: string,
  expertId: string,
  patientSummary: string | null
): Aida3ExpertResult {
  return {
    taskId,
    expertId,
    status: "COMPLETED",
    subject: taskId,
    decision: "OK",
    patientSummary,
    data: {},
    missingUserFields: [],
    errorCode: null,
  };
}
