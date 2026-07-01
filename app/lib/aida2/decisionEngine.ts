// app/lib/aida2/decisionEngine.ts

import type {
    Aida2Intent,
    Aida2Module,
    Aida2SafetyPlan,
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
  
  function buildExecutionReason(workPlan: Aida2WorkPlan) {
    if (workPlan.safety.requiresImmediateSafetyFocus) {
      return "El WorkPlan requiere prioridad de seguridad, por eso se ejecuta Semáforo antes que otros módulos clínicos.";
    }
  
    if (workPlan.thinking.mainAction === "ASK_MINIMUM_MISSING_DATA") {
      return "El WorkPlan detectó información faltante. Se evita consultar módulos innecesarios hasta obtener el dato mínimo.";
    }
  
    if (workPlan.thinking.mainAction === "RESUME_FOLLOW_UP") {
      return "El WorkPlan indica continuidad. Se prioriza contexto y seguimiento.";
    }
  
    if (workPlan.thinking.mainAction === "SUGGEST_PROFILE_UPDATE") {
      return "El WorkPlan detectó una observación relevante que podría requerir actualización de Perfil.";
    }
  
    return "El WorkPlan contiene información suficiente para ejecutar los módulos necesarios según la intención y el objetivo clínico.";
  }
  
  export function buildAida2ExecutionPlan(
    workPlan: Aida2WorkPlan
  ): Aida2ExecutionPlan {
    const modulesToRun = getModulesToRun(
      workPlan.understanding.intent,
      workPlan.safety
    );
  
    return {
      modulesToRun,
      shouldUseHistory: true,
      shouldUsePersistentContext:
        workPlan.understanding.intent === "FOLLOW_UP_CONTEXT" ||
        workPlan.understanding.intent === "GLUCOSE_REVIEW" ||
        workPlan.understanding.intent === "FOOD_ADVICE",
      shouldUseProfile: modulesToRun.includes("PROFILE"),
      shouldUseProtocol: modulesToRun.includes("PROTOCOL"),
      shouldUseGlucose: modulesToRun.includes("GLUCOSE"),
      shouldUseNutrition: modulesToRun.includes("NUTRITION"),
      shouldUseMedication: modulesToRun.includes("MEDICATION"),
      shouldUseSemaphore: modulesToRun.includes("SEMAPHORE"),
      executionReason: buildExecutionReason(workPlan),
    };
  }