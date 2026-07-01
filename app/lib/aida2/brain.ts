// app/lib/aida2/brain.ts

export type Aida2Intent =
  | "FOOD_ADVICE"
  | "EXERCISE_ADVICE"
  | "GLUCOSE_REVIEW"
  | "PROTOCOL_GUIDANCE"
  | "MEDICATION_EDUCATION"
  | "FOLLOW_UP_CONTEXT"
  | "GENERAL_SUPPORT";

export type Aida2Module =
  | "PROFILE"
  | "CONTEXT"
  | "FOLLOW_UP"
  | "GLUCOSE"
  | "NUTRITION"
  | "EXERCISE"
  | "PROTOCOL"
  | "MEDICATION"
  | "LICENSE";

export type Aida2Priority = "LOW" | "MEDIUM" | "HIGH";
export type Aida2ResponseLength = "SHORT" | "MEDIUM";
export type Aida2ResponseTone =
  | "CALM"
  | "DIRECT"
  | "PRACTICAL"
  | "EDUCATIONAL"
  | "FOLLOW_UP"
  | "SAFETY";

export type Aida2BrainInput = {
  userId?: string | null;
  message: string;
  history?: string | null;
};

export type Aida2Understanding = {
  rawMessage: string;
  normalizedMessage: string;
  intent: Aida2Intent;
  mentionedGlucose: number | null;
  mentionsFood: boolean;
  mentionsExercise: boolean;
  mentionsMedication: boolean;
  mentionsProtocol: boolean;
  asksForPreviousContext: boolean;
};

export type Aida2Decision = {
  priority: Aida2Priority;
  responseGoal: string;
  modulesToRun: Aida2Module[];
  shouldUseHistory: boolean;
  shouldUsePersistentContext: boolean;
  shouldUseProfile: boolean;
  shouldUseProtocol: boolean;
  shouldUseGlucose: boolean;
  shouldUseNutrition: boolean;
  shouldUseMedication: boolean;
};

export type Aida2SafetyPlan = {
  riskLevel: Aida2Priority;
  hasSevereSymptoms: boolean;
  requiresImmediateSafetyFocus: boolean;
  safetyReason: string | null;
  limits: string[];
};

export type Aida2ResponsePlan = {
  tone: Aida2ResponseTone[];
  length: Aida2ResponseLength;
  mustDo: string[];
  mustAvoid: string[];
  closingInstruction: string;
};

