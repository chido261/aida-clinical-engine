import type OpenAI from "openai";

import type { Aida2CulinaryMemory } from "./culinaryMemoryTypes";
import { understandCurrentTurn, type Aida2DialogueAct } from "./turnUnderstanding";

export type Aida2Capability =
  | "PROTOCOL_VALIDATION"
  | "SEMANTIC_FOOD_ANALYSIS"
  | "CULINARY_PLANNING"
  | "RECIPE_RECALL"
  | "CONTEXT_REPAIR"
  | "GENERAL_COMPOSITION";

export type Aida2CognitiveTaskType =
  | "GENERATE_OPTIONS"
  | "VALIDATE_FOOD"
  | "EXPLAIN_RECIPE"
  | "MODIFY_OPTION"
  | "ADD_ACCOMPANIMENT"
  | "SUBSTITUTE_INGREDIENT"
  | "REPAIR_RESPONSE";

export type Aida2CognitiveTask = {
  id: string;
  type: Aida2CognitiveTaskType;
  target: string | null;
  quantity: number | null;
  selectedOption: number | null;
  relationTarget: string | null;
  requirements: string[];
  exclusions: string[];
  preferences: string[];
  dependsOn: string[];
};

export type Aida2TurnCognition = {
  dialogueAct: Aida2DialogueAct;
  confidence: number;
  explicitCurrentGoal: string;
  foodTarget: string | null;
  preparationStyle: string | null;
  requestedCount: number | null;
  selectedOption: number | null;
  requestedAddition: string | null;
  constraints: string[];
  tasks: Aida2CognitiveTask[];
  referencesPreviousTurn: boolean;
  needsConversationHistory: boolean;
  capabilities: Aida2Capability[];
  responseContract: {
    answerCurrentQuestionFirst: boolean;
    exactOptionCount: number | null;
    preservePreviousTarget: boolean;
    mustRepairPreviousResponse: boolean;
  };
  source: "cognitive_model" | "deterministic_fallback";
};

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
    : [];
}

function parseCognition(text: string): Aida2TurnCognition | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const contract = (value.responseContract ?? {}) as Record<string, unknown>;
    const acts = new Set([
      "VALIDATE_FOOD", "REQUEST_RECIPE", "SELECT_RECIPE_OPTION", "MODIFY_SELECTED_OPTION",
      "ASK_PREPARATION", "PAIR_FOOD_OR_DRINK", "VALIDATE_PREPARATION", "GENERAL_FOOD",
      "NON_FOOD", "REPAIR_PREVIOUS_RESPONSE",
    ]);
    const capabilities = new Set<Aida2Capability>([
      "PROTOCOL_VALIDATION", "SEMANTIC_FOOD_ANALYSIS", "CULINARY_PLANNING",
      "RECIPE_RECALL", "CONTEXT_REPAIR", "GENERAL_COMPOSITION",
    ]);
    const dialogueAct = typeof value.dialogueAct === "string" && acts.has(value.dialogueAct)
      ? value.dialogueAct as Aida2TurnCognition["dialogueAct"]
      : null;
    if (!dialogueAct) return null;
    const count = Number(value.requestedCount);
    const option = Number(value.selectedOption);
    const exactCount = Number(contract.exactOptionCount);
    const taskTypes = new Set<Aida2CognitiveTaskType>([
      "GENERATE_OPTIONS", "VALIDATE_FOOD", "EXPLAIN_RECIPE", "MODIFY_OPTION",
      "ADD_ACCOMPANIMENT", "SUBSTITUTE_INGREDIENT", "REPAIR_RESPONSE",
    ]);
    const tasks = Array.isArray(value.tasks) ? value.tasks.flatMap((raw, index) => {
      if (!raw || typeof raw !== "object") return [];
      const task = raw as Record<string, unknown>;
      if (typeof task.type !== "string" || !taskTypes.has(task.type as Aida2CognitiveTaskType)) return [];
      const quantity = Number(task.quantity);
      const selected = Number(task.selectedOption);
      return [{
        id: typeof task.id === "string" && task.id.trim() ? task.id.trim() : `task_${index + 1}`,
        type: task.type as Aida2CognitiveTaskType,
        target: typeof task.target === "string" && task.target.trim() ? task.target.trim() : null,
        quantity: Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 5) : null,
        selectedOption: Number.isInteger(selected) && selected > 0 ? selected : null,
        relationTarget: typeof task.relationTarget === "string" && task.relationTarget.trim() ? task.relationTarget.trim() : null,
        requirements: strings(task.requirements),
        exclusions: strings(task.exclusions),
        preferences: strings(task.preferences),
        dependsOn: strings(task.dependsOn),
      }];
    }) : [];
    return {
      dialogueAct,
      confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
      explicitCurrentGoal: typeof value.explicitCurrentGoal === "string" ? value.explicitCurrentGoal.trim() : "Responder el turno actual",
      foodTarget: typeof value.foodTarget === "string" && value.foodTarget.trim() ? value.foodTarget.trim() : null,
      preparationStyle: typeof value.preparationStyle === "string" && value.preparationStyle.trim() ? value.preparationStyle.trim() : null,
      requestedCount: Number.isInteger(count) && count > 0 ? Math.min(count, 5) : null,
      selectedOption: Number.isInteger(option) && option > 0 ? option : null,
      requestedAddition: typeof value.requestedAddition === "string" && value.requestedAddition.trim() ? value.requestedAddition.trim() : null,
      constraints: strings(value.constraints),
      tasks,
      referencesPreviousTurn: value.referencesPreviousTurn === true,
      needsConversationHistory: value.needsConversationHistory === true,
      capabilities: strings(value.capabilities).filter((item): item is Aida2Capability => capabilities.has(item as Aida2Capability)),
      responseContract: {
        answerCurrentQuestionFirst: contract.answerCurrentQuestionFirst !== false,
        exactOptionCount: Number.isInteger(exactCount) && exactCount > 0 ? Math.min(exactCount, 5) : null,
        preservePreviousTarget: contract.preservePreviousTarget === true,
        mustRepairPreviousResponse: contract.mustRepairPreviousResponse === true,
      },
      source: "cognitive_model",
    };
  } catch {
    return null;
  }
}

