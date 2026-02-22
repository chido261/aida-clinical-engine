export type NutritionContext = {
    moment: "AYUNO" | "POSTCOMIDA" | "NOCHE";
    glucose?: number;
    symptoms?: string[];
  };
  
  export type RuleResult = {
    handled: boolean;
    response?: string;
  };
  
  export function applyNutritionRules(
    userText: string,
    ctx: NutritionContext
  ): RuleResult {
    const text = userText.toLowerCase();
  
    // ❌ TORTILLA
    if (/(tortilla)/i.test(text)) {
      return {
        handled: true,
        response:
          "En este momento, la tortilla cuenta como cereal y es mejor evitarla para mantener la glucosa estable.\n\nSi necesitas envolver alimentos, usa lechuga o nopal. Seguimos paso a paso.",
      };
    }
  
    // ❌ COMPENSAR CON EJERCICIO
    if (/(caminar|ejercicio).*(compensar|quemar)/i.test(text)) {
      return {
        handled: true,
        response:
          "Caminar ayuda a la glucosa, pero no compensa un alimento alto en carbohidratos ahora.\n\nMejor elige una opción baja en carbohidratos y avanzamos sin altibajos.",
      };
    }
  
    // ❌ FREÍR
    if (/(fre[ií]r|frito|empanizado)/i.test(text)) {
      return {
        handled: true,
        response:
          "Mejor evita freír por ahora.\n\nPrefiere plancha, sartén sin aceite o hervido para no sumar grasas que alteren la glucosa.",
      };
    }
  
    // ✅ HAMBRE CON GLUCOSA EN RANGO
    if (/(hambre)/i.test(text) && ctx.glucose && ctx.glucose <= 120) {
      return {
        handled: true,
        response:
          "Ese hambre suele indicar que faltó un poco más de proteína o grasa.\n\nEn la siguiente comida, ajusta agregando grasa saludable o un poco más de proteína.",
      };
    }
  
    return { handled: false };
  }
  