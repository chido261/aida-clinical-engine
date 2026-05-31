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

function getPaymentIdFromUrl(request: Request) {
  const url = new URL(request.url);

  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    url.searchParams.get("payment_id") ||
    ""
  );
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
    const rawPayload = JSON.stringify(mpPayment);

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
          rawPayload,
        },
      });

      return NextResponse.json({
        ok: true,
        paymentId: existingPayment.id,
        status,
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
      code: activationCode.code,
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