// app/api/account/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type AccountRequestBody = {
  deviceId?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function maskPhone(phoneE164: string | null) {
  if (!phoneE164) return null;

  const clean = phoneE164.replace(/\D/g, "");

  if (clean.length <= 4) {
    return phoneE164;
  }

  return `••••••${clean.slice(-4)}`;
}

function formatPlanLabel(plan: string | null) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  if (plan === "manual") return "Manual";
  return "Sin plan activo";
}

function formatLicenseStatus(status: string | null) {
  if (status === "active") return "Activa";
  if (status === "trial") return "Prueba";
  if (status === "expired") return "Expirada";
  if (status === "maintenance") return "Mantenimiento";
  return "Sin estado";
}

function getDaysRemaining(date: Date | null) {
  if (!date) return null;

  const now = Date.now();
  const target = date.getTime();
  const diffMs = target - now;

  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function canUseActivationCode(activationCode: any, deviceId: string) {
  if (!activationCode) return false;
  if (activationCode.status !== "active") return false;

  if (
    activationCode.currentDeviceId &&
    activationCode.currentDeviceId !== deviceId
  ) {
    return false;
  }

  return true;
}

async function findValidActivationCode({
  deviceId,
  phoneE164,
  latestApprovedPayment,
}: {
  deviceId: string;
  phoneE164: string | null;
  latestApprovedPayment: any;
}) {
  if (latestApprovedPayment?.activationCodeId) {
    const codeFromPayment = await prisma.activationCode.findUnique({
      where: {
        id: latestApprovedPayment.activationCodeId,
      },
    });

    if (canUseActivationCode(codeFromPayment, deviceId)) {
      return codeFromPayment;
    }
  }

  const activeSession = await prisma.deviceSession.findFirst({
    where: {
      deviceId,
      active: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (activeSession) {
    const codeFromSession = await prisma.activationCode.findUnique({
      where: {
        id: activeSession.activationCodeId,
      },
    });

    if (canUseActivationCode(codeFromSession, deviceId)) {
      return codeFromSession;
    }
  }

  if (phoneE164) {
    const codeFromPhone = await prisma.activationCode.findFirst({
      where: {
        phoneE164,
        status: "active",
        OR: [
          {
            currentDeviceId: deviceId,
          },
          {
            currentDeviceId: null,
          },
        ],
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (canUseActivationCode(codeFromPhone, deviceId)) {
      return codeFromPhone;
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AccountRequestBody;
    const deviceId = getString(body.deviceId);

    if (!deviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "deviceId_required",
          message: "Falta deviceId.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.userState.findUnique({
      where: {
        id: deviceId,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "account_not_found",
          message: "No encontramos una cuenta para este dispositivo.",
        },
        { status: 404 }
      );
    }

    const latestApprovedPayment = await prisma.payment.findFirst({
      where: {
        OR: [
          {
            deviceId,
          },
          user.phoneE164
            ? {
                phoneE164: user.phoneE164,
              }
            : undefined,
        ].filter(Boolean) as any,
        status: "approved",
      },
      orderBy: {
        approvedAt: "desc",
      },
    });

    const activationCode = await findValidActivationCode({
      deviceId,
      phoneE164: user.phoneE164,
      latestApprovedPayment,
    });

    const hasActiveLicense = user.licenseStatus === "active";
    const effectivePlan = hasActiveLicense
      ? user.activePlan || activationCode?.plan || null
      : null;

    const licenseEndsAt = hasActiveLicense
      ? user.fullEndsAt || activationCode?.fullEndsAt || null
      : user.licenseStatus === "trial"
        ? user.trialEndsAt
        : null;

    const fullStartedAt = hasActiveLicense
      ? user.fullStartedAt || activationCode?.fullStartedAt || null
      : null;

    const fullEndsAt = hasActiveLicense
      ? user.fullEndsAt || activationCode?.fullEndsAt || null
      : null;

    const daysRemaining = getDaysRemaining(licenseEndsAt);

    return NextResponse.json({
      ok: true,
      account: {
        id: user.id,
        name: user.name || null,
        phoneMasked: maskPhone(user.phoneE164),
        diagnosis: user.diagnosis || null,

        licenseStatus: user.licenseStatus,
        licenseStatusLabel: formatLicenseStatus(user.licenseStatus),
        activePlan: effectivePlan,
        activePlanLabel: formatPlanLabel(effectivePlan),
        activePlanSource: hasActiveLicense ? user.activePlanSource || null : null,

        trialStartedAt: user.trialStartedAt,
        trialEndsAt: user.trialEndsAt,
        fullStartedAt,
        fullEndsAt,
        daysRemaining,

        activation:
          hasActiveLicense && activationCode
            ? {
                available: true,
                code: activationCode.code,
                status: activationCode.status,
                plan: activationCode.plan,
                fullStartedAt: activationCode.fullStartedAt,
                fullEndsAt: activationCode.fullEndsAt,
                activatedAt: activationCode.activatedAt,
                currentDeviceMatches: activationCode.currentDeviceId
                  ? activationCode.currentDeviceId === deviceId
                  : null,
              }
            : {
                available: false,
                code: null,
                status: null,
                plan: null,
                fullStartedAt: null,
                fullEndsAt: null,
                activatedAt: null,
                currentDeviceMatches: null,
              },

        latestApprovedPayment:
          hasActiveLicense && latestApprovedPayment
            ? {
                id: latestApprovedPayment.id,
                plan: latestApprovedPayment.plan,
                amount: latestApprovedPayment.amount,
                currency: latestApprovedPayment.currency,
                durationDays: latestApprovedPayment.durationDays,
                approvedAt: latestApprovedPayment.approvedAt,
              }
            : null,

        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("API /api/account ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}