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
  | "LICENSE"
  | "SEMAPHORE";

export type Aida2Priority = "LOW" | "MEDIUM" | "HIGH";
export type Aida2ResponseLength = "SHORT" | "MEDIUM";

export type Aida2ResponseTone =
  | "CALM"
  | "DIRECT"
  | "PRACTICAL"
  | "EDUCATIONAL"
  | "FOLLOW_UP"
  | "SAFETY";

export type Aida2UserGoal =
  | "DECIDE_FOOD"
  | "UNDERSTAND_GLUCOSE"
  | "HANDLE_RISK"
  | "UNDERSTAND_MEDICATION"
  | "FOLLOW_PROTOCOL"
  | "DO_EXERCISE"
  | "CONTINUE_PREVIOUS_GOAL"
  | "GENERAL_GUIDANCE";

export type Aida2ClinicalGoal =
  | "IMPROVE_DAILY_GLUCOSE_CONTROL"
  | "AVOID_GLUCOSE_SPIKE"
  | "CORRECT_LOW_GLUCOSE"
  | "REDUCE_CLINICAL_RISK"
  | "SUPPORT_PROTOCOL_ADHERENCE"
  | "EDUCATE_WITHOUT_CHANGING_MEDICATION"
  | "MAINTAIN_CONTINUITY";

export type Aida2MainAction =
  | "ANSWER_DIRECTLY"
  | "ASK_MINIMUM_MISSING_DATA"
  | "PRIORITIZE_SAFETY"
  | "CONSULT_MODULES"
  | "SUGGEST_PROFILE_UPDATE"
  | "RESUME_FOLLOW_UP";

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
  shouldUseSemaphore: boolean;
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

export type Aida2ThinkingPlan = {
  userGoal: Aida2UserGoal;
  clinicalGoal: Aida2ClinicalGoal;
  knownContextToUse: string[];
  missingInformation: string[];
  extraDataNeeded: string[];
  newRelevantObservation: string | null;
  mainAction: Aida2MainAction;
  decisionPrinciple: string;
};

export type Aida2WorkPlan = {
  purpose: string;
  personality: string;
  understanding: Aida2Understanding;
  thinking: Aida2ThinkingPlan;
  decision: Aida2Decision;
  safety: Aida2SafetyPlan;
  responsePlan: Aida2ResponsePlan;
};

const FOOD_PATTERN =
  /\b(comer|comida|cena|cenar|desayuno|desayunar|almuerzo|platillo|platillos|men[uú]|antojo|receta|recetas|ingrediente|ingredientes|agregar|acompañar|acompanar|opci[oó]n|opciones|segura|seguro|permitido|permitida|recomiendas|recomendar|preparar|preparo|cocinar|cocino|pan|pan dulce|pan integral|tostada|tostadas|tortilla|arroz|pasta|avena|cereal|cereales|granola|galleta|galletas|papa|papas|camote|fruta|frutas|verdura|verduras|vegetal|vegetales|prote[ií]na|proteinas|proteínas|mango|manzana|pl[aá]tano|uva|fresa|fresas|ar[aá]ndanos|frambuesas|zarzamoras|moras|toronja|huevo|huevos|pollo|res|bistec|carne|cerdo|pavo|pescado|at[uú]n|sardina|sardinas|salm[oó]n|tilapia|mojarra|camar[oó]n|camarones|pulpo|queso|yogur|yogurt|k[eé]fir|aguacate|aceite|almendras|nueces|pistaches|cacahuate|ch[ií]a|linaza|lechuga|espinaca|br[oó]coli|coliflor|pepino|calabaza|ejotes|champiñones|jitomate|tomate|nopal|pimiento|cebolla|ajo|frijol|frijoles|garbanzo|lenteja|lentejas|haba|habas|soya|alubias)\b/i;

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

  if (FOOD_PATTERN.test(text)) {
    return "FOOD_ADVICE";
  }

  if (
    /\b(ejercicio|caminar|caminata|entrenar|pesas|cardio|actividad f[ií]sica|correr|gym|gimnasio)\b/i.test(
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
    /\b(protocolo|fase|plan|permitido|prohibido|avance|retroceder|fase 1|fase 2|diagn[oó]stico)\b/i.test(
      text
    )
  ) {
    return "PROTOCOL_GUIDANCE";
  }

  if (
    /\b(medicamento|medicina|metformina|insulina|dosis|pastilla|tratamiento|glibenclamida|dapagliflozina|jardiance|galvus|ozempic|trayenta|linagliptina)\b/i.test(
      text
    )
  ) {
    return "MEDICATION_EDUCATION";
  }

  return "GENERAL_SUPPORT";
}

