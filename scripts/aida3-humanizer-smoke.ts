import assert from "node:assert/strict";
import { Aida3TurnResponseComposer, type Aida3TurnOutcome, type HumanizerProvider } from "../app/lib/aida3";

const ready: Aida3TurnOutcome = { status: "READY_FOR_HUMANIZER", bundle: { turnId: "humanizer-smoke",
  originalMessage: "Dame opciones con pulpo y una bebida.", responseLength: "MEDIUM", complete: true,
  results: [
    { taskId: "nutrition", expertId: "NUTRITION", status: "COMPLETED", subject: "pulpo",
      decision: "COMPATIBLE", patientSummary: "pulpo permitido", data: { foods: [{ food: "pulpo" }] }, missingUserFields: [], errorCode: null },
    { taskId: "options", expertId: "CHEF", status: "COMPLETED", subject: "opciones",
      decision: "OPTIONS_GENERATED", patientSummary: "opciones preparadas", data: { options: [{ name: "Pulpo al ajillo" }] }, missingUserFields: [], errorCode: null },
    { taskId: "drink", expertId: "CHEF", status: "COMPLETED", subject: "bebida",
      decision: "BEVERAGES_GENERATED", patientSummary: "bebida preparada", data: { beverages: [{ name: "Té verde sin azúcar" }] }, missingUserFields: [], errorCode: null },
  ], missingRequiredTasks: [], missingUserFields: [], failures: [] } };

const validProvider: HumanizerProvider = { humanize: async input => ({
  parts: input.results.map(result => ({ taskId: result.taskId, decision: result.decision,
    text: result.taskId === "nutrition" ? "El pulpo es compatible con tu fase." : result.taskId === "options" ?
      "Puedes preparar Pulpo al ajillo." : "Puedes acompañarlo con Té verde sin azúcar." })),
}) };

async function main() {
  const response = await new Aida3TurnResponseComposer(validProvider).compose(ready);
  assert.equal(response.source, "HUMANIZER");
  assert.deepEqual(response.coveredTaskIds, ["nutrition", "options", "drink"]);

  const incomplete: HumanizerProvider = { humanize: async () => ({ parts: [
    { taskId: "nutrition", decision: "COMPATIBLE", text: "El pulpo es compatible." },
  ] }) };
  await assert.rejects(() => new Aida3TurnResponseComposer(incomplete).compose(ready), /MISSING_TASK:options/);

  const clarification: Aida3TurnOutcome = { status: "NEEDS_USER_INPUT", bundle: { ...ready.bundle, complete: false,
    results: [{ taskId: "recipe", expertId: "CHEF", status: "NEEDS_USER_INPUT", subject: "dos recetas",
      decision: "SELECT_ONE_RECIPE", patientSummary: "Para no saturar el chat, puedo desglosarte una receta a la vez. Elige cuál quieres primero.",
      data: {}, missingUserFields: ["selectedRecipeId"], errorCode: null }], missingUserFields: ["selectedRecipeId"] } };
  const clarificationResponse = await new Aida3TurnResponseComposer(validProvider).compose(clarification);
  assert.equal(clarificationResponse.source, "CLARIFICATION");
  assert.match(clarificationResponse.text, /una receta a la vez/i);
  console.log("AIDA3 HUMANIZER OK");
  console.log(JSON.stringify({ response, rejectedIncompleteResponse: true, clarificationResponse }, null, 2));
}
void main();
