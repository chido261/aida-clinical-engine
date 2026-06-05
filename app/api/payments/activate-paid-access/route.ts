// app/api/payments/activate-paid-access/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { normalizePhoneE164 } from "@/app/lib/aidaActivation";

type Body = {
  paymentId?: unknown;
  deviceId?: unknown;
  forceTransfer?: unknown;
};

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed)) return null;

  return parsed;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const paymentId = getNumber(body.paymentId);
    const deviceId = getString(body.deviceId);
    const forceTransfer = body.forceTransfer === true;

    if (!paymentId || paymentId <= 0) {
      return jsonERR(
        {
          ok: false,
          error: "invalid_payment_id",
          message: "paymentId inválido.",
        },
        400
      );
    }

    if (!deviceId) {
      return jsonERR(
        {
          ok: false,
          error: "device_id_required",
          message: "No se detectó el dispositivo.",
        },
        400
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      return jsonERR(
        {
          ok: false,
          error: "payment_not_found",
          message: "Pago no encontrado.",
        },
        404
      );
    }

    if (payment.status !== "approved") {
      return jsonERR(
        {
          ok: false,
          error: "payment_not_approved",
          message:
            "Tu pago todavía no aparece como aprobado. Espera unos segundos y vuelve a intentar.",
          paymentStatus: payment.status,
        },
        409
      );
    }

    if (!payment.activationCodeId) {
      return jsonERR(
        {
          ok: false,
          error: "activation_code_not_ready",
          message:
            "Tu pago fue aprobado, pero la clave aún se está generando. Espera unos segundos y vuelve a intentar.",
        },
        409
      );
    }

    const activationCode = await prisma.activationCode.findUnique({
      where: {
        id: payment.activationCodeId,
      },
    });

    if (!activationCode) {
      return jsonERR(
        {
          ok: false,
          error: "activation_code_not_found",
          message: "No se encontró la clave vinculada al pago.",
        },
        404
      );
    }

    if (activationCode.status !== "active") {
      return jsonERR(
        {
          ok: false,
          error: "activation_code_inactive",
          message: "La clave vinculada a este pago no está activa.",
        },
        409
      );
    }

    if (
      activationCode.fullEndsAt &&
      activationCode.fullEndsAt.getTime() <= Date.now()
    ) {
      return jsonERR(
        {
          ok: false,
          error: "activation_code_expired",
          message: "La clave vinculada a este pago ya venció.",
        },
        409
      );
    }

    if (
      activationCode.currentDeviceId &&
      activationCode.currentDeviceId !== deviceId &&
      !forceTransfer
    ) {
      return jsonERR(
        {
          ok: false,
          error: "device_transfer_required",
          message:
            "Esta clave ya está activa en otro dispositivo. Si continúas, el otro dispositivo dejará de tener acceso.",
        },
        409
      );
    }

    if (activationCode.currentDeviceId && activationCode.currentDeviceId !== deviceId) {
      await prisma.deviceSession.updateMany({
        where: {
          activationCodeId: activationCode.id,
          active: true,
        },
        data: {
          active: false,
          disabledAt: new Date(),
        },
      });
    }

    const phoneE164 = normalizePhoneE164(payment.phoneE164);

    const updatedCode = await prisma.activationCode.update({
      where: {
        id: activationCode.id,
      },
      data: {
        currentDeviceId: deviceId,
        activatedAt: activationCode.activatedAt ?? new Date(),
      },
    });

    await prisma.deviceSession.create({
      data: {
        phoneE164,
        deviceId,
        activationCodeId: updatedCode.id,
        active: true,
      },
    });

    await prisma.userState.update({
      where: {
        id: deviceId,
      },
      data: {
        phoneE164,
        phoneVerifiedAt: new Date(),
        licenseStatus: "active",
        fullStartedAt: updatedCode.fullStartedAt,
        fullEndsAt: updatedCode.fullEndsAt,
        activePlan: updatedCode.plan,
        activePlanSource: "payment",
      },
    });

    return jsonOK({
      ok: true,
      status: "activated",
      message: "Acceso activado automáticamente.",
      paymentId: payment.id,
      code: updatedCode.code,
      plan: updatedCode.plan,
      fullStartedAt: updatedCode.fullStartedAt,
      fullEndsAt: updatedCode.fullEndsAt,
    });
  } catch (err: any) {
    console.error("API /api/payments/activate-paid-access ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}