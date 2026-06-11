// app/api/webhooks/mercadopago/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment as MercadoPagoPayment } from "mercadopago";
import { prisma } from "@/app/lib/prisma";
import { createOrRenewActivationCode } from "@/app/lib/aidaActivation";
import { isAidaPlanId } from "@/app/lib/aidaPlans";

export const runtime = "nodejs";

type MercadoPagoWebhookBody = {
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getPaymentIdFromUrl(request: Request) {
  const url = new URL(request.url);

  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("payment_id") ||
    ""
  );
}

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildDebugPayload({
  existingRawPayload,
  webhookBody,
  providerPaymentId,
  mpPayment,
  securityCheck,
}: {
  existingRawPayload: string | null;
  webhookBody: MercadoPagoWebhookBody | null;
  providerPaymentId: string;
  mpPayment: any;
  securityCheck?: Record<string, any>;
}) {
  return JSON.stringify({
    checkout: safeParseJson(existingRawPayload),
    webhook: {
      receivedAt: new Date().toISOString(),
      providerPaymentId,
      type: webhookBody?.type || null,
      action: webhookBody?.action || null,
      dataId: webhookBody?.data?.id ? String(webhookBody.data.id) : null,
    },
    mercadoPagoPayment: mpPayment,
    securityCheck: securityCheck || null,
  });
}

function validateApprovedMercadoPagoPayment({
  mpPayment,
  existingPayment,
  externalReference,
}: {
  mpPayment: any;
  existingPayment: any;
  externalReference: string;
}) {
  const status = getString(mpPayment.status);
  const currencyId = getString(mpPayment.currency_id);
  const transactionAmount = getNumber(mpPayment.transaction_amount);

  const expectedExternalReference = String(existingPayment.id);
  const expectedAmountPesos = Number(existingPayment.amount) / 100;

  const amountMatches =
    typeof transactionAmount === "number" &&
    Math.abs(transactionAmount - expectedAmountPesos) < 0.01;

  const checks = {
    status,
    statusOk: status === "approved",

    externalReference,
    expectedExternalReference,
    externalReferenceOk: externalReference === expectedExternalReference,

    currencyId,
    currencyOk: currencyId === "MXN",

    transactionAmount,
    expectedAmountPesos,
    amountOk: amountMatches,
  };

  const ok =
    checks.statusOk &&
    checks.externalReferenceOk &&
    checks.currencyOk &&
    checks.amountOk;

  return {
    ok,
    checks,
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      console.error("mercadopago webhook missing access token");
      return NextResponse.json({ ok: true });
    }

    let body: MercadoPagoWebhookBody | null = null;

    try {
      body = (await request.json()) as MercadoPagoWebhookBody;
    } catch {
      body = null;
    }

    const paymentIdFromBody = body?.data?.id ? String(body.data.id) : "";
    const paymentIdFromUrl = getPaymentIdFromUrl(request);
    const providerPaymentId = paymentIdFromBody || paymentIdFromUrl;

    if (!providerPaymentId) {
      return NextResponse.json({ ok: true, ignored: "missing_payment_id" });
    }

    const client = new MercadoPagoConfig({
      accessToken,
    });

    const mpPaymentClient = new MercadoPagoPayment(client);
    const mpPayment = await mpPaymentClient.get({
      id: providerPaymentId,
    });

    const externalReference = getString(mpPayment.external_reference);
    const status = getString(mpPayment.status);

    if (!externalReference) {
      return NextResponse.json({
        ok: true,
        ignored: "missing_external_reference",
        providerPaymentId,
        status,
      });
    }

    const localPaymentId = Number(externalReference);

    if (!Number.isInteger(localPaymentId)) {
      return NextResponse.json({
        ok: true,
        ignored: "invalid_external_reference",
        externalReference,
      });
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id: localPaymentId },
    });

    if (!existingPayment) {
      return NextResponse.json({
        ok: true,
        ignored: "local_payment_not_found",
        localPaymentId,
      });
    }

    const baseRawPayload = buildDebugPayload({
      existingRawPayload: existingPayment.rawPayload,
      webhookBody: body,
      providerPaymentId: String(providerPaymentId),
      mpPayment,
    });

    if (existingPayment.status === "approved" && existingPayment.activationCodeId) {
      return NextResponse.json({
        ok: true,
        alreadyProcessed: true,
        paymentId: existingPayment.id,
        activationCodeId: existingPayment.activationCodeId,
      });
    }

    if (status !== "approved") {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          providerPaymentId: String(providerPaymentId),
          status: status || "pending",
          rawPayload: baseRawPayload,
        },
      });

      return NextResponse.json({
        ok: true,
        paymentId: existingPayment.id,
        status,
      });
    }

    const securityValidation = validateApprovedMercadoPagoPayment({
      mpPayment,
      existingPayment,
      externalReference,
    });

    const rawPayload = buildDebugPayload({
      existingRawPayload: existingPayment.rawPayload,
      webhookBody: body,
      providerPaymentId: String(providerPaymentId),
      mpPayment,
      securityCheck: securityValidation.checks,
    });

    if (!securityValidation.ok) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          providerPaymentId: String(providerPaymentId),
          status: "security_mismatch",
          rawPayload,
        },
      });

      console.error("mercadopago webhook security mismatch", {
        paymentId: existingPayment.id,
        providerPaymentId,
        checks: securityValidation.checks,
      });

      return NextResponse.json({
        ok: true,
        ignored: "security_mismatch",
        paymentId: existingPayment.id,
      });
    }

    if (!isAidaPlanId(existingPayment.plan)) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          providerPaymentId: String(providerPaymentId),
          status: "approved",
          rawPayload,
          approvedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: false,
        error: "invalid_local_plan",
        paymentId: existingPayment.id,
      });
    }

    const activationCode = await createOrRenewActivationCode({
      phone: existingPayment.phoneE164,
      planId: existingPayment.plan,
      paymentId: existingPayment.id,
      deviceId: existingPayment.deviceId,
    });

    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        providerPaymentId: String(providerPaymentId),
        status: "approved",
        rawPayload,
        approvedAt: new Date(),
        activationCodeId: activationCode.id,
      },
    });

    return NextResponse.json({
      ok: true,
      paymentId: existingPayment.id,
      status: "approved",
      activationCodeId: activationCode.id,
    });
  } catch (error) {
    console.error("mercadopago webhook error", error);

    return NextResponse.json(
      {
        ok: false,
        error: "webhook_error",
      },
      { status: 500 }
    );
  }
}