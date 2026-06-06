// app/api/payments/create-checkout/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { prisma } from "@/app/lib/prisma";
import { getAidaPlan } from "@/app/lib/aidaPlans";
import { normalizePhoneE164 } from "@/app/lib/aidaActivation";
import { ensureUserState } from "@/app/lib/aidaMemory";

export const runtime = "nodejs";

type CreateCheckoutBody = {
  plan?: unknown;
  phone?: unknown;
  deviceId?: unknown;
  name?: unknown;
  upgrade?: unknown;
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

function getBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function normalizeActivePlan(value: unknown) {
  const plan = String(value || "").toLowerCase().trim();

  if (plan === "mensual") return "mensual";
  if (plan === "3-meses") return "3-meses";
  if (plan === "trimestral") return "3-meses";
  if (plan === "anual") return "anual";

  return null;
}

function getPlanCreditCents(currentPlan: string | null) {
  if (currentPlan === "mensual") return 50000;
  if (currentPlan === "3-meses") return 150000;
  return 0;
}

function getCheckoutPricing({
  targetPlan,
  userState,
  isUpgrade,
}: {
  targetPlan: NonNullable<ReturnType<typeof getAidaPlan>>;
  userState: any;
  isUpgrade: boolean;
}) {
  if (!isUpgrade) {
    return {
      amountCents: targetPlan.priceMxCents,
      amountPesos: targetPlan.priceMxPesos,
      title: `AIDA - ${targetPlan.name}`,
      description: targetPlan.description,
      currentPlan: null as string | null,
      creditCents: 0,
    };
  }

  const licenseStatus = String(userState?.licenseStatus || "").toLowerCase();
  const currentPlan = normalizeActivePlan(userState?.activePlan);

  if (licenseStatus !== "active") {
    throw new Error("upgrade_requires_active_account");
  }

  if (currentPlan === "mensual") {
    if (targetPlan.id !== "3-meses" && targetPlan.id !== "anual") {
      throw new Error("invalid_upgrade_target");
    }
  } else if (currentPlan === "3-meses") {
    if (targetPlan.id !== "anual") {
      throw new Error("invalid_upgrade_target");
    }
  } else {
    throw new Error("upgrade_not_available");
  }

  const creditCents = getPlanCreditCents(currentPlan);
  const amountCents = Math.max(0, targetPlan.priceMxCents - creditCents);
  const amountPesos = amountCents / 100;

  return {
    amountCents,
    amountPesos,
    title: `AIDA - Extensión a ${targetPlan.label}`,
    description: `Extensión de cuenta. Precio del paquete: $${targetPlan.priceMxPesos} MXN. Crédito de tu plan anterior: -$${creditCents / 100} MXN.`,
    currentPlan,
    creditCents,
  };
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
    const isUpgrade = getBoolean(body.upgrade);

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

    const userState = await ensureUserState(deviceId);

    let pricing;

    try {
      pricing = getCheckoutPricing({
        targetPlan: plan,
        userState,
        isUpgrade,
      });
    } catch (err: any) {
      const errorCode = err?.message || "upgrade_error";

      const message =
        errorCode === "upgrade_requires_active_account"
          ? "Para extender tu cuenta necesitas tener un plan activo."
          : errorCode === "invalid_upgrade_target"
            ? "Esta extensión no está disponible para tu plan actual."
            : "La extensión no está disponible para tu cuenta.";

      return NextResponse.json(
        {
          ok: false,
          error: errorCode,
          message,
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    const localCheckoutPayload = {
      kind: "aida_checkout",
      plan: plan.id,
      targetPlan: plan.id,
      phoneE164,
      deviceId,
      name,
      upgrade: isUpgrade,
      currentPlan: pricing.currentPlan,
      creditCents: pricing.creditCents,
      amountCents: pricing.amountCents,
      normalDurationDays: plan.durationDays,
      createdAt: new Date().toISOString(),
    };

    const payment = await prisma.payment.create({
      data: {
        provider: "mercadopago",
        status: "created",
        amount: pricing.amountCents,
        currency: "MXN",
        plan: plan.id,
        durationDays: plan.durationDays,
        phoneE164,
        deviceId,
        rawPayload: JSON.stringify(localCheckoutPayload),
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
          upgrade: isUpgrade,
          currentPlan: pricing.currentPlan,
          creditCents: pricing.creditCents,
          amountCents: pricing.amountCents,
        },
        items: [
          {
            id: plan.id,
            title: pricing.title,
            description: pricing.description,
            quantity: 1,
            currency_id: "MXN",
            unit_price: pricing.amountPesos,
          },
        ],
        payer: {
          name: name || undefined,
        },
        back_urls: {
          success: `${baseUrl}/pago/activar?paymentId=${payment.id}`,
          failure: `${baseUrl}/pago?status=failure`,
          pending: `${baseUrl}/pago?status=pending`,
        },
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      },
    });

    const updatedCheckoutPayload = {
      ...localCheckoutPayload,
      preferenceId: mpPreference.id ? String(mpPreference.id) : null,
    };

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: mpPreference.id ? String(mpPreference.id) : null,
        status: "pending",
        rawPayload: JSON.stringify(updatedCheckoutPayload),
      },
    });

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      preferenceId: mpPreference.id,
      initPoint: mpPreference.init_point,
      sandboxInitPoint: mpPreference.sandbox_init_point,
      amount: pricing.amountCents,
      amountPesos: pricing.amountPesos,
      plan: plan.id,
      upgrade: isUpgrade,
      currentPlan: pricing.currentPlan,
      creditCents: pricing.creditCents,
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