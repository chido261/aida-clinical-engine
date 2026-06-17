// app/lib/aida/protocolEngine.ts

export type AidaProtocolId = "PROTOCOL_1" | "PROTOCOL_2" | "MAINTENANCE";
export type AidaPhaseId = "FASE_1" | "FASE_2" | "MANTENIMIENTO";

export type ProtocolEligibilityDecision = {
  activeProtocol: AidaProtocolId;
  activePhase: AidaPhaseId;
  eligibleForNextProtocol: boolean;
  nextProtocol: AidaProtocolId | null;
  reviewReason: string;
};

export function normalizeProtocol(value?: string | null): AidaProtocolId {
  if (value === "PROTOCOL_2") return "PROTOCOL_2";
  if (value === "MAINTENANCE") return "MAINTENANCE";
  return "PROTOCOL_1";
}

export function normalizePhase(value?: string | null): AidaPhaseId {
  if (value === "FASE_2") return "FASE_2";
  if (value === "MANTENIMIENTO") return "MANTENIMIENTO";
  return "FASE_1";
}

export function decideProtocolEligibility(params: {
  activeProtocol?: string | null;
  activePhase?: string | null;
  stableDaysCount?: number | null;
  postMealInRangeCount?: number | null;
  fastingInRangeCount?: number | null;
  hypoEventsCount?: number | null;
  highEventsCount?: number | null;
}): ProtocolEligibilityDecision {
  const activeProtocol = normalizeProtocol(params.activeProtocol);
  const activePhase = normalizePhase(params.activePhase);

  const stableDaysCount = params.stableDaysCount ?? 0;
  const postMealInRangeCount = params.postMealInRangeCount ?? 0;
  const fastingInRangeCount = params.fastingInRangeCount ?? 0;
  const hypoEventsCount = params.hypoEventsCount ?? 0;
  const highEventsCount = params.highEventsCount ?? 0;

  if (activeProtocol === "MAINTENANCE") {
    return {
      activeProtocol,
      activePhase,
      eligibleForNextProtocol: false,
      nextProtocol: null,
      reviewReason: "El usuario ya está en mantenimiento.",
    };
  }

  if (hypoEventsCount > 0) {
    return {
      activeProtocol,
      activePhase,
      eligibleForNextProtocol: false,
      nextProtocol: null,
      reviewReason:
        "No conviene avanzar de protocolo mientras existan eventos recientes de hipoglucemia.",
    };
  }

  if (highEventsCount >= 2) {
    return {
      activeProtocol,
      activePhase,
      eligibleForNextProtocol: false,
      nextProtocol: null,
      reviewReason:
        "No conviene avanzar todavía porque hay elevaciones recientes que requieren estabilidad.",
    };
  }

  if (
    activeProtocol === "PROTOCOL_1" &&
    stableDaysCount >= 7 &&
    postMealInRangeCount >= 5 &&
    fastingInRangeCount >= 5
  ) {
    return {
      activeProtocol,
      activePhase,
      eligibleForNextProtocol: true,
      nextProtocol: "PROTOCOL_2",
      reviewReason:
        "El usuario muestra estabilidad suficiente para valorar avance a Protocolo 2.",
    };
  }

  if (
    activeProtocol === "PROTOCOL_2" &&
    stableDaysCount >= 14 &&
    postMealInRangeCount >= 10 &&
    fastingInRangeCount >= 10
  ) {
    return {
      activeProtocol,
      activePhase,
      eligibleForNextProtocol: true,
      nextProtocol: "MAINTENANCE",
      reviewReason:
        "El usuario muestra estabilidad suficiente para valorar mantenimiento.",
    };
  }

  return {
    activeProtocol,
    activePhase,
    eligibleForNextProtocol: false,
    nextProtocol: null,
    reviewReason:
      "El usuario aún necesita más lecturas estables antes de avanzar de protocolo.",
  };
}

export function getNutritionGoalFromGlucose(params: {
  glucose: number | null;
  moment: string;
}) {
  const { glucose, moment } = params;

  if (glucose === null) return "NONE";

  if (glucose < 70) return "RAISE_GLUCOSE";

  if (moment === "POSTCOMIDA" && glucose >= 141) return "LOWER_GLUCOSE";

  if (moment === "AYUNO" && glucose >= 126) return "LOWER_GLUCOSE";

  if (glucose >= 70 && glucose < 90) return "STABILIZE";

  return "MAINTAIN_GLUCOSE";
}