function detectSevereSymptoms(message: string) {
  return /\b(dolor en el pecho|falta de aire|desmayo|confusi[oó]n|v[oó]mito|debilidad extrema|no puedo respirar|visi[oó]n borrosa|convulsi[oó]n)\b/i.test(
    message
  );
}

function detectMedicationProfileUpdateCandidate(message: string) {
  const text = normalize(message);

  const mentionsKnownMedication =
    /\b(trayenta|linagliptina|jardiance|empagliflozina|ozempic|semaglutida|insulina|glibenclamida|galvus|vildagliptina|metformina|dapagliflozina)\b/i.test(
      text
    );

  if (!mentionsKnownMedication) return false;

  const deniesCurrentUse =
    /\b(no lo tomo|no la tomo|no los tomo|no las tomo|no lo estoy tomando|no la estoy tomando|no estoy tomando|todav[ií]a no|a[uú]n no)\b/i.test(
      text
    );

  if (deniesCurrentUse) return false;

  return /\b(tomo|estoy tomando|uso|estoy usando|me indicaron|me recetaron|me mandaron|me dieron|empec[eé]|inici[eé]|agregaron|mi tratamiento|mis medicamentos|medicamento actual|tratamiento actual)\b/i.test(
    text
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
    mentionsFood: FOOD_PATTERN.test(normalizedMessage),
    mentionsExercise:
      /\b(ejercicio|caminar|caminata|entrenar|pesas|cardio|actividad f[ií]sica|correr|gym|gimnasio)\b/i.test(
        normalizedMessage
      ),
    mentionsMedication:
      /\b(medicamento|medicina|metformina|insulina|dosis|pastilla|tratamiento|glibenclamida|dapagliflozina|jardiance|galvus|ozempic|trayenta|linagliptina)\b/i.test(
        normalizedMessage
      ),
    mentionsProtocol:
      /\b(protocolo|fase|plan|permitido|prohibido|avance|retroceder|fase 1|fase 2|diagn[oó]stico)\b/i.test(
        normalizedMessage
      ),
    asksForPreviousContext: intent === "FOLLOW_UP_CONTEXT",
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
        "Indicar atención médica inmediata si hay dolor en pecho, falta de aire, confusión, desmayo, vómito persistente, visión borrosa severa, convulsión o debilidad extrema.",
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
        "Sugerir vigilancia y atención médica si no mejora o hay síntomas importantes.",
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
        "Sugerir atención médica si hay síntomas, cetonas, vómito, dolor, confusión o persistencia.",
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
        "No ajustar medicamentos.",
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

function getModulesToRun(
  intent: Aida2Intent,
  safety: Aida2SafetyPlan
): Aida2Module[] {
  const base: Aida2Module[] = ["CONTEXT"];

  if (safety.requiresImmediateSafetyFocus) {
    return [...base, "SEMAPHORE"];
  }

  if (intent === "FOOD_ADVICE") {
    return [...base, "NUTRITION", "PROTOCOL"];
  }

  if (intent === "EXERCISE_ADVICE") {
    return [...base, "GLUCOSE", "EXERCISE", "SEMAPHORE"];
  }

  if (intent === "GLUCOSE_REVIEW") {
    return [...base, "GLUCOSE", "SEMAPHORE", "FOLLOW_UP"];
  }

  if (intent === "PROTOCOL_GUIDANCE") {
    return [...base, "PROTOCOL", "GLUCOSE"];
  }

  if (intent === "MEDICATION_EDUCATION") {
    return [...base, "MEDICATION", "SEMAPHORE"];
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

function buildUserGoal(understanding: Aida2Understanding): Aida2UserGoal {
  if (understanding.intent === "FOOD_ADVICE") return "DECIDE_FOOD";
  if (understanding.intent === "GLUCOSE_REVIEW") return "UNDERSTAND_GLUCOSE";
  if (understanding.intent === "MEDICATION_EDUCATION")
    return "UNDERSTAND_MEDICATION";
  if (understanding.intent === "PROTOCOL_GUIDANCE") return "FOLLOW_PROTOCOL";
  if (understanding.intent === "EXERCISE_ADVICE") return "DO_EXERCISE";
  if (understanding.intent === "FOLLOW_UP_CONTEXT")
    return "CONTINUE_PREVIOUS_GOAL";

  return "GENERAL_GUIDANCE";
}

function buildClinicalGoal(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): Aida2ClinicalGoal {
  if (safety.requiresImmediateSafetyFocus) return "REDUCE_CLINICAL_RISK";

  if (
    understanding.mentionedGlucose !== null &&
    understanding.mentionedGlucose < 70
  ) {
    return "CORRECT_LOW_GLUCOSE";
  }

  if (understanding.intent === "FOOD_ADVICE") return "AVOID_GLUCOSE_SPIKE";
  if (understanding.intent === "PROTOCOL_GUIDANCE")
    return "SUPPORT_PROTOCOL_ADHERENCE";
  if (understanding.intent === "MEDICATION_EDUCATION")
    return "EDUCATE_WITHOUT_CHANGING_MEDICATION";
  if (understanding.intent === "FOLLOW_UP_CONTEXT")
    return "MAINTAIN_CONTINUITY";

  return "IMPROVE_DAILY_GLUCOSE_CONTROL";
}

function buildMissingInformation(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): string[] {
  if (safety.requiresImmediateSafetyFocus) {
    return [];
  }

  if (
    understanding.intent === "GLUCOSE_REVIEW" &&
    understanding.mentionedGlucose === null
  ) {
    return ["Valor actual de glucosa", "Momento de la medición"];
  }

  if (
    understanding.intent === "EXERCISE_ADVICE" &&
    understanding.mentionedGlucose === null
  ) {
    return ["Glucosa actual antes de recomendar ejercicio"];
  }

  if (understanding.intent === "FOOD_ADVICE") {
    return [];
  }

  return [];
}

function buildExtraDataNeeded(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): string[] {
  const data: string[] = [];

  if (safety.requiresImmediateSafetyFocus) {
    data.push("Evaluación de Semáforo");
  }

  if (understanding.intent === "FOOD_ADVICE") {
    data.push("Alimentos permitidos por protocolo actual");
  }

  if (understanding.intent === "GLUCOSE_REVIEW") {
    data.push("Interpretación glucémica");
  }

  if (understanding.intent === "PROTOCOL_GUIDANCE") {
    data.push("Criterios del protocolo activo");
  }

  if (understanding.intent === "MEDICATION_EDUCATION") {
    data.push("Información educativa de medicamentos");
  }

  if (understanding.intent === "FOLLOW_UP_CONTEXT") {
    data.push("Seguimiento activo o contexto reciente");
  }

  return data;
}

function buildMainAction(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan,
  missingInformation: string[]
): Aida2MainAction {
  if (safety.requiresImmediateSafetyFocus) return "PRIORITIZE_SAFETY";
  if (missingInformation.length > 0) return "ASK_MINIMUM_MISSING_DATA";
  if (understanding.intent === "FOLLOW_UP_CONTEXT") return "RESUME_FOLLOW_UP";
  if (detectMedicationProfileUpdateCandidate(understanding.rawMessage)) {
    return "SUGGEST_PROFILE_UPDATE";
  }

  return "CONSULT_MODULES";
}

function buildThinkingPlan(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): Aida2ThinkingPlan {
  const missingInformation = buildMissingInformation(understanding, safety);
  const shouldSuggestProfileUpdate = detectMedicationProfileUpdateCandidate(
    understanding.rawMessage
  );

  return {
    userGoal: buildUserGoal(understanding),
    clinicalGoal: buildClinicalGoal(understanding, safety),
    knownContextToUse: [
      "Contexto base de sesión",
      "Perfil vivo si está disponible",
      "Protocolo actual si está disponible",
      "Seguimiento activo si existe",
    ],
    missingInformation,
    extraDataNeeded: buildExtraDataNeeded(understanding, safety),
    newRelevantObservation: shouldSuggestProfileUpdate
      ? "El usuario mencionó un medicamento que parece formar parte de su tratamiento y podría requerir confirmación en Perfil."
      : null,
    mainAction: buildMainAction(understanding, safety, missingInformation),
    decisionPrinciple:
      "AIDA debe ayudar al usuario a tomar la mejor decisión posible para controlar su glucosa diaria, sin sustituir al médico ni ajustar medicamentos.",
  };
}

function buildDecision(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan
): Aida2Decision {
  const modulesToRun = getModulesToRun(understanding.intent, safety);

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
    shouldUseSemaphore: modulesToRun.includes("SEMAPHORE"),
  };
}

function buildResponsePlan(
  understanding: Aida2Understanding,
  decision: Aida2Decision,
  safety: Aida2SafetyPlan,
  thinking: Aida2ThinkingPlan
): Aida2ResponsePlan {
  const tone: Aida2ResponseTone[] = ["CALM", "PRACTICAL"];
  const shouldSuggestProfileUpdate =
    thinking.mainAction === "SUGGEST_PROFILE_UPDATE";

  if (decision.priority === "HIGH") {
    tone.push("DIRECT", "SAFETY");
  }

  if (understanding.intent === "MEDICATION_EDUCATION") {
    tone.push("EDUCATIONAL");
  }

  if (understanding.intent === "FOLLOW_UP_CONTEXT") {
    tone.push("FOLLOW_UP");
  }

  const mustDo = [
    "Responder al mensaje actual, no a un tema inventado.",
    "Usar el contexto solo si ayuda a dar continuidad.",
    "Dar una sola acción concreta o una orientación clara.",
    "Mantener la respuesta apropiada para una persona con diabetes tipo 2.",
    `Guiar la respuesta según la acción principal: ${thinking.mainAction}.`,
  ];

  if (understanding.intent === "FOOD_ADVICE") {
    mustDo.push(
      "Validar alimentos con el protocolo activo antes de recomendarlos.",
      "Si el usuario pide recetas, opciones o ideas de comida, usar solo alimentos permitidos por el protocolo activo.",
      "Si el usuario pregunta por una opción mencionada antes, corregir cualquier contradicción previa y responder según el protocolo activo.",
      "Si el usuario pregunta si puede comer o agregar algo, responder primero si conviene o no conviene."
    );
  }

  if (understanding.intent === "MEDICATION_EDUCATION") {
    mustDo.push(
      "Dar educación general sin indicar dosis ni autorizar combinaciones por cuenta propia.",
      "Si el usuario pregunta por un medicamento de marca conocido, mencionar el nombre genérico cuando se conozca. Ejemplo: Trayenta es linagliptina.",
      "Distinguir entre medicamento mencionado, medicamento indicado por el médico y medicamento que el usuario realmente está tomando."
    );

    if (shouldSuggestProfileUpdate) {
      mustDo.push(
        "Si el usuario dice claramente que toma o usa el medicamento, puedes hablar como medicamento actual y sugerir confirmarlo en Perfil."
      );
    } else {
      mustDo.push(
        "Si el usuario solo pregunta por un medicamento y no dice que lo toma, habla en general.",
        "En ese caso usa frases como: 'si tu médico te lo indica', 'si llegas a usarlo' o 'si tu doctor decide iniciarlo'."
      );
    }
  }

  const mustAvoid = [
    "No escribir respuestas largas sin necesidad.",
    "No cambiar de tema al cierre.",
    "No ofrecer menús, aderezos u opciones si el usuario no las pidió.",
    "No inventar datos del usuario.",
    "No mencionar módulos internos, workplan o decisiones internas.",
    "No ajustar, suspender ni modificar medicamentos.",
  ];

  if (understanding.intent === "FOOD_ADVICE") {
    mustAvoid.push(
      "No recomendar alimentos fuera del protocolo activo.",
      "No decir que un alimento no recomendado es seguro solo por combinarlo con proteína o grasa.",
      "No inventar recetas con pan, tostadas, tortilla, arroz, papa, avena, pasta, cereales o granola durante fase diagnóstico.",
      "No dar varias recetas si no han sido validadas por el especialista o el protocolo.",
      "No perder el hilo de la comida actual."
    );
  }

  if (understanding.intent === "MEDICATION_EDUCATION" && !shouldSuggestProfileUpdate) {
    mustAvoid.push(
      "No asumir que el usuario toma el medicamento solo porque preguntó por él.",
      "No decir 'sigue tomándolo', 'sigue tomándola', 'continúa tomándolo' o frases similares si el usuario no confirmó que lo usa."
    );
  }

  return {
    tone,
    length: decision.priority === "HIGH" ? "SHORT" : "MEDIUM",
    mustDo,
    mustAvoid,
    closingInstruction:
      understanding.intent === "FOLLOW_UP_CONTEXT"
        ? "Cerrar retomando el mismo objetivo y pidiendo confirmación breve."
        : safety.requiresImmediateSafetyFocus
          ? "Cerrar con una instrucción de seguridad clara."
          : thinking.mainAction === "ASK_MINIMUM_MISSING_DATA"
            ? "Cerrar pidiendo solo el dato mínimo necesario."
            : thinking.mainAction === "SUGGEST_PROFILE_UPDATE"
              ? "Cerrar sugiriendo confirmar o registrar el dato relevante en Perfil."
              : "Cerrar con una acción breve relacionada con el mismo tema.",
  };
}

export function buildAida2WorkPlan(input: Aida2BrainInput): Aida2WorkPlan {
  const message = input.message.trim();
  const understanding = buildUnderstanding(message);
  const safety = buildSafetyPlan(understanding);
  const thinking = buildThinkingPlan(understanding, safety);
  const decision = buildDecision(understanding, safety);
  const responsePlan = buildResponsePlan(
    understanding,
    decision,
    safety,
    thinking
  );

  return {
    purpose:
      "AIDA ayuda al usuario a controlar sus niveles diarios de glucosa mediante asesoría personalizada para tomar mejores decisiones. Con el tiempo, busca mejorar HbA1c y favorecer una reducción segura de medicamentos bajo supervisión médica.",
    personality:
      "Responde como asesor cercano, profesional y práctico. Debe ser claro, breve, humano, sin sermones, sin tecnicismos innecesarios y con una acción concreta. Debe adaptar la respuesta al nivel del usuario.",
    understanding,
    thinking,
    decision,
    safety,
    responsePlan,
  };
}