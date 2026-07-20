import type { Aida3TurnOutcome } from "../core/contracts";
import type { ComposedTurnResponse } from "./contracts";
import { Aida3DeterministicResponseAssembler } from "./deterministicResponseAssembler";

export class Aida3SpecialistResponseAssembler extends Aida3DeterministicResponseAssembler {
  override compose(outcome: Aida3TurnOutcome): ComposedTurnResponse {
    if (outcome.status !== "READY_FOR_HUMANIZER") return super.compose(outcome);
    const completed = outcome.bundle.results.filter(result => result.status === "COMPLETED");
    const hasSpecialistNarrative = completed.some(result =>
      result.data.narrativeSource === "OPENAI" && Boolean(result.patientSummary?.trim()));
    if (!hasSpecialistNarrative) return super.compose(outcome);

    const parts = completed.map(result => {
      if (result.data.narrativeSource === "OPENAI" && result.patientSummary?.trim()) {
        return { taskId: result.taskId, text: result.patientSummary.trim() };
      }
      const single: Aida3TurnOutcome = { status: "READY_FOR_HUMANIZER",
        bundle: { ...outcome.bundle, results: [result], complete: true,
          missingRequiredTasks: [], missingUserFields: [], failures: [] } };
      return { taskId: result.taskId, text: super.compose(single).text };
    });
    return { text: parts.map(part => part.text).join("\n\n"), source: "ASSEMBLER",
      coveredTaskIds: parts.map(part => part.taskId) };
  }
}