function fallbackCognition(message: string): Aida2TurnCognition {
  const directive = understandCurrentTurn({ message });
  return {
    dialogueAct: directive.dialogueAct,
    confidence: 0.45,
    explicitCurrentGoal: directive.reason,
    foodTarget: directive.targetHint,
    preparationStyle: null,
    requestedCount: null,
    selectedOption: directive.selectedOption,
    requestedAddition: null,
    constraints: [],
    tasks: [],
    referencesPreviousTurn: directive.requiresHistory,
    needsConversationHistory: directive.requiresHistory,
    capabilities: directive.allowsCulinaryPlan
      ? ["SEMANTIC_FOOD_ANALYSIS", "CULINARY_PLANNING"]
      : directive.dialogueAct === "VALIDATE_FOOD"
        ? ["PROTOCOL_VALIDATION"]
        : ["GENERAL_COMPOSITION"],
    responseContract: {
      answerCurrentQuestionFirst: true,
      exactOptionCount: null,
      preservePreviousTarget: directive.requiresHistory,
      mustRepairPreviousResponse: false,
    },
    source: "deterministic_fallback",
  };
}

function authorizeCognition(
  cognition: Aida2TurnCognition,
  culinaryMemory?: Aida2CulinaryMemory | null
): Aida2TurnCognition {
  const capabilityMap: Record<Aida2TurnCognition["dialogueAct"], Aida2Capability[]> = {
    VALIDATE_FOOD: ["SEMANTIC_FOOD_ANALYSIS", "PROTOCOL_VALIDATION"],
    REQUEST_RECIPE: ["SEMANTIC_FOOD_ANALYSIS", "PROTOCOL_VALIDATION", "CULINARY_PLANNING"],
    SELECT_RECIPE_OPTION: ["RECIPE_RECALL", "CULINARY_PLANNING"],
    MODIFY_SELECTED_OPTION: ["RECIPE_RECALL", "PROTOCOL_VALIDATION", "CULINARY_PLANNING"],
    ASK_PREPARATION: ["RECIPE_RECALL", "CULINARY_PLANNING"],
    PAIR_FOOD_OR_DRINK: ["RECIPE_RECALL", "PROTOCOL_VALIDATION", "CULINARY_PLANNING"],
    VALIDATE_PREPARATION: ["SEMANTIC_FOOD_ANALYSIS", "PROTOCOL_VALIDATION"],
    REPAIR_PREVIOUS_RESPONSE: ["RECIPE_RECALL", "CONTEXT_REPAIR", "CULINARY_PLANNING"],
    GENERAL_FOOD: ["SEMANTIC_FOOD_ANALYSIS", "PROTOCOL_VALIDATION", "GENERAL_COMPOSITION"],
    NON_FOOD: ["GENERAL_COMPOSITION"],
  };
  const contextual = cognition.referencesPreviousTurn || [
    "SELECT_RECIPE_OPTION", "MODIFY_SELECTED_OPTION", "ASK_PREPARATION",
    "PAIR_FOOD_OR_DRINK", "REPAIR_PREVIOUS_RESPONSE",
  ].includes(cognition.dialogueAct);
  const count = cognition.dialogueAct === "REPAIR_PREVIOUS_RESPONSE"
    ? culinaryMemory?.requestedCount ?? cognition.requestedCount
    : cognition.requestedCount;
  const fallbackTaskType: Partial<Record<Aida2TurnCognition["dialogueAct"], Aida2CognitiveTaskType>> = {
    VALIDATE_FOOD: "VALIDATE_FOOD",
    REQUEST_RECIPE: "GENERATE_OPTIONS",
    SELECT_RECIPE_OPTION: "EXPLAIN_RECIPE",
    MODIFY_SELECTED_OPTION: "MODIFY_OPTION",
    ASK_PREPARATION: "EXPLAIN_RECIPE",
    PAIR_FOOD_OR_DRINK: "ADD_ACCOMPANIMENT",
    REPAIR_PREVIOUS_RESPONSE: "REPAIR_RESPONSE",
  };
  const tasks = cognition.tasks.length > 0 ? cognition.tasks : fallbackTaskType[cognition.dialogueAct]
    ? [{
        id: "task_1",
        type: fallbackTaskType[cognition.dialogueAct]!,
        target: cognition.foodTarget,
        quantity: cognition.requestedCount,
        selectedOption: cognition.selectedOption,
        relationTarget: null,
        requirements: cognition.constraints,
        exclusions: [],
        preferences: cognition.requestedAddition ? [cognition.requestedAddition] : [],
        dependsOn: [],
      }]
    : [];
  return {
    ...cognition,
    foodTarget: cognition.foodTarget ?? (contextual ? culinaryMemory?.target ?? null : null),
    requestedCount: count,
    referencesPreviousTurn: contextual,
    needsConversationHistory: contextual,
    capabilities: capabilityMap[cognition.dialogueAct],
    tasks,
    responseContract: {
      ...cognition.responseContract,
      exactOptionCount: cognition.dialogueAct === "REQUEST_RECIPE"
        ? count
        : cognition.responseContract.exactOptionCount,
      preservePreviousTarget: contextual,
      mustRepairPreviousResponse: cognition.dialogueAct === "REPAIR_PREVIOUS_RESPONSE",
    },
  };
}

