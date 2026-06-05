// app/api/user-status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureUserState, getTrialInfo, getWindowInfo } from "@/app/lib/aidaMemory";

const EDUCATIONAL_DISCLAIMER =
  "AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud. En caso de urgencias o síntomas severos: acude a atención médica.";

type Body = {
  deviceId?: string;
};

type UpgradeOffer = {
  eligible: boolean;
  title: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
  currentPlan: string | null;
  targetPlans: string[];
  discountPercent?: number | null;
  daysLeftToUseOffer?: number | null;
};

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDaysCeil(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function normalizeActivePlan(value: any) {
  const plan = String(value || "").toLowerCase().trim();

  if (plan === "mensual") return "mensual";
  if (plan === "3-meses") return "3-meses";
  if (plan === "trimestral") return "3-meses";
  if (plan === "anual") return "anual";

  return null;
}

function buildUpgradeOffer(userState: any): UpgradeOffer | null {
  const status = String(userState?.licenseStatus || "").toLowerCase();

  if (status !== "active") {
    return null;
  }

  const currentPlan = normalizeActivePlan(userState?.activePlan);
  const now = new Date();

  const fullStartedAt = userState?.fullStartedAt
    ? new Date(userState.fullStartedAt)
    : null;

  const fullEndsAt = userState?.fullEndsAt
    ? new Date(userState.fullEndsAt)
    : null;

  if (!currentPlan || !fullEndsAt) {
    return null;
  }

  if (currentPlan === "mensual") {
    if (!fullStartedAt) return null;

    const offerEndsAt = addDays(fullStartedAt, 5);
    const isEligible = now.getTime() <= offerEndsAt.getTime();

    if (!isEligible) return null;

    return {
      eligible: true,
      title: "Extiende tu cuenta y ahorra",
      message:
        "Puedes cambiar de mensual a trimestral o anual pagando solo la diferencia.",
      ctaText: "Ver opciones",
      ctaUrl: "/pago?upgrade=1",
      currentPlan,
      targetPlans: ["3-meses", "anual"],
      discountPercent: null,
      daysLeftToUseOffer: diffDaysCeil(now, offerEndsAt),
    };
  }

  if (currentPlan === "3-meses") {
    if (!fullStartedAt) return null;

    const offerEndsAt = addDays(fullStartedAt, 30);
    const isEligible = now.getTime() <= offerEndsAt.getTime();

    if (!isEligible) return null;

    return {
      eligible: true,
      title: "Extiende tu cuenta y ahorra",
      message:
        "Puedes cambiar de trimestral a anual pagando solo la diferencia.",
      ctaText: "Cambiar a anual",
      ctaUrl: "/pago?upgrade=1&target=anual",
      currentPlan,
      targetPlans: ["anual"],
      discountPercent: null,
      daysLeftToUseOffer: diffDaysCeil(now, offerEndsAt),
    };
  }

  if (currentPlan === "anual") {
    const daysRemaining = diffDaysCeil(now, fullEndsAt);

    if (daysRemaining > 30) {
      return null;
    }

    return {
      eligible: true,
      title: "Renueva tu plan anual con descuento",
      message:
        "Tu plan anual está por vencer. Puedes renovarlo con 30% de descuento.",
      ctaText: "Renovar anual",
      ctaUrl: "/pago?renew=anual&discount=30",
      currentPlan,
      targetPlans: ["anual"],
      discountPercent: 30,
      daysLeftToUseOffer: daysRemaining,
    };
  }

  return null;
}

function buildUserStatusUI(userState: any) {
  const status = (userState?.licenseStatus ?? "trial") as string;
  const upgradeOffer = buildUpgradeOffer(userState);

  if (status === "trial") {
    const info = getTrialInfo(userState);
    const daysRemaining = info.daysRemaining ?? null;

    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "TRIAL",
      modeLabel:
        daysRemaining != null
          ? `Prueba (${daysRemaining} día(s) restantes)`
          : "Prueba",
      daysLeft: daysRemaining,
      daysRemaining,
      blocked: false,
      ctaText: "Activar versión completa",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
      upgradeOffer: null,
    };
  }

  if (status === "expired") {
    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "EXPIRED",
      modeLabel: "Plan cancelado o prueba finalizada",
      daysLeft: 0,
      daysRemaining: 0,
      blocked: true,
      ctaText: "Activar versión completa",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
      upgradeOffer: null,
    };
  }

  if (status === "active") {
    const info = getWindowInfo(userState);
    const daysRemaining = info.daysRemaining ?? null;

    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "FULL",
      modeLabel:
        daysRemaining != null
          ? `Versión completa (${daysRemaining} día(s) restantes)`
          : "Versión completa",
      daysLeft: daysRemaining,
      daysRemaining,
      blocked: false,
      ctaText: null,
      ctaUrl: null,
      upgradeOffer,
    };
  }

  if (status === "maintenance") {
    const info = getWindowInfo(userState);
    const daysRemaining = info.daysRemaining ?? null;

    return {
      disclaimer: EDUCATIONAL_DISCLAIMER,
      mode: "MAINTENANCE",
      modeLabel:
        daysRemaining != null
          ? `Mantenimiento (${daysRemaining} día(s) restantes)`
          : "Mantenimiento",
      daysLeft: daysRemaining,
      daysRemaining,
      blocked: false,
      ctaText: "Administrar suscripción",
      ctaUrl: process.env.AIDA_BILLING_URL ?? "/pago",
      upgradeOffer: null,
    };
  }

  return {
    disclaimer: EDUCATIONAL_DISCLAIMER,
    mode: status.toUpperCase(),
    modeLabel: status,
    daysLeft: null,
    daysRemaining: null,
    blocked: false,
    ctaText: null,
    ctaUrl: null,
    upgradeOffer: null,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const deviceId = String(body.deviceId || "").trim();

    if (!deviceId) {
      return jsonERR(
        {
          ok: false,
          error: "Falta deviceId",
        },
        400
      );
    }

    const userState = await ensureUserState(deviceId);
    const ui = buildUserStatusUI(userState);

    return jsonOK({
      ok: true,
      ui,
      user: {
        name: userState?.name ?? null,
        phoneE164: userState?.phoneE164 ?? null,
      },
    });
  } catch (err: any) {
    console.error("API /api/user-status ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}