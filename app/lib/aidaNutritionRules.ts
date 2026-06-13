export type NutritionContext = {
  moment: "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";
  glucose?: number;
  symptoms?: string[];
  pendingFollowUpType?: string | null;
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
  
        // ❌ TORTILLA EN PROTOCOLO 1
  const mentionsTortilla = /(tortilla|tortillas)/i.test(text);
  const mentionsOtherFoods =
    /(pollo|ensalada|arroz|jugo|carne|huevo|pescado|at[uú]n|queso|verdura|verduras|nopal|frijol|frijoles|pan|pasta|papa|camote)/i.test(
      text
    );

  if (mentionsTortilla && !mentionsOtherFoods) {
    return {
      handled: true,
      response:
        "En Protocolo 1, la tortilla queda fuera por ahora porque cuenta como cereal y puede dificultar la estabilidad de glucosa.\n\n" +
        "Más adelante, en Protocolo 2, se puede valorar su reintroducción si tus lecturas se mantienen estables.\n\n" +
        "Por ahora, mantén la base del plato con proteína, grasas saludables y vegetales con fibra.",
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
  