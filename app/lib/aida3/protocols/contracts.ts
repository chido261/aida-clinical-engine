export type ProtocolId = "DIAGNOSTICO_7_DIAS" | "FASE_1" | "FASE_2";
export type ProtocolPhase = "DIAGNOSTICO" | "FASE_1" | "FASE_2";
export type ProtocolReadingSlot = "AYUNO" | "POST_DESAYUNO" | "PRE_COMIDA" | "POST_COMIDA" | "PRE_CENA" | "POST_CENA";

export type OperationalProtocolConfig = {
  version: string;
  phase: ProtocolPhase;
  durationDays: number | null;
  expiresWhenComplete: boolean;
  readings: {
    timezone: string;
    postMealMinutes: number;
    slots: ProtocolReadingSlot[];
    fastingTarget: { min: number; max: number };
    otherSafeRange: { min: number; max: number };
    otherIdealRange: { min: number; max: number };
    hypoglycemiaBelow: number;
    severeHypoglycemiaBelow: number;
  };
  weeklyReview: {
    enabled: boolean;
    weekStartsOn: "MONDAY";
    reviewDay: "SUNDAY";
    expectedReadings: number;
    minimumCompletionPercent: number;
    minimumControlledPercent: number;
    requiresNoHypoglycemia: boolean;
    consecutivePassingWeeksForAdvance?: number;
    requiresMedicationReductionPercent?: number;
  };
};

export type ProtocolFoodCatalog = {
  proteins: string[];
  dairy: string[];
  healthyFats: string[];
  vegetables: string[];
  legumes: string[];
  fruits: string[];
  beverages: string[];
  sweeteners: string[];
};

export type ProtocolPolicyCatalog = {
  base: string[];
  conditional: string[];
  restricted: string[];
};

export type ProtocolDocument = {
  id: ProtocolId;
  name: string;
  sourceFile: string;
  sections: Readonly<Record<string, string>>;
  operational: OperationalProtocolConfig;
  foods: ProtocolFoodCatalog;
  policies: ProtocolPolicyCatalog;
};
