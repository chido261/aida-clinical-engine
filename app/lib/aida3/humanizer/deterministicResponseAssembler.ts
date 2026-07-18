import type { Aida3ExpertResult, Aida3TurnOutcome } from "../core/contracts";
import type { ComposedTurnResponse } from "./contracts";

type FoodDecision = { food?: string; canonicalFood?: string; status?: string; reason?: string };
type Option = { name?: string; ingredients?: string[]; description?: string };
type Instructions = { title?: string; steps?: string[] };

function foodText(food: FoodDecision) {
  const name = food.food ?? food.canonicalFood ?? "El alimento";
  const displayName = `${name.charAt(0).toLocaleUpperCase("es")}${name.slice(1)}`;
  if (food.status === "ALLOWED") return `${displayName} es compatible con tu fase actual.`;
  if (food.status === "NOT_ALLOWED") return `${displayName} no se recomienda en tu fase actual.`;
  if (food.status === "CONDITIONAL") return `${displayName} puede consumirse únicamente bajo las condiciones de tu protocolo.`;
  return `No tengo evidencia suficiente en tu protocolo para confirmar ${displayName}.`;
}

function optionLine(option: Option, index: number) {
  const ingredients = Array.isArray(option.ingredients) && option.ingredients.length ? `: ${option.ingredients.join(", ")}` : "";
  const description = option.description?.trim() ? `. ${option.description.trim()}` : "";
  return `${index + 1}. ${option.name ?? `Opción ${index + 1}`}${ingredients}${description}`;
}

function resultText(result: Aida3ExpertResult) {
  if (result.expertId === "NUTRITION" && Array.isArray(result.data.foods)) {
    return (result.data.foods as FoodDecision[]).map(foodText).join(" ");
  }
  if (result.expertId === "CHEF" && result.decision === "OPTIONS_GENERATED" && Array.isArray(result.data.options)) {
    return `Opciones:\n${(result.data.options as Option[]).map(optionLine).join("\n")}`;
  }
  if (result.expertId === "CHEF" && result.decision === "BEVERAGES_GENERATED" && Array.isArray(result.data.beverages)) {
    const beverages = result.data.beverages as Option[];
    const label = beverages.length === 1 ? "Bebida" : "Bebidas";
    return `${label}:\n${beverages.map(optionLine).join("\n")}`;
  }
  if (result.expertId === "CHEF" && result.decision === "RECIPE_EXPLAINED") {
    const instructions = result.data.instructions as Instructions | undefined;
    if (instructions?.steps?.length) return `${instructions.title ?? result.patientSummary ?? "Receta"}:\n${instructions.steps
      .map((step, index) => `${index + 1}. ${step}`).join("\n")}`;
  }
  return result.patientSummary?.trim() ?? "";
}

function clarification(outcome: Aida3TurnOutcome): ComposedTurnResponse {
  const results = outcome.bundle.results.filter(result => result.status === "NEEDS_USER_INPUT");
  const text = results.map(result => result.patientSummary).filter((value): value is string => Boolean(value)).join("\n");
  return { text: text || "Necesito un dato adicional para completar tu solicitud.", source: "CLARIFICATION",
    coveredTaskIds: results.map(result => result.taskId) };
}

export class Aida3DeterministicResponseAssembler {
  compose(outcome: Aida3TurnOutcome): ComposedTurnResponse {
    if (outcome.status === "NEEDS_USER_INPUT") return clarification(outcome);
    if (outcome.status === "EXECUTION_FAILED") return { text: "No pude completar correctamente toda tu solicitud.",
      source: "FAILURE", coveredTaskIds: [] };
    const completed = outcome.bundle.results.filter(result => result.status === "COMPLETED");
    const parts = completed.map(result => ({ taskId: result.taskId, text: resultText(result) }));
    if (parts.some(part => !part.text)) throw new Error(`AIDA3_ASSEMBLER_UNSUPPORTED_RESULT:${parts.find(part => !part.text)?.taskId}`);
    return { text: parts.map(part => part.text).join("\n\n"), source: "ASSEMBLER",
      coveredTaskIds: parts.map(part => part.taskId) };
  }
}
