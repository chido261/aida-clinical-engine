import assert from "node:assert/strict";
import { ProtocolRepository, type ProtocolId } from "../app/lib/aida3";

const repository = new ProtocolRepository();
const ids: ProtocolId[] = ["DIAGNOSTICO_7_DIAS", "FASE_1", "FASE_2"];
for (const id of ids) {
  const protocol = repository.get(id);
  assert.equal(protocol.operational.readings.slots.length, 6);
  assert.ok(protocol.sections.identification, `${id}: falta IDENTIFICACIÓN`);
  assert.ok(protocol.foods.proteins.length > 5, `${id}: proteínas no extraídas`);
  assert.ok(protocol.foods.vegetables.length > 5, `${id}: vegetales no extraídos`);
  assert.ok(protocol.foods.beverages.length > 0, `${id}: bebidas no extraídas`);
}
assert.equal(repository.get("FASE_1"), repository.get("FASE_1"), "el protocolo debe vivir en caché");
console.log("AIDA3 PROTOCOLS OK");
console.log(JSON.stringify(ids.map(id => {
  const protocol = repository.get(id);
  return { id, phase: protocol.operational.phase, proteins: protocol.foods.proteins.length,
    vegetables: protocol.foods.vegetables.length, beverages: protocol.foods.beverages.length };
}), null, 2));
