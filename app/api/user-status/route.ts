// app/api/user-status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureUserState, getTrialInfo, getWindowInfo } from "@/app/lib/aidaMemory";

const EDUCATIONAL_DISCLAIMER =
  "AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud. En caso de urgencias o síntomas severos: acude a atención médica.";

type Body = {
  deviceId?: string;
};

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function buildUserStatusUI(userState: any) {
  const status = (userState?.licenseStatus ?? "trial") as string;

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