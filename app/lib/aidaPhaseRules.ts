// app/lib/aidaPhaseRules.ts

export type PhaseName = "FASE_1" | "FASE_2" | "MANTENIMIENTO";

type PhaseRuleResult = {
  handled: boolean;
  response?: string;
};

export function applyPhaseRules(
  text: string,
  phase: PhaseName
): PhaseRuleResult {
  const lower = text.toLowerCase();

  const mentionsTortilla = /(tortilla|tortillas)/i.test(lower);

  const mentionsMealContext =
    /(com[ií]|comida|desayun[eé]|desayuno|cen[eé]|cena|almorc[eé]|almuerzo|pollo|ensalada|arroz|jugo|carne|huevo|pescado|at[uú]n|queso|verdura|verduras|nopal|frijol|frijoles|pan|pasta|papa|camote)/i.test(
      lower
    );

  // 🌮 TORTILLA
  if (mentionsTortilla) {
    if (phase === "FASE_1") {
      if (mentionsMealContext) {
        return { handled: false };
      }

      return {
        handled: true,
        response:
          "En Protocolo 1, la tortilla queda fuera por ahora porque cuenta como cereal y puede dificultar la estabilidad de glucosa.\n\n" +
          "Más adelante, en Protocolo 2, se puede valorar su reintroducción si tus lecturas se mantienen estables.\n\n" +
          "Por ahora, mantén la base del plato con proteína, grasas saludables y vegetales con fibra.",
      };
    }

    if (phase === "FASE_2") {
      return {
        handled: true,
        response:
          "Aquí ya se puede reintroducir tortilla, pero con condiciones: 1 pieza, junto con proteína y verduras, y no en la noche.\nSeguimos con cuidado.",
      };
    }

    if (phase === "MANTENIMIENTO") {
      return {
        handled: true,
        response:
          "En mantenimiento la tortilla puede entrar de forma flexible, cuidando porción y contexto.\nLa clave es observar cómo responde tu glucosa.",
      };
    }
  }

  // 🛢️ FREÍR
  if (/(fre[ií]r|frito|empanizado)/i.test(lower)) {
    if (phase === "FASE_1") {
      return {
        handled: true,
        response:
          "Por ahora evita freír. La grasa caliente junto con harinas eleva más la glucosa y la inflamación.\nMejor asado, hervido o a la plancha.",
      };
    }

    if (phase === "FASE_2") {
      return {
        handled: true,
        response:
          "Aquí ya puedes usar técnicas más controladas como airfryer o poco aceite, sin empanizar.\nObserva cómo te va.",
      };
    }
  }

  return { handled: false };
}