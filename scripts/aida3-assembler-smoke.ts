import assert from "node:assert/strict";
import { Aida3DeterministicResponseAssembler, type Aida3TurnOutcome } from "../app/lib/aida3";

const assembler = new Aida3DeterministicResponseAssembler();

function ready(results: Aida3TurnOutcome["bundle"]["results"]): Aida3TurnOutcome {
  return { status: "READY_FOR_HUMANIZER", bundle: { turnId: "assembler", originalMessage: "solicitud",
    responseLength: "MEDIUM", complete: true, results, missingRequiredTasks: [], missingUserFields: [], failures: [] } };
}

const greeting = assembler.compose(ready([{ taskId: "greeting", expertId: "CONVERSATION", status: "COMPLETED",
  subject: "saludo", decision: "GREETING", patientSummary: "¡Hola! ¿En qué te ayudo?", data: {},
  missingUserFields: [], errorCode: null }]));
assert.equal(greeting.text, "¡Hola! ¿En qué te ayudo?");
assert.equal(greeting.source, "ASSEMBLER");

const glucose = assembler.compose(ready([{ taskId: "glucose", expertId: "GLUCOSE", status: "COMPLETED",
  subject: "lectura", decision: "READING_ACCEPTED", patientSummary: "Registré 110 mg/dL.",
  data: { reading: { valueMgDl: 110, moment: null } }, missingUserFields: [], errorCode: null }]));
assert.equal(glucose.text, "Registré 110 mg/dL.");

const culinary = assembler.compose(ready([
  { taskId: "nutrition", expertId: "NUTRITION", status: "COMPLETED", subject: "alimentos",
    decision: "PARTIALLY_COMPATIBLE", patientSummary: null, data: { foods: [
      { food: "pulpo", status: "ALLOWED" }, { food: "aguacate", status: "ALLOWED" },
      { food: "tostada", status: "NOT_ALLOWED" },
    ] }, missingUserFields: [], errorCode: null },
  { taskId: "meals", expertId: "CHEF", status: "COMPLETED", subject: "opciones", decision: "OPTIONS_GENERATED",
    patientSummary: "3 opciones preparadas", data: { options: [
      { name: "Pulpo con aguacate", ingredients: ["pulpo", "aguacate"], description: "Fresca" },
      { name: "Pulpo al ajillo", ingredients: ["pulpo", "ajo"], description: "Caliente" },
      { name: "Pulpo con vegetales", ingredients: ["pulpo", "calabacita"], description: "Ligera" },
    ] }, missingUserFields: [], errorCode: null },
  { taskId: "drink", expertId: "CHEF", status: "COMPLETED", subject: "bebida", decision: "BEVERAGES_GENERATED",
    patientSummary: "1 bebida preparada", data: { beverages: [
      { name: "Té verde sin azúcar", ingredients: ["té verde"] },
    ] }, missingUserFields: [], errorCode: null },
]));
assert.equal(culinary.source, "ASSEMBLER");
assert.deepEqual(culinary.coveredTaskIds, ["nutrition", "meals", "drink"]);
assert.match(culinary.text, /pulpo es compatible/i);
assert.match(culinary.text, /tostada no se recomienda/i);
assert.match(culinary.text, /3\. Pulpo con vegetales/);
assert.match(culinary.text, /Té verde sin azúcar/);

console.log("AIDA3 ASSEMBLER OK");
console.log(JSON.stringify({ greeting, glucose, culinary }, null, 2));
