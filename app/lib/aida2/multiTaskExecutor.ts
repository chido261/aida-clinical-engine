import type OpenAI from "openai";

import type { Aida2TurnCognition, Aida2CognitiveTask } from "./turnCognition";
import type { ProtocolModuleOutput } from "./modules/protocolModule";
import type { CulinaryPlan, SemanticFoodInterpretation } from "./modules/foodDecisionTypes";
import { buildCulinaryPlan } from "./modules/culinaryPlanner";
import { evaluateFoodWithProtocol } from "./modules/protocolFoodEngine";

export type Aida2TaskExecution = {
  taskId: string;
  type: Aida2CognitiveTask["type"];
  completed: boolean;
  summary: string;
};

export type Aida2MultiTaskResult = {
  handled: boolean;
  valid: boolean;
  reply: string;
  executions: Aida2TaskExecution[];
  primaryCulinaryPlan: CulinaryPlan | null;
  violations: string[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function literalInterpretation(target: string): SemanticFoodInterpretation {
  return {
    originalText: target,
    dishName: target,
    semanticType: "literal_food",
    baseIngredients: [target],
    declaredIngredients: [],
    styleReferences: [],
    isCommercialProduct: false,
    requiresClarification: false,
    clarificationReason: null,
    confidence: 1,
    source: "semantic_fallback",
  };
}

function formatRecipeChoices(plan: CulinaryPlan) {
  return plan.recipes.map((recipe, index) => {
    const ingredients = recipe.ingredients.slice(0, 5).map(item => item.name).join(", ");
    return `${index + 1}. ${recipe.title}: ${ingredients}.`;
  }).join("\n");
}

function beverageForTask(task: Aida2CognitiveTask, protocol: ProtocolModuleOutput) {
  const beverages = protocol.structured.allowedFoods.beverages;
  const exclusions = task.exclusions.map(normalize);
  const allowed = beverages.filter(beverage =>
    !exclusions.some(exclusion => normalize(beverage).includes(exclusion))
  );
  for (const preference of task.preferences) {
    const match = allowed.find(beverage => normalize(beverage).includes(normalize(preference)));
    if (match) return match;
  }
  return allowed[0] ?? null;
}

export async function executeMultiTaskGraph(params: {
  openai: OpenAI;
  cognition: Aida2TurnCognition;
  protocol: ProtocolModuleOutput;
}): Promise<Aida2MultiTaskResult> {
  const { openai, cognition, protocol } = params;
  const supported = new Set(["GENERATE_OPTIONS", "VALIDATE_FOOD", "ADD_ACCOMPANIMENT"]);
  if (cognition.tasks.length < 2 || cognition.tasks.some(task => !supported.has(task.type))) {
    return { handled: false, valid: true, reply: "", executions: [], primaryCulinaryPlan: null, violations: [] };
  }

  const sections: string[] = [];
  const executions: Aida2TaskExecution[] = [];
  const violations: string[] = [];
  let primaryCulinaryPlan: CulinaryPlan | null = null;

  for (const task of cognition.tasks) {
    if (task.type === "GENERATE_OPTIONS" && task.target) {
      const quantity = task.quantity ?? 1;
      const request = [
        `Genera ${quantity} opciones con ${task.target}.`,
        task.requirements.length ? `Requisitos obligatorios: ${task.requirements.join("; ")}.` : "",
        task.exclusions.length ? `No incluyas: ${task.exclusions.join(", ")}.` : "",
      ].filter(Boolean).join(" ");
      const taskCognition: Aida2TurnCognition = {
        ...cognition,
        dialogueAct: "REQUEST_RECIPE",
        foodTarget: task.target,
        requestedCount: quantity,
        constraints: [...task.requirements, ...task.exclusions.map(item => `sin ${item}`)],
        tasks: [task],
        responseContract: { ...cognition.responseContract, exactOptionCount: quantity },
      };
      const plan = await buildCulinaryPlan({
        openai,
        userMessage: request,
        interpretation: literalInterpretation(task.target),
        protocol,
        turnCognition: taskCognition,
        turnDirective: {
          dialogueAct: "REQUEST_RECIPE", explicitCurrentIntent: true,
          requiresHistory: false, contextPolicy: "CURRENT_TURN_ONLY",
          allowsCulinaryPlan: true, selectedOption: null,
          targetHint: task.target, reason: taskCognition.explicitCurrentGoal,
        },
      });
      primaryCulinaryPlan ??= plan;
      if (plan.recipes.length !== quantity) {
        violations.push(`${task.id}: se solicitaron ${quantity} opciones y se obtuvieron ${plan.recipes.length}.`);
      }
      for (const requirement of task.requirements) {
        const ingredient = requirement.match(/(?:con|incluya|contenga)\s+([\p{L}áéíóúñ ]+)$/iu)?.[1]?.trim();
        if (ingredient && !plan.recipes.some(recipe => recipe.ingredients.some(item => normalize(item.name).includes(normalize(ingredient))))) {
          violations.push(`${task.id}: ninguna opción cumplió el requisito “${requirement}”.`);
        }
      }
      sections.push(`Opciones con ${task.target}:\n${formatRecipeChoices(plan)}`);
      executions.push({ taskId: task.id, type: task.type, completed: plan.error === null, summary: `${plan.recipes.length} opciones verificadas.` });
      continue;
    }

    if (task.type === "VALIDATE_FOOD" && task.target) {
      const evaluation = evaluateFoodWithProtocol({
        protocol,
        userMessage: task.target,
        shouldBuildRecipes: false,
        semanticInterpretation: literalInterpretation(task.target),
      });
      const decisions = evaluation.decision.foods;
      const allowed = decisions.length > 0 && decisions.every(item => item.status === "ALLOWED" || item.status === "ALLOWED_WITH_VALIDATION");
      const reason = decisions.map(item => item.reason).filter(Boolean).join("; ");
      sections.push(`${task.target}: ${allowed ? "sí es compatible" : "no se recomienda"} en ${protocol.protocolName}. ${reason ? `La razón es que ${reason}.` : ""}`);
      executions.push({ taskId: task.id, type: task.type, completed: decisions.length > 0, summary: allowed ? "Compatible" : "No recomendado" });
      if (decisions.length === 0) violations.push(`${task.id}: no se obtuvo decisión del protocolo.`);
      continue;
    }

    if (task.type === "ADD_ACCOMPANIMENT") {
      const beverage = beverageForTask(task, protocol);
      if (beverage) {
        sections.push(`Bebida: puedes acompañar las opciones con ${beverage}.`);
        executions.push({ taskId: task.id, type: task.type, completed: true, summary: beverage });
      } else {
        violations.push(`${task.id}: no se encontró una bebida que respetara las exclusiones.`);
        executions.push({ taskId: task.id, type: task.type, completed: false, summary: "Sin bebida compatible" });
      }
      continue;
    }

    violations.push(`${task.id}: la capacidad ${task.type} aún no produjo resultado en el ejecutor múltiple.`);
    executions.push({ taskId: task.id, type: task.type, completed: false, summary: "No ejecutada" });
  }

  return {
    handled: true,
    valid: violations.length === 0,
    reply: violations.length === 0 ? sections.join("\n\n") : "",
    executions,
    primaryCulinaryPlan,
    violations,
  };
}
