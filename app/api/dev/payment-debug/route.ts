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
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("adminKey");

  return headerKey === adminKey || queryKey === adminKey;
}

function pickMercadoPagoSummary(rawPayload: any) {
  const mpPayment =
    rawPayload?.mercadoPagoPayment ||
    rawPayload?.previous?.mercadoPagoPayment ||
    rawPayload?.previous?.previous?.mercadoPagoPayment ||
    rawPayload?.checkout?.mercadoPagoPayment ||
    null;

  if (!mpPayment) return null;

  return {
    id: mpPayment.id ?? null,
    status: mpPayment.status ?? null,
    status_detail: mpPayment.status_detail ?? null,
    payment_method_id: mpPayment.payment_method_id ?? null,
    payment_type_id: mpPayment.payment_type_id ?? null,
    payer_email: mpPayment.payer?.email ?? null,
    collector_id: mpPayment.collector_id ?? null,
    operation_type: mpPayment.operation_type ?? null,
    live_mode: mpPayment.live_mode ?? null,
    date_created: mpPayment.date_created ?? null,
    date_approved: mpPayment.date_approved ?? null,
    transaction_amount: mpPayment.transaction_amount ?? null,
    installments: mpPayment.installments ?? null,
    external_reference: mpPayment.external_reference ?? null,
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

    const activationCode = payment.activationCodeId
      ? await prisma.activationCode.findUnique({
          where: {
            id: payment.activationCodeId,
          },
        })
      : null;

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
        phoneE164: payment.phoneE164,
        deviceId: payment.deviceId,
        approvedAt: payment.approvedAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        activationCodeId: payment.activationCodeId,
        activationCode: activationCode?.code ?? null,
      },
      mercadoPagoSummary: pickMercadoPagoSummary(parsedRawPayload),
      rawPayload: parsedRawPayload,
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