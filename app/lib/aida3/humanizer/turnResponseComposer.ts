import type { Aida3TurnOutcome } from "../core/contracts";
import type { ComposedTurnResponse, HumanizedResponse, HumanizerProvider } from "./contracts";

function verifyReceipts(outcome: Aida3TurnOutcome, response: HumanizedResponse) {
  const expected = outcome.bundle.results.filter(result => result.status === "COMPLETED");
  const receipts = new Map(response.parts.map(part => [part.taskId, part]));
  if (receipts.size !== response.parts.length) throw new Error("AIDA3_HUMANIZER_DUPLICATE_RECEIPT");
  for (const result of expected) {
    if (!receipts.has(result.taskId)) throw new Error(`AIDA3_HUMANIZER_MISSING_TASK:${result.taskId}`);
    const part = receipts.get(result.taskId)!;
    if (part.decision !== result.decision) throw new Error(`AIDA3_HUMANIZER_CHANGED_DECISION:${result.taskId}`);
    verifyContent(result.data, part.text, result.taskId);
  }
  for (const taskId of receipts.keys()) {
    if (!expected.some(result => result.taskId === taskId)) throw new Error(`AIDA3_HUMANIZER_UNKNOWN_TASK:${taskId}`);
  }
  return expected.map(result => result.taskId);
}

function verifyContent(data: Record<string, unknown>, text: string, taskId: string) {
  if (!text.trim()) throw new Error(`AIDA3_HUMANIZER_EMPTY_TASK:${taskId}`);
  const required: string[] = [];
  if (Array.isArray(data.options)) required.push(...data.options.map(item => (item as { name?: unknown }).name).filter((v): v is string => typeof v === "string"));
  if (Array.isArray(data.beverages)) required.push(...data.beverages.map(item => (item as { name?: unknown }).name).filter((v): v is string => typeof v === "string"));
  if (Array.isArray(data.foods)) required.push(...data.foods.map(item => (item as { food?: unknown }).food).filter((v): v is string => typeof v === "string"));
  const instructions = data.instructions as { steps?: unknown } | undefined;
  if (Array.isArray(instructions?.steps)) required.push(...instructions.steps.filter((v): v is string => typeof v === "string"));
  const normalized = text.toLocaleLowerCase("es");
  for (const value of required) if (!normalized.includes(value.toLocaleLowerCase("es"))) {
    throw new Error(`AIDA3_HUMANIZER_MISSING_CONTENT:${taskId}:${value}`);
  }
}

function clarification(outcome: Aida3TurnOutcome): ComposedTurnResponse {
  const results = outcome.bundle.results.filter(result => result.status === "NEEDS_USER_INPUT");
  const text = results.map(result => result.patientSummary).filter((value): value is string => Boolean(value)).join("\n");
  return { text: text || "Necesito un dato adicional para completar tu solicitud.", source: "CLARIFICATION",
    coveredTaskIds: results.map(result => result.taskId) };
}

export class Aida3TurnResponseComposer {
  constructor(private readonly humanizer: HumanizerProvider) {}

  async compose(outcome: Aida3TurnOutcome): Promise<ComposedTurnResponse> {
    if (outcome.status === "NEEDS_USER_INPUT") return clarification(outcome);
    if (outcome.status === "EXECUTION_FAILED") return { text: "No pude completar correctamente toda tu solicitud.",
      source: "FAILURE", coveredTaskIds: [] };
    const response = await this.humanizer.humanize({ responseLength: outcome.bundle.responseLength,
      originalMessage: outcome.bundle.originalMessage, results: outcome.bundle.results });
    const coveredTaskIds = verifyReceipts(outcome, response);
    return { text: response.parts.map(part => part.text.trim()).join("\n\n"), source: "HUMANIZER", coveredTaskIds };
  }
}
