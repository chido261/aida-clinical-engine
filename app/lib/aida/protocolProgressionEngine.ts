// app/lib/aida/protocolProgressionEngine.ts

export type ProtocolProgressionDecision = {
    canAdvance: boolean;
    currentProtocol: string;
    currentPhase: string;
    nextProtocol: string | null;
    nextPhase: string | null;
    stableDaysCount: number;
    fastingInRangeCount: number;
    postMealInRangeCount: number;
    hypoEventsCount: number;
    highEventsCount: number;
    reason: string;
  };
  
  type ReadingForProgression = {
    glucose: number;
    moment: string;
    createdAt: Date;
  };
  
  function getNextProtocol(currentProtocol: string) {
    if (currentProtocol === "PROTOCOL_1") {
      return { protocol: "PROTOCOL_2", phase: "FASE_2" };
    }
  
    if (currentProtocol === "PROTOCOL_2") {
      return { protocol: "MAINTENANCE", phase: "MANTENIMIENTO" };
    }
  
    return { protocol: null, phase: null };
  }
  
  function getDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
  
  function isFastingInRange(glucose: number) {
    return glucose >= 80 && glucose <= 125;
  }
  
  function isPostMealInRange(glucose: number) {
    return glucose >= 80 && glucose <= 140;
  }
  
  function isHighReading(reading: ReadingForProgression) {
    if (reading.moment === "POSTCOMIDA") return reading.glucose > 140;
    if (reading.moment === "AYUNO") return reading.glucose >= 126;
    return reading.glucose > 180;
  }
  
  export function evaluateProtocolProgression(params: {
    currentProtocol?: string | null;
    currentPhase?: string | null;
    readings: ReadingForProgression[];
  }): ProtocolProgressionDecision {
    const currentProtocol = params.currentProtocol || "PROTOCOL_1";
    const currentPhase = params.currentPhase || "FASE_1";
  
    const next = getNextProtocol(currentProtocol);
  
    if (!next.protocol || !next.phase) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: null,
        nextPhase: null,
        stableDaysCount: 0,
        fastingInRangeCount: 0,
        postMealInRangeCount: 0,
        hypoEventsCount: 0,
        highEventsCount: 0,
        reason: "El usuario ya se encuentra en mantenimiento.",
      };
    }
  
    const readings = params.readings;
  
    const fastingReadings = readings.filter((r) => r.moment === "AYUNO");
    const postMealReadings = readings.filter((r) => r.moment === "POSTCOMIDA");
  
    const fastingInRangeCount = fastingReadings.filter((r) =>
      isFastingInRange(r.glucose)
    ).length;
  
    const postMealInRangeCount = postMealReadings.filter((r) =>
      isPostMealInRange(r.glucose)
    ).length;
  
    const hypoEventsCount = readings.filter((r) => r.glucose < 70).length;
    const highEventsCount = readings.filter(isHighReading).length;
  
    const stableDayKeys = new Set<string>();
  
    for (const reading of readings) {
      const isStable =
        reading.glucose >= 80 &&
        reading.glucose <= 140 &&
        reading.moment !== "DESCONOCIDO";
  
      if (isStable) {
        stableDayKeys.add(getDateKey(reading.createdAt));
      }
    }
  
    const stableDaysCount = stableDayKeys.size;
  
    const minimumStableDays = currentProtocol === "PROTOCOL_1" ? 7 : 14;
    const minimumFastingInRange = currentProtocol === "PROTOCOL_1" ? 5 : 10;
    const minimumPostMealInRange = currentProtocol === "PROTOCOL_1" ? 5 : 10;
  
    if (hypoEventsCount > 0) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: next.protocol,
        nextPhase: next.phase,
        stableDaysCount,
        fastingInRangeCount,
        postMealInRangeCount,
        hypoEventsCount,
        highEventsCount,
        reason:
          "No conviene avanzar todavía porque existen eventos de glucosa baja recientes.",
      };
    }
  
    if (highEventsCount >= 2) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: next.protocol,
        nextPhase: next.phase,
        stableDaysCount,
        fastingInRangeCount,
        postMealInRangeCount,
        hypoEventsCount,
        highEventsCount,
        reason:
          "No conviene avanzar todavía porque hay elevaciones recientes de glucosa.",
      };
    }
  
    if (stableDaysCount < minimumStableDays) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: next.protocol,
        nextPhase: next.phase,
        stableDaysCount,
        fastingInRangeCount,
        postMealInRangeCount,
        hypoEventsCount,
        highEventsCount,
        reason: `Aún faltan días de estabilidad. Lleva ${stableDaysCount} de ${minimumStableDays} días requeridos.`,
      };
    }
  
    if (fastingInRangeCount < minimumFastingInRange) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: next.protocol,
        nextPhase: next.phase,
        stableDaysCount,
        fastingInRangeCount,
        postMealInRangeCount,
        hypoEventsCount,
        highEventsCount,
        reason: `Aún faltan lecturas en ayuno dentro de rango. Lleva ${fastingInRangeCount} de ${minimumFastingInRange}.`,
      };
    }
  
    if (postMealInRangeCount < minimumPostMealInRange) {
      return {
        canAdvance: false,
        currentProtocol,
        currentPhase,
        nextProtocol: next.protocol,
        nextPhase: next.phase,
        stableDaysCount,
        fastingInRangeCount,
        postMealInRangeCount,
        hypoEventsCount,
        highEventsCount,
        reason: `Aún faltan lecturas postcomida dentro de rango. Lleva ${postMealInRangeCount} de ${minimumPostMealInRange}.`,
      };
    }
  
    return {
      canAdvance: true,
      currentProtocol,
      currentPhase,
      nextProtocol: next.protocol,
      nextPhase: next.phase,
      stableDaysCount,
      fastingInRangeCount,
      postMealInRangeCount,
      hypoEventsCount,
      highEventsCount,
      reason:
        "El usuario muestra estabilidad suficiente para valorar avance al siguiente protocolo.",
    };
  }