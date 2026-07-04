// app/lib/aida2/decisionEngine.ts

import type {
  Aida2Module,
  Aida2WorkPlan,
} from "@/app/lib/aida2/brain";

export type Aida2ExecutionPlan = {
  modulesToRun: Aida2Module[];
  shouldUseHistory: boolean;
  shouldUsePersistentContext: boolean;
  shouldUseProfile: boolean;
  shouldUseProtocol: boolean;
  shouldUseGlucose: boolean;
  shouldUseNutrition: boolean;
  shouldUseMedication: boolean;
  shouldUseSemaphore: boolean;
  executionReason: string;
};

function buildExecutionReason(workPlan: Aida2WorkPlan) {
  if (workPlan.safety.requiresImmediateSafetyFocus) {
    return "Cerebro detectó prioridad de seguridad. Se ejecuta Semáforo antes que otros módulos clínicos.";
  }

  if (workPlan.thinking.mainAction === "ASK_MINIMUM_MISSING_DATA") {
    return "Cerebro detectó información faltante. Se evita avanzar con decisiones clínicas hasta obtener el dato mínimo.";
  }

  if (workPlan.thinking.mainAction === "RESUME_FOLLOW_UP") {
    return "Cerebro detectó continuidad. Se prioriza historial y seguimiento.";
  }

  if (workPlan.foodContext.isFoodRelated) {
    return `Cerebro detectó consulta alimentaria. Foco: ${workPlan.foodContext.decisionFocus}`;
  }

  if (workPlan.thinking.mainAction === "SUGGEST_PROFILE_UPDATE") {
    return "Cerebro detectó una observación relevante que podría requerir actualización de Perfil.";
  }

  return "Cerebro definió los módulos necesarios según intención, seguridad y objetivo clínico.";
}

export function buildAida2ExecutionPlan(
  workPlan: Aida2WorkPlan
): Aida2ExecutionPlan {
  const modulesToRun = workPlan.decision.modulesToRun;

  return {
    modulesToRun,
    shouldUseHistory: workPlan.decision.shouldUseHistory,
    shouldUsePersistentContext: workPlan.decision.shouldUsePersistentContext,
    shouldUseProfile: workPlan.decision.shouldUseProfile,
    shouldUseProtocol: workPlan.decision.shouldUseProtocol,
    shouldUseGlucose: workPlan.decision.shouldUseGlucose,
    shouldUseNutrition: workPlan.decision.shouldUseNutrition,
    shouldUseMedication: workPlan.decision.shouldUseMedication,
    shouldUseSemaphore: workPlan.decision.shouldUseSemaphore,
    executionReason: buildExecutionReason(workPlan),
  };
}