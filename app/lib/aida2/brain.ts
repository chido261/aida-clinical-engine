// app/lib/aida2/brain.ts

import {
  buildStateFromRecentText,
  createEmptyAida2ConversationState,
  isPendingActionReminder,
  isShortAcceptance,
  type Aida2ConversationState,
} from "@/app/lib/aida2/conversationState";
import {
  understandCurrentTurn,
  type Aida2TurnDirective,
} from "@/app/lib/aida2/turnUnderstanding";

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

export type Aida2ConversationMode =
  | "NEW_TOPIC"
  | "FOLLOW_UP"
  | "CORRECTION"
  | "UNKNOWN";

export type Aida2FoodQuestionType =
  | "CAN_I_EAT"
  | "ADD_TO_PREVIOUS_MEAL"
  | "WHAT_TO_PAIR"
  | "RECIPE_REQUEST"
  | "VALIDATE_PREPARATION"
  | "HOW_TO_PREPARE"
  | "UNKNOWN";

export type Aida2MealSpecialistAction =
  | "CLASSIFY_OR_VALIDATE"
  | "VALIDATE_PREPARATION"
  | "BUILD_OPTIONS"
  | "EXPLAIN_LIMIT"
  | "NONE";

export type Aida2BrainInput = {
  userId?: string | null;
  message: string;
  history?: string | null;
  conversationState?: Aida2ConversationState | null;
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

export type Aida2FoodContext = {
  isFoodRelated: boolean;
  conversationMode: Aida2ConversationMode;
  questionType: Aida2FoodQuestionType;
  targetText: string | null;
  needsHistory: boolean;
  needsProtocol: boolean;
  needsMealSpecialist: boolean;
  shouldValidatePreparation: boolean;
  decisionFocus: string;
};

export type Aida2ModulePlan = {
  runContextModule: boolean;
  runProtocol: boolean;
  runMealSpecialist: boolean;
  runGlucoseModule: boolean;
  runExerciseModule: boolean;
  runMedicationModule: boolean;
  runSemaphoreModule: boolean;
  expectedMealSpecialistAction: Aida2MealSpecialistAction;
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
  conversationState: Aida2ConversationState;
  turnDirective: Aida2TurnDirective;
  understanding: Aida2Understanding;
  foodContext: Aida2FoodContext;
  modulePlan: Aida2ModulePlan;
  thinking: Aida2ThinkingPlan;
  decision: Aida2Decision;
  safety: Aida2SafetyPlan;
  responsePlan: Aida2ResponsePlan;
};

const FOOD_INTENT_PATTERN =
  /\b(comer|tomer|tomar|beber|desayunar|cenar|almorzar|comida|desayuno|cena|almuerzo|receta|recetas|platillo|platillos|men[uú]|ingrediente|ingredientes|preparar|preparo|cocinar|cocino|hacer|hacerme|hacerle|armar|armarme|dame|darme|agregar|poner|acompañar|acompanar|bebida|alimento|alimentos|opci[oó]n|opciones|idea|ideas|permitido|permitida|conviene|recomiendas|recomendar|seguro|segura)\b/i;

const FOOD_DESIRE_INTENT_PATTERN =
  /\b(antojo|antojos|antoja|antojó|antojo|ganas de|se me antoja|se me antoj[oó]|traigo antojo|tengo antojo|tengo ganas)\b/i;

const FOOD_BUILD_REQUEST_PATTERN =
  /\b(me puedes|puedes|podr[ií]as|quiero|quisiera|dame|hazme|armame|armarme|preparame|prepárame).*\b(receta|recetas|opci[oó]n|opciones|idea|ideas|platillo|platillos|comida|desayuno|cena|men[uú])\b/i;

const EXERCISE_PATTERN =
  /\b(ejercicio|caminar|caminata|entrenar|pesas|cardio|actividad f[ií]sica|correr|gym|gimnasio)\b/i;

const GLUCOSE_PATTERN =
  /\b(glucosa|az[uú]car|mg\/dl|hipoglucemia|hiperglucemia|ayuno|postcomida|despu[eé]s de comer|antes de comer|pico|medici[oó]n)\b/i;

const PROTOCOL_PATTERN =
  /\b(protocolo|fase|plan|permitido|prohibido|avance|retroceder|fase 1|fase 2|diagn[oó]stico|lineamiento|lineamientos)\b/i;

const MEDICATION_PATTERN =
  /\b(medicamento|medicina|metformina|insulina|dosis|pastilla|tratamiento|glibenclamida|dapagliflozina|jardiance|galvus|ozempic|trayenta|linagliptina)\b/i;

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function uniqueModules(modules: Aida2Module[]): Aida2Module[] {
  return Array.from(new Set(modules));
}

function extractGlucose(message: string): number | null {
  const matches = message.match(/\b\d{2,3}\b/g);
  if (!matches) return null;

  const values = matches.map(Number).filter((n) => n >= 40 && n <= 600);
  if (!values.length) return null;

  return values[values.length - 1];
}

function historyLooksFoodRelated(history?: string | null) {
  if (!history) return false;
  return FOOD_INTENT_PATTERN.test(history);
}

function messageExpressesFoodIntention(message: string, history?: string | null) {
  const text = normalize(message);

  if (FOOD_INTENT_PATTERN.test(text)) {
    return true;
  }

  if (FOOD_DESIRE_INTENT_PATTERN.test(text)) {
    return true;
  }

  if (FOOD_BUILD_REQUEST_PATTERN.test(text)) {
    return true;
  }

  if (
    historyLooksFoodRelated(history) &&
    /\b(y si|con qu[eé]|con que|le agrego|le pongo|agrego|pongo|sin|con|la hago|lo hago|har[eé]|hare|eso|esa|ese|las|los|la|el|otra|otro|dame|opciones|ideas|recetas)\b/i.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

function detectIntent(
  message: string,
  history?: string | null,
  conversationState?: Aida2ConversationState | null
): Aida2Intent {
  const text = normalize(message);

  if (
    conversationState?.pendingAction &&
    (isShortAcceptance(message) || isPendingActionReminder(message))
  ) {
    return "FOOD_ADVICE";
  }

  if (
    /\b(qu[eé] est[aá]bamos trabajando|en qu[eé] quedamos|continuemos|retomemos|seguimiento|pendiente|la vez pasada|lo anterior)\b/i.test(
      text
    )
  ) {
    return "FOLLOW_UP_CONTEXT";
  }

  if (messageExpressesFoodIntention(message, history)) {
    return "FOOD_ADVICE";
  }

  if (EXERCISE_PATTERN.test(text)) {
    return "EXERCISE_ADVICE";
  }

  if (GLUCOSE_PATTERN.test(text) || extractGlucose(text) !== null) {
    return "GLUCOSE_REVIEW";
  }

  if (PROTOCOL_PATTERN.test(text)) {
    return "PROTOCOL_GUIDANCE";
  }

  if (MEDICATION_PATTERN.test(text)) {
    return "MEDICATION_EDUCATION";
  }

  return "GENERAL_SUPPORT";
}

function detectConversationMode(
  message: string,
  history?: string | null,
  conversationState?: Aida2ConversationState | null
): Aida2ConversationMode {
  const text = normalize(message);

  if (
    conversationState?.pendingAction &&
    (isShortAcceptance(message) || isPendingActionReminder(message))
  ) {
    return "FOLLOW_UP";
  }

  if (
    /\b(pero dijiste|me dijiste|antes dijiste|te contradices|contradicci[oó]n|corrige|corregir|no era|no dije|eso no)\b/i.test(
      text
    )
  ) {
    return "CORRECTION";
  }

  if (
    /\b(y si|si le agrego|si le pongo|le agrego|le pongo|con qu[eé]|con que|qu[eé] bebida|que bebida|esa opci[oó]n|la opci[oó]n|entonces|ok y ahora|ahora|har[eé]|hare|lo har[eé]|la hago|lo hago|sin|con)\b/i.test(
      text
    )
  ) {
    return "FOLLOW_UP";
  }

  if (
    historyLooksFoodRelated(history) &&
    /\b(eso|esa|ese|esta|este|las|los|la|el|tambien|tambi[eé]n|igual)\b/i.test(
      text
    )
  ) {
    return "FOLLOW_UP";
  }

  if (!text) return "UNKNOWN";

  return "NEW_TOPIC";
}

function detectFoodQuestionType(message: string): Aida2FoodQuestionType {
  const text = normalize(message);

  if (
    /\b(tiene|lleva|ingrediente|ingredientes|hecho con|hecha con|preparado con|preparada con)\b/i.test(
      text
    )
  ) {
    return "VALIDATE_PREPARATION";
  }

  if (
    /\b(receta|recetas|men[uú]|opci[oó]n|opciones|idea|ideas|armar|armarme|hazme|hacerme|preparar|preparame|prepárame)\b/i.test(
      text
    )
  ) {
    return "RECIPE_REQUEST";
  }

  if (
    /\b(puedo comer|puedo tomar|puedo beber|puedo desayunar|puedo cenar|qu[eé] tal|es bueno|es malo|conviene|recomiendas|est[aá] permitido|est[aá] permitida|seguro|segura|tengo antojo|tengo ganas|se me antoja)\b/i.test(
      text
    )
  ) {
    return "CAN_I_EAT";
  }

  if (
    /\b(con qu[eé]|con que|acompañar|acompanar|bebida|tomar|beber)\b/i.test(
      text
    )
  ) {
    return "WHAT_TO_PAIR";
  }

  if (
    /\b(y si|si le agrego|si le pongo|le agrego|le pongo|agregar|poner|con|sin)\b/i.test(
      text
    )
  ) {
    return "ADD_TO_PREVIOUS_MEAL";
  }

  if (
    /\b(c[oó]mo lo preparo|como lo preparo|c[oó]mo la preparo|como la preparo|preparar|preparo|cocinar|cocino|hacerlo|hacerla)\b/i.test(
      text
    )
  ) {
    return "HOW_TO_PREPARE";
  }

  return "UNKNOWN";
}

function extractTargetText(message: string): string | null {
  const text = message.trim();

  const patterns = [
    /\b(?:tengo|traigo)\s+(?:antojo|ganas)\s+de\s+(.+?)(?:,|\.|\?|$)/i,
    /\bse\s+me\s+antoj[oó]?\s+(.+?)(?:,|\.|\?|$)/i,
    /\bpuedo\s+(?:comer|tomar|beber|desayunar|cenar)\s+(.+?)\??$/i,
    /\bqu[eé]\s+tal\s+(.+?)\??$/i,
    /\brecetas?\s+(?:con|de|para)\s+(.+?)\??$/i,
    /\bopciones?\s+(?:con|de|para)\s+(.+?)\??$/i,
    /\bideas?\s+(?:con|de|para)\s+(.+?)\??$/i,
    /\b(?:armar|armarme|hacerme|hazme|prepararme|prepárame)\s+(?:unas?|algunas?|\d+)?\s*(?:recetas|opciones|ideas)?\s*(?:con|de|para)\s+(.+?)\??$/i,
    /\bsi\s+le\s+(?:agrego|pongo)\s+(.+?)\??$/i,
    /\ble\s+(?:agrego|pongo)\s+(.+?)\??$/i,
    /\bcon\s+qu[eé]\s+(.+?)\??$/i,
    /\btiene\s+(.+?)\??$/i,
    /\blleva\s+(.+?)\??$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return cleanTargetText(match[1]);
    }
  }

  return text.length <= 80 ? cleanTargetText(text) : null;
}

function cleanTargetText(value: string) {
  return value
    .replace(/[¿?¡!]/g, "")
    .replace(
      /\b(me puedes|puedes|podr[ií]as|quiero|quisiera|dame|hazme|armame|armarme|preparame|prepárame)\b/gi,
      ""
    )
    .replace(/\b(unas?|algunas?|\d+)\s+(recetas|opciones|ideas|platillos)\b/gi, "")
    .replace(/\b(receta|recetas|opci[oó]n|opciones|idea|ideas|platillo|platillos)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldValidatePreparation(
  message: string,
  questionType: Aida2FoodQuestionType
) {
  const text = normalize(message);

  if (questionType === "VALIDATE_PREPARATION") return true;

  return /\b(tiene|lleva|hecho con|hecha con|preparado con|preparada con|ingrediente|ingredientes)\b/i.test(
    text
  );
}

function buildFoodDecisionFocus(params: {
  isFoodRelated: boolean;
  conversationMode: Aida2ConversationMode;
  questionType: Aida2FoodQuestionType;
  targetText: string | null;
  needsHistory: boolean;
  shouldValidatePreparation: boolean;
}) {
  const {
    isFoodRelated,
    conversationMode,
    questionType,
    targetText,
    needsHistory,
    shouldValidatePreparation,
  } = params;

  if (!isFoodRelated) {
    return "El mensaje no requiere decisión alimentaria.";
  }

  if (conversationMode === "CORRECTION") {
    return "El usuario señala una posible contradicción. Cerebro debe conservar contexto, corregir si aplica y no defender respuestas previas.";
  }

  if (needsHistory) {
    return "El mensaje parece depender de una comida previa. Cerebro debe usar historial antes de tratarlo como tema nuevo.";
  }

  if (shouldValidatePreparation) {
    return "El usuario describe una preparación. Cerebro debe pedir validación técnica por ingredientes al especialista.";
  }

  if (questionType === "CAN_I_EAT") {
    return `El usuario pregunta si puede consumir algo${
      targetText ? `: ${targetText}` : ""
    }. Cerebro debe pedir validación técnica y responder si conviene o no conviene.`;
  }

  if (questionType === "ADD_TO_PREVIOUS_MEAL") {
    return "El usuario quiere agregar algo a una comida previa. Cerebro debe mantener esa comida y validar solo el elemento nuevo.";
  }

  if (questionType === "WHAT_TO_PAIR") {
    return "El usuario pide acompañamiento o bebida. Cerebro debe mantener el contexto de la comida actual y no inventar platillo nuevo.";
  }

  if (questionType === "RECIPE_REQUEST") {
    return `El usuario pide receta u opciones${
      targetText ? ` sobre: ${targetText}` : ""
    }. Cerebro debe pedir al especialista validar primero el alimento o preparación consultada. Solo debe construir recetas si el elemento es compatible con el protocolo activo.`;
  }

  if (questionType === "HOW_TO_PREPARE") {
    return "El usuario pregunta preparación. Cerebro debe pedir apoyo técnico sin cambiar la comida original.";
  }

  return "El usuario requiere asesoría alimentaria orientada a estabilidad glucémica.";
}

function buildFoodContext(
  message: string,
  history: string,
  understanding: Aida2Understanding,
  conversationState: Aida2ConversationState,
  turnDirective: Aida2TurnDirective
): Aida2FoodContext {
  const isFoodRelated =
    understanding.intent === "FOOD_ADVICE" || understanding.mentionsFood;

  const conversationMode = turnDirective.requiresHistory
    ? "FOLLOW_UP"
    : detectConversationMode(message, history, conversationState);

  const directiveQuestionTypes: Partial<Record<Aida2TurnDirective["dialogueAct"], Aida2FoodQuestionType>> = {
    VALIDATE_FOOD: "CAN_I_EAT",
    REQUEST_RECIPE: "RECIPE_REQUEST",
    SELECT_RECIPE_OPTION: "HOW_TO_PREPARE",
    MODIFY_SELECTED_OPTION: "ADD_TO_PREVIOUS_MEAL",
    ASK_PREPARATION: "HOW_TO_PREPARE",
    PAIR_FOOD_OR_DRINK: "WHAT_TO_PAIR",
    VALIDATE_PREPARATION: "VALIDATE_PREPARATION",
  };
  const questionType = isFoodRelated
    ? directiveQuestionTypes[turnDirective.dialogueAct] ?? detectFoodQuestionType(message)
    : "UNKNOWN";

  const needsHistory =
    isFoodRelated &&
    (turnDirective.requiresHistory || conversationMode === "CORRECTION");

  const validatePreparation =
    isFoodRelated && shouldValidatePreparation(message, questionType);

  const targetText = isFoodRelated
    ? turnDirective.targetHint ?? extractTargetText(message) ??
      conversationState.pendingAction?.target ??
      conversationState.lastFoodTarget
    : null;

  const pendingDecisionFocus =
    conversationState.pendingAction &&
    (isShortAcceptance(message) || isPendingActionReminder(message))
      ? `El usuario está aceptando o recordando una acción pendiente: ${
          conversationState.pendingAction.reason ??
          conversationState.lastAssistantPromise ??
          "continuar con la acción alimentaria pendiente"
        }. Cerebro debe continuar esa acción sin tratar el mensaje como tema nuevo.`
      : null;

  return {
    isFoodRelated,
    conversationMode,
    questionType,
    targetText,
    needsHistory,
    needsProtocol: isFoodRelated,
    needsMealSpecialist: isFoodRelated,
    shouldValidatePreparation: validatePreparation,
    decisionFocus:
      pendingDecisionFocus ??
      buildFoodDecisionFocus({
        isFoodRelated,
        conversationMode,
        questionType,
        targetText,
        needsHistory,
        shouldValidatePreparation: validatePreparation,
      }),
  };
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

function buildUnderstanding(
  message: string,
  history?: string | null,
  conversationState?: Aida2ConversationState | null
): Aida2Understanding {
  const normalizedMessage = normalize(message);
  const intent = detectIntent(message, history, conversationState);

  const mentionsFood =
    messageExpressesFoodIntention(message, history) ||
    Boolean(
      conversationState?.pendingAction &&
        (isShortAcceptance(message) || isPendingActionReminder(message))
    );

  return {
    rawMessage: message,
    normalizedMessage,
    intent,
    mentionedGlucose: extractGlucose(message),
    mentionsFood,
    mentionsExercise: EXERCISE_PATTERN.test(normalizedMessage),
    mentionsMedication: MEDICATION_PATTERN.test(normalizedMessage),
    mentionsProtocol: PROTOCOL_PATTERN.test(normalizedMessage),
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

function buildModulePlan(
  understanding: Aida2Understanding,
  foodContext: Aida2FoodContext,
  safety: Aida2SafetyPlan,
  conversationState: Aida2ConversationState
): Aida2ModulePlan {
  if (safety.requiresImmediateSafetyFocus) {
    return {
      runContextModule: true,
      runProtocol: false,
      runMealSpecialist: false,
      runGlucoseModule: false,
      runExerciseModule: false,
      runMedicationModule: false,
      runSemaphoreModule: true,
      expectedMealSpecialistAction: "NONE",
    };
  }

  if (foodContext.isFoodRelated) {
    let expectedMealSpecialistAction: Aida2MealSpecialistAction =
      "CLASSIFY_OR_VALIDATE";

    const pendingAction = conversationState.pendingAction;
    const shouldContinuePendingAction =
      conversationState.shouldContinuePendingAction && Boolean(pendingAction);

    if (foodContext.shouldValidatePreparation) {
      expectedMealSpecialistAction = "VALIDATE_PREPARATION";
    }

    if (
      foodContext.questionType === "RECIPE_REQUEST" ||
      foodContext.questionType === "WHAT_TO_PAIR" ||
      foodContext.questionType === "HOW_TO_PREPARE"
    ) {
      expectedMealSpecialistAction = "BUILD_OPTIONS";
    }

    if (
      foodContext.questionType === "CAN_I_EAT" ||
      foodContext.questionType === "ADD_TO_PREVIOUS_MEAL"
    ) {
      expectedMealSpecialistAction = "CLASSIFY_OR_VALIDATE";
    }

    if (
      shouldContinuePendingAction &&
      (pendingAction?.type === "BUILD_ALTERNATIVES" ||
        pendingAction?.type === "BUILD_RECIPES" ||
        pendingAction?.type === "CONTINUE_PREVIOUS")
    ) {
      expectedMealSpecialistAction = "BUILD_OPTIONS";
    }

    if (
      shouldContinuePendingAction &&
      pendingAction?.type === "ASK_INGREDIENTS"
    ) {
      expectedMealSpecialistAction = "VALIDATE_PREPARATION";
    }

    if (
      shouldContinuePendingAction &&
      pendingAction?.type === "EXPLAIN_DECISION"
    ) {
      expectedMealSpecialistAction = "EXPLAIN_LIMIT";
    }

    return {
      runContextModule: true,
      runProtocol: true,
      runMealSpecialist: true,
      runGlucoseModule: false,
      runExerciseModule: false,
      runMedicationModule: false,
      runSemaphoreModule: false,
      expectedMealSpecialistAction,
    };
  }

  return {
    runContextModule: true,
    runProtocol: understanding.intent === "PROTOCOL_GUIDANCE",
    runMealSpecialist: false,
    runGlucoseModule:
      understanding.intent === "GLUCOSE_REVIEW" ||
      understanding.intent === "EXERCISE_ADVICE" ||
      understanding.intent === "PROTOCOL_GUIDANCE",
    runExerciseModule: understanding.intent === "EXERCISE_ADVICE",
    runMedicationModule: understanding.intent === "MEDICATION_EDUCATION",
    runSemaphoreModule:
      understanding.intent === "GLUCOSE_REVIEW" ||
      understanding.intent === "EXERCISE_ADVICE" ||
      understanding.intent === "MEDICATION_EDUCATION",
    expectedMealSpecialistAction: "NONE",
  };
}

function getModulesToRun(
  intent: Aida2Intent,
  safety: Aida2SafetyPlan,
  modulePlan: Aida2ModulePlan
): Aida2Module[] {
  const modules: Aida2Module[] = [];

  if (modulePlan.runContextModule) modules.push("CONTEXT");

  if (safety.requiresImmediateSafetyFocus || modulePlan.runSemaphoreModule) {
    modules.push("SEMAPHORE");
  }

  if (modulePlan.runMealSpecialist) modules.push("NUTRITION");
  if (modulePlan.runProtocol) modules.push("PROTOCOL");
  if (modulePlan.runGlucoseModule) modules.push("GLUCOSE");
  if (modulePlan.runExerciseModule) modules.push("EXERCISE");
  if (modulePlan.runMedicationModule) modules.push("MEDICATION");

  if (intent === "FOLLOW_UP_CONTEXT") modules.push("FOLLOW_UP");

  return uniqueModules(modules);
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

  return [];
}

function buildExtraDataNeeded(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan,
  foodContext: Aida2FoodContext
): string[] {
  const data: string[] = [];

  if (safety.requiresImmediateSafetyFocus) {
    data.push("Evaluación de Semáforo");
  }

  if (foodContext.isFoodRelated) {
    data.push("Protocolo activo de alimentación");
    data.push("Validación técnica del especialista de comida");

    if (foodContext.needsHistory) {
      data.push("Historial reciente para conservar continuidad");
    }
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
  safety: Aida2SafetyPlan,
  foodContext: Aida2FoodContext
): Aida2ThinkingPlan {
  const missingInformation = buildMissingInformation(understanding, safety);
  const shouldSuggestProfileUpdate = detectMedicationProfileUpdateCandidate(
    understanding.rawMessage
  );

  const knownContextToUse = [
    "Contexto base de sesión",
    "Perfil vivo si está disponible",
    "Protocolo actual si está disponible",
    "Seguimiento activo si existe",
  ];

  if (foodContext.isFoodRelated) {
    knownContextToUse.push("FoodContext generado por Cerebro");
  }

  return {
    userGoal: buildUserGoal(understanding),
    clinicalGoal: buildClinicalGoal(understanding, safety),
    knownContextToUse,
    missingInformation,
    extraDataNeeded: buildExtraDataNeeded(understanding, safety, foodContext),
    newRelevantObservation: shouldSuggestProfileUpdate
      ? "El usuario mencionó un medicamento que parece formar parte de su tratamiento y podría requerir confirmación en Perfil."
      : foodContext.isFoodRelated
        ? foodContext.decisionFocus
        : null,
    mainAction: buildMainAction(understanding, safety, missingInformation),
    decisionPrinciple:
      "Cerebro interpreta intención, continuidad y dirección. Los módulos especializados validan con protocolos. Composer solo redacta la respuesta final.",
  };
}

function buildDecision(
  understanding: Aida2Understanding,
  safety: Aida2SafetyPlan,
  modulePlan: Aida2ModulePlan
): Aida2Decision {
  const modulesToRun = getModulesToRun(
    understanding.intent,
    safety,
    modulePlan
  );

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
  thinking: Aida2ThinkingPlan,
  foodContext: Aida2FoodContext,
  modulePlan: Aida2ModulePlan
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

  if (
    understanding.intent === "FOLLOW_UP_CONTEXT" ||
    foodContext.conversationMode === "FOLLOW_UP" ||
    foodContext.conversationMode === "CORRECTION"
  ) {
    tone.push("FOLLOW_UP");
  }

  const mustDo = [
    "Responder al mensaje actual, no a un tema inventado.",
    "Usar el contexto solo si ayuda a dar continuidad.",
    "Dar una sola acción concreta o una orientación clara.",
    "Mantener la respuesta apropiada para una persona con diabetes tipo 2.",
    `Guiar la respuesta según la acción principal: ${thinking.mainAction}.`,
  ];

  if (foodContext.isFoodRelated) {
    mustDo.push(
      "Respetar el FoodContext generado por Cerebro.",
      `Modo de conversación alimentaria: ${foodContext.conversationMode}.`,
      `Tipo de consulta alimentaria: ${foodContext.questionType}.`,
      `Foco de decisión: ${foodContext.decisionFocus}.`,
      `Acción esperada del especialista: ${modulePlan.expectedMealSpecialistAction}.`,
      "Validar con protocolo y especialista antes de recomendar.",
      "No cambiar la comida consultada por otra diferente.",
      "Responder primero si conviene o no conviene."
    );

    if (foodContext.targetText) {
      mustDo.push(`Elemento consultado por el usuario: ${foodContext.targetText}.`);
    }

    if (foodContext.needsHistory) {
      mustDo.push(
        "Usar historial reciente para entender si el usuario continúa una comida previa."
      );
    }

    if (modulePlan.expectedMealSpecialistAction === "BUILD_OPTIONS") {
      mustDo.push(
        "Si Cerebro detectó una acción pendiente de recetas u opciones, entregar las opciones validadas sin volver a preguntar."
      );
    }
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

  if (foodContext.isFoodRelated) {
    mustAvoid.push(
      "No tomar decisiones técnicas que correspondan al especialista.",
      "No inventar recetas, alimentos o acompañamientos no validados.",
      "No perder el hilo de la comida actual.",
      "No clasificar una preparación especial solo por su nombre común.",
      "No convertir un alimento no recomendado en permitido solo por combinarlo con otro alimento."
    );

    if (modulePlan.expectedMealSpecialistAction === "BUILD_OPTIONS") {
      mustAvoid.push(
        "No volver a preguntar si el usuario ya aceptó una acción pendiente de recetas u opciones."
      );
    }
  }

  if (
    understanding.intent === "MEDICATION_EDUCATION" &&
    !shouldSuggestProfileUpdate
  ) {
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
              : foodContext.isFoodRelated
                ? modulePlan.expectedMealSpecialistAction === "BUILD_OPTIONS"
                  ? "Cerrar con la opción o acción concreta ya entregada, sin preguntar de nuevo si quiere continuar."
                  : "Cerrar con una acción breve relacionada con la decisión alimentaria o medición de glucosa."
                : "Cerrar con una acción breve relacionada con el mismo tema.",
  };
}

export function buildAida2WorkPlan(input: Aida2BrainInput): Aida2WorkPlan {
  const message = input.message.trim();
  const history = input.history ?? "";

  // La memoria es contexto de entrada, no una orden vigente. Cada turno debe
  // reconciliarla con el mensaje actual antes de decidir qué módulos ejecutar.
  const conversationState = buildStateFromRecentText({
    history,
    userMessage: message,
    previousState: input.conversationState ?? createEmptyAida2ConversationState(),
  });

  const understanding = buildUnderstanding(
    message,
    history,
    conversationState
  );

  const turnDirective = understandCurrentTurn({
    message,
    conversationState,
  });

  const safety = buildSafetyPlan(understanding);

  const foodContext = buildFoodContext(
    message,
    history,
    understanding,
    conversationState,
    turnDirective
  );

  const modulePlan = buildModulePlan(
    understanding,
    foodContext,
    safety,
    conversationState
  );

  const thinking = buildThinkingPlan(understanding, safety, foodContext);

  const decision = buildDecision(understanding, safety, modulePlan);

  const responsePlan = buildResponsePlan(
    understanding,
    decision,
    safety,
    thinking,
    foodContext,
    modulePlan
  );

  return {
    purpose:
      "AIDA ayuda al usuario a controlar sus niveles diarios de glucosa mediante mejores decisiones de alimentación, ejercicio, seguimiento y educación. Cada paciente puede iniciar en una fase diferente; el objetivo general se mantiene, pero el protocolo, alimentos y lineamientos cambian según su contexto.",
    personality:
      "Responde como asesor cercano, profesional y práctico. Debe ser claro, breve, humano, sin sermones, sin tecnicismos innecesarios y con una acción concreta. Debe adaptar la respuesta al nivel del usuario.",
    conversationState,
    turnDirective,
    understanding,
    foodContext,
    modulePlan,
    thinking,
    decision,
    safety,
    responsePlan,
  };
}
