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

  // 🌮 TORTILLA
  if (/(tortilla|tortillas)/i.test(lower)) {
    if (phase === "FASE_1") {
      return {
        handled: true,
        response:
          "En este momento del Protocolo Funcional es mejor evitar la tortilla. Primero buscamos estabilidad y quitar picos.\nVamos paso a paso.",
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