export type Aida2WorkPlan = {
  purpose: string;
  personality: string;
  understanding: Aida2Understanding;
  decision: Aida2Decision;
  safety: Aida2SafetyPlan;
  responsePlan: Aida2ResponsePlan;
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function extractGlucose(message: string): number | null {
  const matches = message.match(/\b\d{2,3}\b/g);
  if (!matches) return null;

  const values = matches.map(Number).filter((n) => n >= 40 && n <= 600);
  if (!values.length) return null;

  return values[values.length - 1];
}

function detectIntent(message: string): Aida2Intent {
  const text = normalize(message);

  if (
    /\b(qu[eé] est[aá]bamos trabajando|en qu[eé] quedamos|continuemos|retomemos|seguimiento|pendiente|la vez pasada|lo anterior)\b/i.test(
      text
    )
  ) {
    return "FOLLOW_UP_CONTEXT";
  }

  if (
    /\b(comer|comida|cena|desayuno|almuerzo|platillo|men[uú]|antojo|pan|tortilla|arroz|fruta|verdura|prote[ií]na)\b/i.test(
      text
    )
  ) {
    return "FOOD_ADVICE";
  }

  if (
    /\b(ejercicio|caminar|caminata|entrenar|pesas|cardio|actividad f[ií]sica)\b/i.test(
      text
    )
  ) {
    return "EXERCISE_ADVICE";
  }

  if (
    /\b(glucosa|az[uú]car|mg\/dl|hipoglucemia|hiperglucemia|ayuno|postcomida|despu[eé]s de comer|antes de comer)\b/i.test(
      text
    ) ||
    extractGlucose(text) !== null
  ) {
    return "GLUCOSE_REVIEW";
  }

  if (
    /\b(protocolo|fase|plan|permitido|prohibido|avance|retroceder)\b/i.test(
      text
    )
  ) {
    return "PROTOCOL_GUIDANCE";
  }

  if (
    /\b(medicamento|medicina|metformina|insulina|dosis|pastilla|tratamiento|glibenclamida|dapagliflozina|jardiance|galvus|ozempic)\b/i.test(
      text
    )
  ) {
    return "MEDICATION_EDUCATION";
  }

  return "GENERAL_SUPPORT";
}

function detectSevereSymptoms(message: string) {
  return /\b(dolor en el pecho|falta de aire|desmayo|confusi[oó]n|v[oó]mito|debilidad extrema|no puedo respirar)\b/i.test(
    message
  );
}

function buildUnderstanding(message: string): Aida2Understanding {
  const normalizedMessage = normalize(message);
  const intent = detectIntent(message);

  return {
    rawMessage: message,
    normalizedMessage,
    intent,
    mentionedGlucose: extractGlucose(message),
    mentionsFood:
      /\b(comer|comida|cena|desayuno|almuerzo|platillo|men[uú]|antojo|pan|tortilla|arroz|fruta|verdura|prote[ií]na)\b/i.test(
        normalizedMessage
      ),
    mentionsExercise:
      /\b(ejercicio|caminar|caminata|entrenar|pesas|cardio|actividad f[ií]sica)\b/i.test(
        normalizedMessage
      ),
    mentionsMedication:
      /\b(medicamento|medicina|metformina|insulina|dosis|pastilla|tratamiento|glibenclamida|dapagliflozina|jardiance|galvus|ozempic)\b/i.test(
        normalizedMessage
      ),
    mentionsProtocol:
      /\b(protocolo|fase|plan|permitido|prohibido|avance|retroceder)\b/i.test(
        normalizedMessage
      ),
    asksForPreviousContext:
      intent === "FOLLOW_UP_CONTEXT",
  };
}

function buildSafetyPlan(understanding: Aida2Understanding): Aida2SafetyPlan {
  const glucose = understanding.mentionedGlucose;
  const hasSevereSymptoms = detectSevereSymptoms(understanding.rawMessage);

  if (hasSevereSymptoms) {
    return {
      riskLevel: "HIGH",
      hasSevereSymptoms: true,
      requiresImmediateSafetyFocus: true,
      safetyReason:
        "El usuario menciona síntomas de alerta que requieren priorizar seguridad.",
      limits: [
        "No minimizar síntomas severos.",
        "Indicar atención médica inmediata si hay dolor en pecho, falta de aire, confusión, desmayo, vómito persistente o debilidad extrema.",
        "No dar recomendaciones de comida o ejercicio como prioridad si hay síntomas de alerta.",
      ],
    };
  }

  if (glucose !== null && glucose < 70) {
    return {
      riskLevel: "HIGH",
      hasSevereSymptoms: false,
      requiresImmediateSafetyFocus: true,
      safetyReason: "Glucosa menor a 70 mg/dL compatible con hipoglucemia.",
      limits: [
        "Priorizar recuperación de hipoglucemia.",
        "No recomendar ejercicio.",
        "No enfocarse en bajar glucosa.",
      ],
    };
  }

  if (glucose !== null && glucose >= 250) {
    return {
      riskLevel: "HIGH",
      hasSevereSymptoms: false,
      requiresImmediateSafetyFocus: true,
      safetyReason: "Glucosa igual o mayor a 250 mg/dL.",
      limits: [
        "Priorizar seguridad, hidratación y síntomas de alarma.",
        "No recomendar carbohidratos.",
        "No ajustar medicamentos.",
      ],
    };
  }

  if (glucose !== null && glucose >= 140) {
    return {
      riskLevel: "MEDIUM",
      hasSevereSymptoms: false,
      requiresImmediateSafetyFocus: false,
      safetyReason: "Glucosa elevada que requiere orientación prudente.",
      limits: [
        "No alarmar de más.",
        "Orientar acción concreta para mejorar control glucémico.",
      ],
    };
  }

  return {
    riskLevel: "LOW",
    hasSevereSymptoms: false,
    requiresImmediateSafetyFocus: false,
    safetyReason: null,
    limits: [
      "Mantener tono educativo y práctico.",
      "No inventar datos clínicos.",
    ],
  };
}

function getModulesToRun(intent: Aida2Intent): Aida2Module[] {
  const base: Aida2Module[] = ["PROFILE", "CONTEXT"];

  if (intent === "FOOD_ADVICE") {
    return [...base, "GLUCOSE", "NUTRITION", "PROTOCOL"];
  }

  if (intent === "EXERCISE_ADVICE") {
    return [...base, "GLUCOSE", "EXERCISE"];
  }

  if (intent === "GLUCOSE_REVIEW") {
    return [...base, "GLUCOSE", "FOLLOW_UP"];
  }

  if (intent === "PROTOCOL_GUIDANCE") {
    return [...base, "PROTOCOL"];
  }

  if (intent === "MEDICATION_EDUCATION") {
    return [...base, "GLUCOSE", "MEDICATION"];
  }

  if (intent === "FOLLOW_UP_CONTEXT") {
    return [...base, "FOLLOW_UP"];
  }

  return base;
}

function buildResponseGoal(intent: Aida2Intent) {
  if (intent === "FOOD_ADVICE") {
    return "Ayudar al usuario a tomar una decisión alimentaria que favorezca estabilidad glucémica.";
  }

  if (intent === "EXERCISE_ADVICE") {
    return "Orientar actividad física segura y útil para el control de glucosa.";
  }

  if (intent === "GLUCOSE_REVIEW") {
    return "Interpretar la situación glucémica y sugerir el siguiente paso seguro.";
  }

  if (intent === "PROTOCOL_GUIDANCE") {
    return "Explicar el protocolo de forma clara y aplicable sin contradecir límites.";
  }

  if (intent === "MEDICATION_EDUCATION") {
    return "Dar educación general sobre medicamentos sin ajustar dosis ni suspender tratamientos.";
  }

  if (intent === "FOLLOW_UP_CONTEXT") {
    return "Recuperar continuidad de la conversación y retomar el objetivo pendiente.";
  }

  return "Acompañar al usuario y ubicar qué necesita para avanzar en control glucémico.";
}

function buildDecision(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): Aida2Decision {
  const modulesToRun = getModulesToRun(understanding.intent);

  return {
    priority: safety.riskLevel,
    responseGoal: buildResponseGoal(understanding.intent),
    modulesToRun,
    shouldUseHistory: true,
    shouldUsePersistentContext:
      understanding.intent === "FOLLOW_UP_CONTEXT" ||
      understanding.intent === "GLUCOSE_REVIEW" ||
      understanding.intent === "FOOD_ADVICE",
    shouldUseProfile: modulesToRun.includes("PROFILE"),
    shouldUseProtocol: modulesToRun.includes("PROTOCOL"),
    shouldUseGlucose: modulesToRun.includes("GLUCOSE"),
    shouldUseNutrition: modulesToRun.includes("NUTRITION"),
    shouldUseMedication: modulesToRun.includes("MEDICATION"),
  };
}

function buildResponsePlan(
  understanding: Aida2Understanding,
  decision: Aida2Decision,
  safety: Aida2SafetyPlan
): Aida2ResponsePlan {
  const tone: Aida2ResponseTone[] = ["CALM", "PRACTICAL"];

  if (decision.priority === "HIGH") {
    tone.push("DIRECT", "SAFETY");
  }

  if (understanding.intent === "MEDICATION_EDUCATION") {
    tone.push("EDUCATIONAL");
  }

  if (understanding.intent === "FOLLOW_UP_CONTEXT") {
    tone.push("FOLLOW_UP");
  }

  return {
    tone,
    length: decision.priority === "HIGH" ? "SHORT" : "MEDIUM",
    mustDo: [
      "Responder al mensaje actual, no a un tema inventado.",
      "Usar el contexto solo si ayuda a dar continuidad.",
      "Dar una sola acción concreta o una orientación clara.",
      "Mantener la respuesta apropiada para una persona con diabetes tipo 2.",
    ],
    mustAvoid: [
      "No escribir respuestas largas sin necesidad.",
      "No cambiar de tema al cierre.",
      "No ofrecer menús, aderezos u opciones si el usuario no las pidió.",
      "No inventar datos del usuario.",
      "No mencionar módulos internos, workplan o decisiones internas.",
    ],
    closingInstruction:
      understanding.intent === "FOLLOW_UP_CONTEXT"
        ? "Cerrar retomando el mismo objetivo y pidiendo confirmación breve."
        : safety.requiresImmediateSafetyFocus
          ? "Cerrar con una instrucción de seguridad clara."
          : "Cerrar con una acción o pregunta breve relacionada con el mismo tema.",
  };
}

export function buildAida2WorkPlan(input: Aida2BrainInput): Aida2WorkPlan {
  const message = input.message.trim();
  const understanding = buildUnderstanding(message);
  const safety = buildSafetyPlan(understanding);
  const decision = buildDecision(understanding, safety);
  const responsePlan = buildResponsePlan(understanding, decision, safety);

  return {
    purpose:
      "AIDA es un asistente educativo para personas con diabetes tipo 2 o riesgo glucémico. Su objetivo es ayudar a mejorar el control de glucosa mediante alimentación, hábitos, seguimiento y educación clara.",
    personality:
      "Responde como asesor cercano, profesional y práctico. Debe ser claro, breve, humano, sin sermones, sin tecnicismos innecesarios y con una acción concreta. Debe adaptar la respuesta al nivel del usuario.",
    understanding,
    decision,
    safety,
    responsePlan,
  };
}