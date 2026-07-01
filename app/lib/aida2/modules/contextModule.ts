// app/lib/aida2/modules/contextModule.ts

import type { Aida2WorkPlan } from "@/app/lib/aida2/brain";
import type { Aida2ExecutionPlan } from "@/app/lib/aida2/decisionEngine";

export type Aida2ContextModuleInput = {
  workPlan: Aida2WorkPlan;
  executionPlan: Aida2ExecutionPlan;
  history: string;
  userMessage: string;
};

export type Aida2ContextModuleOutput = {
  module: "CONTEXT";
  shouldUseHistory: boolean;
  hasHistory: boolean;
  relevantContext: string | null;
  summary: string;
  notes: string[];
};

function cleanHistory(history: string) {
  return history.trim();
}

function limitText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function runContextModule(
  input: Aida2ContextModuleInput
): Aida2ContextModuleOutput {
  const history = cleanHistory(input.history);
  const shouldUseHistory = input.executionPlan.shouldUseHistory;
  const asksForPreviousContext =
    input.workPlan.understanding.asksForPreviousContext;

  if (!shouldUseHistory || !history) {
    return {
      module: "CONTEXT",
      shouldUseHistory,
      hasHistory: false,
      relevantContext: null,
      summary: "No hay historial útil para esta respuesta.",
      notes: [
        "Responder principalmente al mensaje actual.",
        "No inventar contexto previo.",
      ],
    };
  }

  const relevantContext = limitText(history, 1800);

  return {
    module: "CONTEXT",
    shouldUseHistory,
    hasHistory: true,
    relevantContext,
    summary: asksForPreviousContext
      ? "El usuario pide continuidad. Usar el historial para retomar el tema anterior."
      : "Hay historial disponible. Usarlo solo si mejora la continuidad de la respuesta.",
    notes: [
      "Usar el historial como apoyo, no como tema principal.",
      "No mencionar que se consultó un módulo interno.",
      "No inventar información que no esté en el historial.",
    ],
  };
}