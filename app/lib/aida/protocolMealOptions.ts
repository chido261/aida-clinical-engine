// app/lib/aida/protocolMealOptions.ts

function extractRequestedCount(text: string) {
  const match = text.match(/\b(\d{1,2})\b/);
  const count = match ? Number(match[1]) : 3;

  if (!Number.isFinite(count)) return 3;
  if (count < 1) return 3;
  if (count > 8) return 8;

  return count;
}

function detectMealType(text: string) {
  if (/desayuno/i.test(text)) return "desayuno";
  if (/comida|almuerzo/i.test(text)) return "comida";
  if (/cena/i.test(text)) return "cena";
  return "comida";
}

export function wantsMealOptions(text: string) {
  return /(dame|quiero|sugiere|recomienda|opciones|ideas|platillos).*(desayuno|comida|almuerzo|cena)/i.test(
    text
  );
}

export function buildProtocolMealOptionsDirective(params: {
  text: string;
  activeProtocol: string;
}) {
  const { text, activeProtocol } = params;

  if (!wantsMealOptions(text)) return null;

  const count = extractRequestedCount(text);
  const mealType = detectMealType(text);

  return `
El usuario pidió ${count} opciones para ${mealType}.

Objetivo:
Actúa como asesor nutricional. Crea opciones variadas, prácticas y coherentes con el protocolo activo.

Protocolo activo: ${activeProtocol}

Banco de alimentos para Protocolo 1:
- Proteínas: huevo, pollo, bistec, carne de res, pescado, atún, sardina, queso fresco.
- Grasas saludables: aguacate, aceite de oliva, aceitunas, semillas en pequeña cantidad.
- Vegetales: nopales, espinaca, lechuga, pepino, jitomate, champiñones, brócoli, calabacita, apio, col, chayote.
- Extras permitidos: limón, especias, salsa sin azúcar.

Excluidos en Protocolo 1:
- tortilla, pan, arroz, pasta, avena, maíz, papa, camote, cereales, granos, azúcar, jugos, refrescos.
- fruta como base del desayuno.
- yogurt con fruta como desayuno principal.

Reglas:
- Da exactamente ${count} opciones.
- No repitas el mismo platillo.
- No uses alimentos excluidos.
- Cada opción debe tener nombre del platillo y preparación breve.
- Si es desayuno, prioriza proteína + grasa saludable + vegetales.
- Si es cena ligera, evita comidas pesadas y evita carbohidratos.
- No preguntes al final si quiere más opciones, porque ya pidió una cantidad específica.
- Sé breve y práctico.

Formato:
1. Nombre del platillo.
   Preparación breve.
`.trim();
}