import assert from "node:assert/strict";
import {
  Aida3Brain, Aida3BrainTurnEngine, Aida3DeterministicResponseAssembler, Aida3ExpertRegistry,
  Aida3TurnOrchestrator, ConversationExpert, OpenAiCurrentTurnAnalyzer, type BrainContext,
} from "../app/lib/aida3";

const cases = [
  ["Hola, ¿cómo estás?", "¡Hola! Estoy bien y listo para ayudarte."],
  ["¿Qué es la diabetes?", "La diabetes es una condición en la que la glucosa permanece elevada en la sangre porque el cuerpo no produce suficiente insulina o no la utiliza adecuadamente."],
  ["¿Qué es la diabetes tipo 2?", "La diabetes tipo 2 ocurre cuando el cuerpo pierde sensibilidad a la insulina y, con el tiempo, puede producir menos de la necesaria. Esto dificulta mantener la glucosa dentro de rangos saludables."],
  ["¿Qué es la resistencia a la insulina?", "Es cuando las células responden menos a la insulina, por lo que el cuerpo necesita producir más para introducir la glucosa en ellas."],
  ["¿Para qué sirve la insulina?", "La insulina permite que la glucosa entre a las células para utilizarse como energía y ayuda a mantener estable su nivel en la sangre."],
  ["¿Qué significa tener glucosa en la sangre?", "Significa que hay glucosa circulando para aportar energía a las células; el organismo regula su cantidad principalmente mediante hormonas como la insulina y el glucagón."],
  ["¿Qué es la glucosa en ayunas?", "Es la concentración de glucosa medida después de pasar varias horas sin comer, normalmente al despertar."],
  ["¿Qué significa glucosa posprandial?", "Es la glucosa medida después de comer y permite observar cómo respondió el cuerpo a esa comida."],
  ["¿Qué es la hemoglobina glucosilada?", "La hemoglobina glucosilada o HbA1c refleja el promedio aproximado de glucosa de los últimos dos a tres meses."],
  ["¿Cuál es la diferencia entre glucosa y hemoglobina glucosilada?", "La glucosa muestra el nivel en un momento específico; la hemoglobina glucosilada estima el promedio de los últimos dos a tres meses."],
  ["¿Qué es el metabolismo?", "El metabolismo es el conjunto de procesos con los que el cuerpo transforma nutrientes en energía y en materiales para mantener y reparar sus tejidos."],
  ["¿Qué son los carbohidratos?", "Son nutrientes que el cuerpo puede convertir en glucosa para obtener energía. Se encuentran, por ejemplo, en cereales, leguminosas, frutas, lácteos y algunos vegetales."],
  ["¿Qué es la fibra alimentaria?", "La fibra es la parte de los alimentos vegetales que no se digiere completamente. Ayuda al tránsito intestinal, favorece la saciedad y puede hacer más gradual la absorción de glucosa."],
  ["¿Por qué el ejercicio ayuda a controlar la glucosa?", "Porque los músculos utilizan glucosa para obtener energía y el ejercicio puede mejorar temporalmente la sensibilidad a la insulina."],
  ["¿Por qué dormir bien es importante para la glucosa?", "Porque dormir poco o mal puede alterar hormonas relacionadas con el estrés, el apetito y la sensibilidad a la insulina, dificultando el control de la glucosa."],
] as const;

const empty = { valueMgDl: null, moment: null, foods: [], count: null, requiredEveryOption: [],
  requiredAtLeastOne: [], validateOnly: [], exclude: [], recipeIds: [] };
let calls = 0;
const openAiInputs: unknown[] = [];
const fakeOpenAi = { responses: { create: async (input: unknown) => {
  openAiInputs.push(input);
  const [question, answer] = cases[calls++];
  return { output_text: JSON.stringify({ responseLength: answer.length < 100 ? "SHORT" : "MEDIUM",
    requests: [{ ...empty, id: `general-${calls}`, type: "GENERAL_EDUCATION",
      topic: question.replace(/[¿?]/g, ""), answer }] }) };
} } };

const registry = new Aida3ExpertRegistry().register(new ConversationExpert());
const engine = new Aida3BrainTurnEngine(new OpenAiCurrentTurnAnalyzer(fakeOpenAi as never, "test-model"),
  new Aida3Brain(), new Aida3TurnOrchestrator(registry), new Aida3DeterministicResponseAssembler());
const context: BrainContext = { protocolId: "FASE_1", conversationId: "general-test",
  recentConversation: [
    { role: "user", content: "¿Qué es la diabetes?" },
    { role: "assistant", content: "Es una condición relacionada con la regulación de la glucosa." },
  ] };

async function main() {
  for (const [index, [question, answer]] of cases.entries()) {
    const execution = await engine.execute({ turnId: `general-turn-${index + 1}`, message: question, context });
    assert.equal(execution.response.text, answer);
    assert.equal(execution.response.source, "ASSEMBLER");
    assert.deepEqual(execution.plan.tasks.map(task => `${task.expertId}:${task.action}`),
      ["CONVERSATION:ANSWER_GENERAL"]);
    assert.deepEqual(Object.keys(execution.plan.tasks[0].input), ["answer"]);
  }
  assert.equal(calls, cases.length);
  assert.equal(openAiInputs.length, cases.length);
  for (const input of openAiInputs) {
    const serialized = JSON.stringify(input);
    assert.match(serialized, /recentConversation/);
    assert.match(serialized, /Evita repetir lo que ya se explicó/);
    assert.match(serialized, /Nunca escribas una enumeración completa dentro de un solo párrafo/);
    assert.match(serialized, /Entrega texto plano con saltos de línea/);
    assert.doesNotMatch(serialized, /conversationId/);
  }
  console.log("AIDA3 GENERAL CONVERSATION OK");
  console.log(JSON.stringify({ questions: cases.length, analysisCalls: calls, contextualTurns: openAiInputs.length,
    specialistsCalled: 0 }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
