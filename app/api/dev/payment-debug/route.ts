// app/api/dev/payment-debug/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isAuthorized(req: Request) {
  const adminKey = process.env.AIDA_ADMIN_KEY;

  if (!adminKey) {
    return false;
  }

  const headerKey = req.headers.get("x-aida-admin-key");

  return headerKey === adminKey;
}

function maskPhone(phoneE164: string | null) {
  if (!phoneE164) return null;

  const clean = phoneE164.replace(/\D/g, "");

  if (clean.length <= 4) {
    return phoneE164;
  }

  return `••••••${clean.slice(-4)}`;
}

function maskEmail(email: unknown) {
  if (typeof email !== "string") return null;

  const trimmed = email.trim();

  if (!trimmed || !trimmed.includes("@")) return null;

  const [localPart, domain] = trimmed.split("@");

  if (!localPart || !domain) return null;

  const visibleLocal =
    localPart.length <= 2
      ? `${localPart[0] || ""}•`
      : `${localPart.slice(0, 2)}•••`;

  return `${visibleLocal}@${domain}`;
}

function pickMercadoPagoPayment(rawPayload: any) {
  return (
    rawPayload?.mercadoPagoPayment ||
    rawPayload?.previous?.mercadoPagoPayment ||
    rawPayload?.previous?.previous?.mercadoPagoPayment ||
    rawPayload?.checkout?.mercadoPagoPayment ||
    null
  );
}

function pickMercadoPagoSummary(rawPayload: any) {
  const mpPayment = pickMercadoPagoPayment(rawPayload);

  if (!mpPayment) return null;

  return {
    id: mpPayment.id ?? null,
    status: mpPayment.status ?? null,
    status_detail: mpPayment.status_detail ?? null,
    payment_method_id: mpPayment.payment_method_id ?? null,
    payment_type_id: mpPayment.payment_type_id ?? null,
    payer_email_masked: maskEmail(mpPayment.payer?.email),
    collector_id: mpPayment.collector_id ?? null,
    operation_type: mpPayment.operation_type ?? null,
    live_mode: mpPayment.live_mode ?? null,
    date_created: mpPayment.date_created ?? null,
    date_approved: mpPayment.date_approved ?? null,
    transaction_amount: mpPayment.transaction_amount ?? null,
    currency_id: mpPayment.currency_id ?? null,
    installments: mpPayment.installments ?? null,
    external_reference: mpPayment.external_reference ?? null,
  };
}

function pickSecurityCheck(rawPayload: any) {
  return (
    rawPayload?.securityCheck ||
    rawPayload?.previous?.securityCheck ||
    rawPayload?.previous?.previous?.securityCheck ||
    null
  );
}

function pickCheckoutSummary(rawPayload: any) {
  const checkout =
    rawPayload?.checkout ||
    rawPayload?.previous?.checkout ||
    rawPayload?.previous?.previous?.checkout ||
    rawPayload?.previous ||
    null;

  if (!checkout || typeof checkout !== "object") return null;

  return {
    kind: checkout.kind ?? null,
    plan: checkout.plan ?? null,
    targetPlan: checkout.targetPlan ?? null,
    upgrade: checkout.upgrade ?? null,
    currentPlan: checkout.currentPlan ?? null,
    creditCents: checkout.creditCents ?? null,
    amountCents: checkout.amountCents ?? null,
    normalDurationDays: checkout.normalDurationDays ?? null,
    createdAt: checkout.createdAt ?? null,
    mercadoPago: checkout.mercadoPago
      ? {
          accessTokenMode: checkout.mercadoPago.accessTokenMode ?? null,
          baseUrl: checkout.mercadoPago.baseUrl ?? null,
          notificationUrl: checkout.mercadoPago.notificationUrl ?? null,
          preferenceId: checkout.mercadoPago.preferenceId ?? null,
          hasInitPoint: checkout.mercadoPago.hasInitPoint ?? null,
          hasSandboxInitPoint: checkout.mercadoPago.hasSandboxInitPoint ?? null,
        }
      : null,
  };
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const paymentIdRaw = url.searchParams.get("paymentId") ?? "";
    const paymentId = Number(paymentIdRaw);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "paymentId inválido",
        },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pago no encontrado",
        },
        { status: 404 }
      );
    }

    const parsedRawPayload = safeParseJson(payment.rawPayload);

    return NextResponse.json({
      ok: true,
      localPayment: {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        providerPaymentId: payment.providerPaymentId,
        providerRef: payment.providerRef,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        durationDays: payment.durationDays,
        phoneMasked: maskPhone(payment.phoneE164),
        hasDeviceId: Boolean(payment.deviceId),
        approvedAt: payment.approvedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        activationAvailable: Boolean(payment.activationCodeId),
      },
      checkoutSummary: pickCheckoutSummary(parsedRawPayload),
      mercadoPagoSummary: pickMercadoPagoSummary(parsedRawPayload),
      securityCheck: pickSecurityCheck(parsedRawPayload),
    });
  } catch (error: any) {
    console.error("payment-debug error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error desconocido",
      },
      { status: 500 }
    );
  }
}