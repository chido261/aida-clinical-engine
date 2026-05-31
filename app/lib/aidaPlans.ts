// app/lib/aidaPlans.ts

export type AidaPlanId = "mensual" | "3-meses" | "anual";

export type AidaPlan = {
  id: AidaPlanId;
  name: string;
  label: string;
  priceMxCents: number;
  priceMxPesos: number;
  durationDays: number;
  description: string;
};

export const AIDA_PLANS: Record<AidaPlanId, AidaPlan> = {
  mensual: {
    id: "mensual",
    name: "Plan mensual",
    label: "Mensual",
    priceMxCents: 50000,
    priceMxPesos: 500,
    durationDays: 30,
    description: "Acceso completo a AIDA durante 30 días.",
  },
  "3-meses": {
    id: "3-meses",
    name: "Plan 3 meses",
    label: "3 meses",
    priceMxCents: 150000,
    priceMxPesos: 1500,
    durationDays: 90,
    description: "Acceso completo a AIDA durante 90 días.",
  },
  anual: {
    id: "anual",
    name: "Plan anual",
    label: "Anual",
    priceMxCents: 300000,
    priceMxPesos: 3000,
    durationDays: 365,
    description: "Acceso completo a AIDA durante 365 días.",
  },
};

export function isAidaPlanId(value: unknown): value is AidaPlanId {
  return value === "mensual" || value === "3-meses" || value === "anual";
}

export function getAidaPlan(planId: unknown): AidaPlan | null {
  if (!isAidaPlanId(planId)) return null;
  return AIDA_PLANS[planId];
}

export function addPlanDays(date: Date, durationDays: number) {
  return new Date(date.getTime() + durationDays * 24 * 60 * 60 * 1000);
}