export async function understandTurnWithBrain(params: {
  openai: OpenAI;
  message: string;
  recentHistory?: string;
  culinaryMemory?: Aida2CulinaryMemory | null;
}): Promise<Aida2TurnCognition> {
  const { openai, message, recentHistory, culinaryMemory } = params;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: [
          "Eres la corteza ejecutiva de AIDA. Comprende el acto de diálogo actual antes de autorizar capacidades.",
          "La intención explícita del mensaje actual vence al tema anterior. El historial sólo resuelve pronombres, opciones y continuaciones reales.",
          "No decidas si un alimento está permitido y no inventes recetas.",
          "Distingue: validar alimento; pedir recetas; elegir opción previa; modificar opción; pedir preparación; complementar con bebida/comida; validar ingredientes; corregir una respuesta incompleta.",
          "En preparaciones 'X de Y', foodTarget es la base real Y y preparationStyle es X cuando X sólo describe estilo o imitación. Ejemplo: atún de soya => foodTarget soya, preparationStyle atún.",
          "Formas como 'puedo comerlo', 'qué me dices de', 'conviene' pueden ser validación aunque no digan exactamente 'puedo comer'.",
          "Si el usuario reclama que pidió N opciones y recibió menos, usa REPAIR_PREVIOUS_RESPONSE y conserva objetivo y cantidad del plan activo.",
          "Descompón todas las solicitudes del mensaje en tasks; no hay límite conceptual de dos tareas.",
          "Cada task contiene id, type, target, quantity, selectedOption, relationTarget, requirements, exclusions, preferences y dependsOn.",
          "Tipos permitidos: GENERATE_OPTIONS, VALIDATE_FOOD, EXPLAIN_RECIPE, MODIFY_OPTION, ADD_ACCOMPANIMENT, SUBSTITUTE_INGREDIENT, REPAIR_RESPONSE.",
          "Ejemplo: '3 opciones con pulpo, una con aguacate; valida tostada; agrega bebida no agua, té o café' produce tres tasks. La primera quantity=3 y requirements=['al menos una con aguacate']; la tercera exclusions=['agua'], preferences=['té','café'] y depende de la primera.",
          "Devuelve exclusivamente JSON con dialogueAct, confidence, explicitCurrentGoal, foodTarget, preparationStyle, requestedCount, selectedOption, requestedAddition, constraints, tasks, referencesPreviousTurn, needsConversationHistory, capabilities y responseContract.",
          "capabilities sólo puede contener PROTOCOL_VALIDATION, SEMANTIC_FOOD_ANALYSIS, CULINARY_PLANNING, RECIPE_RECALL, CONTEXT_REPAIR, GENERAL_COMPOSITION.",
          "responseContract contiene answerCurrentQuestionFirst, exactOptionCount, preservePreviousTarget y mustRepairPreviousResponse.",
          culinaryMemory ? `PLAN CULINARIO ACTIVO ESTRUCTURADO:\n${JSON.stringify(culinaryMemory)}` : "No existe plan culinario activo.",
          recentHistory ? `HISTORIAL BREVE (úsalo sólo si es necesario):\n${recentHistory}` : "",
        ].filter(Boolean).join("\n"),
      }, { role: "user", content: message }],
    });
    const parsed = parseCognition(response.choices[0]?.message?.content ?? "");
    return authorizeCognition(
      parsed && parsed.confidence >= 0.5 ? parsed : fallbackCognition(message),
      culinaryMemory
    );
  } catch {
    return authorizeCognition(fallbackCognition(message), culinaryMemory);
  }
}
