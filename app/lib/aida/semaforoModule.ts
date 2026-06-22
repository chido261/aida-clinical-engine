// app/lib/aida/semaforoModule.ts

export type SemaforoColor = "VERDE" | "AMARILLO" | "ROJO";

export type SemaforoMoment =
  | "AYUNO"
  | "ANTES_COMER"
  | "POSTCOMIDA"
  | "NOCHE"
  | "RECUPERACION_HIPO"
  | "POSTMEAL_RECOVERY"
  | "DESCONOCIDO";

export type SemaforoRiskType =
  | "HYPOGLYCEMIA"
  | "POSSIBLE_HYPO_RISK"
  | "IN_RANGE"
  | "MILD_ELEVATION"
  | "HYPERGLYCEMIA"
  | "SEVERE_HYPERGLYCEMIA"
  | "UNKNOWN_CONTEXT";

export type SemaforoResult = {
  color: SemaforoColor;
  riskType: SemaforoRiskType;
  priority: "LOW" | "MEDIUM" | "HIGH";
  label: string;
  explanation: string;
  recommendedAction: string;
  needsFollowUp: boolean;
  needsMedicalWarning: boolean;
};

export function evaluateGlucoseSemaforo(params: {
  glucose: number;
  moment?: SemaforoMoment | string | null;
  hasSymptoms?: boolean;
}): SemaforoResult {
  const glucose = params.glucose;
  const moment = normalizeMoment(params.moment);
  const hasSymptoms = Boolean(params.hasSymptoms);

  if (glucose < 70) {
    return {
      color: "ROJO",
      riskType: "HYPOGLYCEMIA",
      priority: "HIGH",
      label: "Hipoglucemia",
      explanation: "La lectura está por debajo de 70 mg/dL.",
      recommendedAction:
        "Aplicar protocolo 15-15 y volver a medir en 15 minutos.",
      needsFollowUp: true,
      needsMedicalWarning: true,
    };
  }

  if (glucose >= 70 && glucose <= 79 && hasSymptoms) {
    return {
      color: "AMARILLO",
      riskType: "POSSIBLE_HYPO_RISK",
      priority: "MEDIUM",
      label: "Posible riesgo de baja",
      explanation:
        "La lectura no está por debajo de 70, pero hay síntomas compatibles con baja.",
      recommendedAction:
        "Revisar síntomas, evitar ejercicio por ahora y volver a medir si los síntomas continúan.",
      needsFollowUp: true,
      needsMedicalWarning: false,
    };
  }

  if (glucose > 250) {
    return {
      color: "ROJO",
      riskType: "SEVERE_HYPERGLYCEMIA",
      priority: "HIGH",
      label: "Hiperglucemia severa",
      explanation: "La lectura está por arriba de 250 mg/dL.",
      recommendedAction:
        "Revisar síntomas de alerta, hidratarse con agua natural y considerar atención médica si hay malestar importante o si se repite.",
      needsFollowUp: true,
      needsMedicalWarning: true,
    };
  }

  if (moment === "AYUNO") {
    return evaluateFasting(glucose);
  }

  if (moment === "POSTCOMIDA" || moment === "POSTMEAL_RECOVERY") {
    return evaluatePostMeal(glucose);
  }

  if (moment === "NOCHE") {
    return evaluateBedtime(glucose);
  }

  if (moment === "RECUPERACION_HIPO") {
    return evaluateHypoRecovery(glucose);
  }

  return evaluateUnknownMoment(glucose);
}

function normalizeMoment(moment?: SemaforoMoment | string | null): SemaforoMoment {
  if (
    moment === "AYUNO" ||
    moment === "ANTES_COMER" ||
    moment === "POSTCOMIDA" ||
    moment === "NOCHE" ||
    moment === "RECUPERACION_HIPO" ||
    moment === "POSTMEAL_RECOVERY" ||
    moment === "DESCONOCIDO"
  ) {
    return moment;
  }

  return "DESCONOCIDO";
}

