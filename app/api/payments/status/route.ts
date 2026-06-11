// app/api/payments/status/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment as MercadoPagoPayment } from "mercadopago";
import { prisma } from "@/app/lib/prisma";
import { createOrRenewActivationCode } from "@/app/lib/aidaActivation";
import { isAidaPlanId } from "@/app/lib/aidaPlans";

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

function maskPhone(phoneE164: string | null) {
  if (!phoneE164) return null;

  const clean = phoneE164.replace(/\D/g, "");

  if (clean.length <= 4) {
    return phoneE164;
  }

  return `••••••${clean.slice(-4)}`;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildManualStatusPayload({
  existingRawPayload,
  providerPaymentId,
  mpStatus,
  mpPayment,
}: {
  existingRawPayload: string | null;
  providerPaymentId: string;
  mpStatus: string;
  mpPayment: any;
}) {
  return JSON.stringify({
    previous: safeParseJson(existingRawPayload),
    manualStatusCheck: {
      checkedAt: new Date().toISOString(),
      providerPaymentId,
      status: mpStatus,
    },
    mercadoPagoPayment: mpPayment,
  });
}

async function ensureActivationCodeForApprovedPayment(payment: any) {
  if (payment.activationCodeId) {
    return payment.activationCodeId;
  }

  if (!isAidaPlanId(payment.plan)) {
    return null;
  }

  const activationCode = await createOrRenewActivationCode({
    phone: payment.phoneE164,
    planId: payment.plan,
    paymentId: payment.id,
    deviceId: payment.deviceId,
  });

  return activationCode.id;
}

async function syncMercadoPagoStatus(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
  });

  if (!payment) return null;

  if (payment.provider !== "mercadopago") {
    return payment;
  }

  if (payment.status === "approved" && payment.activationCodeId) {
    return payment;
  }

  if (!payment.providerPaymentId) {
    return payment;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return payment;
  }

  try {
    const client = new MercadoPagoConfig({
      accessToken,
    });

    const mpPaymentClient = new MercadoPagoPayment(client);
    const mpPayment = await mpPaymentClient.get({
      id: payment.providerPaymentId,
    });

    const mpStatus = getString(mpPayment.status) || payment.status;

    const rawPayload = buildManualStatusPayload({
      existingRawPayload: payment.rawPayload,
      providerPaymentId: payment.providerPaymentId,
      mpStatus,
      mpPayment,
    });

    if (mpStatus !== "approved") {
      return await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: mpStatus,
          rawPayload,
        },
      });
    }

    const paymentWithRawPayload = {
      ...payment,
      rawPayload,
    };

    const activationCodeId =
      payment.activationCodeId ||
      (await ensureActivationCodeForApprovedPayment(paymentWithRawPayload));

    return await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "approved",
        rawPayload,
        approvedAt: payment.approvedAt ?? new Date(),
        activationCodeId,
      },
    });
  } catch (error) {
    console.error("syncMercadoPagoStatus error", error);
    return payment;
  }
}

function getPublicActivationMessage(status: string, activationAvailable: boolean) {
  if (status === "approved" && activationAvailable) {
    return "Tu pago fue aprobado. Tu código de activación estará disponible en la sección Mi cuenta.";
  }

  if (status === "approved") {
    return "Tu pago fue aprobado. Estamos preparando la activación de tu cuenta.";
  }

  if (status === "pending" || status === "in_process") {
    return "Tu pago está en proceso. Te avisaremos cuando Mercado Pago confirme la aprobación.";
  }

  if (status === "rejected") {
    return "Tu pago no fue aprobado. Puedes intentar nuevamente desde la sección de planes.";
  }

  return "Estamos revisando el estado de tu pago.";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const paymentIdRaw = url.searchParams.get("paymentId") ?? "";
    const paymentId = Number(paymentIdRaw);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return jsonERR(
        {
          ok: false,
          error: "paymentId inválido",
        },
        400
      );
    }

    const payment = await syncMercadoPagoStatus(paymentId);

    if (!payment) {
      return jsonERR(
        {
          ok: false,
          error: "Pago no encontrado",
        },
        404
      );
    }

    const activationAvailable = Boolean(payment.activationCodeId);
    const publicMessage = getPublicActivationMessage(
      payment.status,
      activationAvailable
    );

    return jsonOK({
      ok: true,
      payment: {
        id: payment.id,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        providerRef: payment.providerRef,
        status: payment.status,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        durationDays: payment.durationDays,
        phoneMasked: maskPhone(payment.phoneE164),
        approvedAt: payment.approvedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,

        activationAvailable,
        activationMessage: publicMessage,
      },
    });
  } catch (err: any) {
    console.error("API /api/payments/status ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}