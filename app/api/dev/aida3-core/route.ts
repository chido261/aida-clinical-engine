export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  Aida3ExpertRegistry,
  Aida3TurnOrchestrator,
  type Aida3Expert,
  type Aida3ExpertResult,
  type Aida3TurnPlan,
} from "@/app/lib/aida3";

const echoExpert: Aida3Expert = {
  id: "ECHO_EXPERT",
  async execute({ task }) {
    return completed(task.id, this.id, task.subject, String(task.input.value ?? ""));
  },
};

const integrationExpert: Aida3Expert = {
  id: "INTEGRATION_EXPERT",
  async execute({ task, dependencyResults }) {
    return completed(
      task.id,
      this.id,
      task.subject,
      dependencyResults.map(result => result.patientSummary).filter(Boolean).join(" + ")
    );
  },
};

function completed(
  taskId: string,
  expertId: string,
  subject: string | null,
  patientSummary: string
): Aida3ExpertResult {
  return {
    taskId,
    expertId,
    status: "COMPLETED",
    subject,
    decision: "OK",
    patientSummary,
    data: {},
    missingUserFields: [],
    errorCode: null,
  };
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const registry = new Aida3ExpertRegistry()
    .register(echoExpert)
    .register(integrationExpert);
  const orchestrator = new Aida3TurnOrchestrator(registry);
  const plan: Aida3TurnPlan = {
    turnId: "aida3-core-smoke",
    originalMessage: "Prueba determinista del núcleo modular",
    responseLength: "SHORT",
    relevantContext: {},
    tasks: [
      {
        id: "task_1",
        expertId: "ECHO_EXPERT",
        action: "ECHO",
        subject: "primera solicitud",
        input: { value: "resultado 1" },
        dependsOn: [],
        required: true,
      },
      {
        id: "task_2",
        expertId: "ECHO_EXPERT",
        action: "ECHO",
        subject: "segunda solicitud",
        input: { value: "resultado 2" },
        dependsOn: [],
        required: true,
      },
      {
        id: "task_3",
        expertId: "INTEGRATION_EXPERT",
        action: "INTEGRATE",
        subject: "integración",
        input: {},
        dependsOn: ["task_1", "task_2"],
        required: true,
      },
    ],
  };
  const outcome = await orchestrator.execute(plan);
  return NextResponse.json({
    ok: outcome.status === "READY_FOR_HUMANIZER",
    registeredExperts: registry.list(),
    outcome,
  });
}