function evaluateFasting(glucose: number): SemaforoResult {
  if (glucose >= 70 && glucose <= 100) {
    return green("Ayuno en rango saludable", "La lectura en ayunas está dentro del rango saludable.");
  }

  if (glucose >= 101 && glucose <= 125) {
    return yellow(
      "Ayuno ligeramente elevado",
      "La lectura en ayunas está por arriba del rango saludable, pero no es una urgencia aislada.",
      "Revisar cena, descanso, estrés y tendencia de los últimos días."
    );
  }

  return yellow(
    "Ayuno alto",
    "La lectura en ayunas está elevada.",
    "Revisar tendencia, cena, sueño y considerar seguimiento si se repite."
  );
}

function evaluatePostMeal(glucose: number): SemaforoResult {
  if (glucose >= 80 && glucose <= 140) {
    return green("Postcomida en rango saludable", "La lectura posterior a comida está dentro del rango saludable.");
  }

  if (glucose >= 141 && glucose <= 180) {
    return yellow(
      "Postcomida elevada",
      "La lectura posterior a comida está por arriba del rango saludable.",
      "Revisar qué alimentos se consumieron y valorar caminata ligera solo si la persona se siente bien."
    );
  }

  return yellow(
    "Postcomida alta",
    "La lectura posterior a comida está alta.",
    "Revisar comida, hidratación, síntomas y tendencia."
  );
}

function evaluateBedtime(glucose: number): SemaforoResult {
  if (glucose >= 80 && glucose <= 120) {
    return green("Noche estable", "La lectura antes de dormir está en rango estable.");
  }

  if (glucose >= 121 && glucose <= 180) {
    return yellow(
      "Noche elevada",
      "La lectura antes de dormir está elevada.",
      "Revisar cena, horarios, sueño y tendencia."
    );
  }

  return yellow(
    "Noche alta",
    "La lectura nocturna está alta.",
    "Revisar síntomas, cena, tendencia y seguimiento si se repite."
  );
}

function evaluateHypoRecovery(glucose: number): SemaforoResult {
  if (glucose >= 90) {
    return green(
      "Recuperación estable",
      "La lectura ya está en rango seguro después de una baja."
    );
  }

  return yellow(
    "Recuperación todavía baja",
    "La lectura ya no está en hipoglucemia, pero aún necesita estabilidad.",
    "Mantener seguimiento y volver a medir según evolución."
  );
}

function evaluateUnknownMoment(glucose: number): SemaforoResult {
  if (glucose >= 80 && glucose <= 140) {
    return {
      color: "AMARILLO",
      riskType: "UNKNOWN_CONTEXT",
      priority: "LOW",
      label: "Lectura sin momento definido",
      explanation:
        "La lectura puede ser adecuada o elevada dependiendo de si fue en ayunas, después de comer o antes de dormir.",
      recommendedAction:
        "Preguntar si la lectura fue en ayunas, postcomida o antes de dormir.",
      needsFollowUp: false,
      needsMedicalWarning: false,
    };
  }

  return yellow(
    "Lectura requiere contexto",
    "La lectura necesita interpretarse según el momento en que fue tomada.",
    "Preguntar si fue en ayunas, postcomida o antes de dormir."
  );
}

function green(label: string, explanation: string): SemaforoResult {
  return {
    color: "VERDE",
    riskType: "IN_RANGE",
    priority: "LOW",
    label,
    explanation,
    recommendedAction: "Mantener el patrón actual y seguir observando tendencia.",
    needsFollowUp: false,
    needsMedicalWarning: false,
  };
}

function yellow(
  label: string,
  explanation: string,
  recommendedAction: string
): SemaforoResult {
  return {
    color: "AMARILLO",
    riskType: "MILD_ELEVATION",
    priority: "MEDIUM",
    label,
    explanation,
    recommendedAction,
    needsFollowUp: true,
    needsMedicalWarning: false,
  };
}