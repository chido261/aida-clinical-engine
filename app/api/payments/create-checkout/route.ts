// app/api/payments/create-checkout/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { prisma } from "@/app/lib/prisma";
import { getAidaPlan } from "@/app/lib/aidaPlans";
import { normalizePhoneE164 } from "@/app/lib/aidaActivation";

export const runtime = "nodejs";

type CreateCheckoutBody = {
  plan?: unknown;
  phone?: unknown;
  deviceId?: unknown;
  name?: unknown;
};

function getBaseUrl() {
  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  return baseUrl.replace(/\/$/, "");
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "mercadopago_access_token_missing",
          message: "Falta MERCADOPAGO_ACCESS_TOKEN en variables de entorno.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as CreateCheckoutBody;

    const plan = getAidaPlan(body.plan);
    const phone = getString(body.phone);
    const deviceId = getString(body.deviceId);
    const name = getString(body.name);

    if (!plan) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_plan",
          message: "Plan inválido.",
        },
        { status: 400 }
      );
    }

    const phoneE164 = normalizePhoneE164(phone);

    if (!phoneE164) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_phone",
          message: "Teléfono inválido.",
        },
        { status: 400 }
      );
    }

    if (!deviceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "device_id_required",
          message: "Falta deviceId.",
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    const payment = await prisma.payment.create({
      data: {
        provider: "mercadopago",
        status: "created",
        amount: plan.priceMxCents,
        currency: "MXN",
        plan: plan.id,
        durationDays: plan.durationDays,
        phoneE164,
        deviceId,
      },
    });

    const client = new MercadoPagoConfig({
      accessToken,
    });

    const preference = new Preference(client);

    const mpPreference = await preference.create({
      body: {
        external_reference: String(payment.id),
        metadata: {
          paymentId: payment.id,
          plan: plan.id,
          phoneE164,
          deviceId,
          name,
        },
        items: [
          {
            id: plan.id,
            title: `AIDA - ${plan.name}`,
            description: plan.description,
            quantity: 1,
            currency_id: "MXN",
            unit_price: plan.priceMxPesos,
          },
        ],
        payer: {
          name: name || undefined,
        },
        back_urls: {
          success: `${baseUrl}/pago/activar?payment=${payment.id}`,
          failure: `${baseUrl}/pago?status=failure`,
          pending: `${baseUrl}/pago?status=pending`,
        },
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: mpPreference.id ? String(mpPreference.id) : null,
        status: "pending",
      },
    });

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
      sandboxInitPoint: mpPreference.sandbox_init_point,
    });
  } catch (error) {
    console.error("create-checkout error", error);

    return NextResponse.json(
      {
        ok: false,
        error: "checkout_error",
        message: "No se pudo crear el checkout.",
      },
      { status: 500 }
    );
  }
}