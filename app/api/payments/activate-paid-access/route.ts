// app/api/payments/activate-paid-access/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment as MercadoPagoPayment } from "mercadopago";
import { prisma } from "@/app/lib/prisma";
import {
  createOrRenewActivationCode,
  normalizePhoneE164,
} from "@/app/lib/aidaActivation";
import { addPlanDays, isAidaPlanId } from "@/app/lib/aidaPlans";

type Body = {
  paymentId?: unknown;
  deviceId?: unknown;
  forceTransfer?: unknown;
};

type CheckoutPayload = {
  upgrade?: unknown;
  currentPlan?: unknown;
  targetPlan?: unknown;
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

function getBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function normalizePlanId(value: unknown) {
  const plan = String(value || "").toLowerCase().trim();

  if (plan === "mensual") return "mensual";
  if (plan === "3-meses") return "3-meses";
  if (plan === "trimestral") return "3-meses";
  if (plan === "anual") return "anual";

  return null;
}

function readCheckoutPayload(payment: any): CheckoutPayload {
  try {
    if (!payment?.rawPayload) return {};
    const parsed = JSON.parse(payment.rawPayload);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getUpgradeExtraDays({
  currentPlan,
  targetPlan,
}: {
  currentPlan: string | null;
  targetPlan: string | null;
}) {
  if (currentPlan === "mensual" && targetPlan === "3-meses") return 60;
  if (currentPlan === "mensual" && targetPlan === "anual") return 335;
  if (currentPlan === "3-meses" && targetPlan === "anual") return 275;

  return null;
}

function mergeRawPayload(payment: any, mpPayment: any) {
  const localPayload = readCheckoutPayload(payment);

  return JSON.stringify({
    ...localPayload,
    mercadoPagoPayment: mpPayment,
  });
}

async function findApprovedMercadoPagoPaymentByExternalReference(
  accessToken: string,
  localPaymentId: number
) {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", String(localPaymentId));
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Mercado Pago search ERROR:", res.status, text);
    return null;
  }

  const data = await res.json().catch(() => null);
  const results = Array.isArray(data?.results) ? data.results : [];

  const approvedPayment =
    results.find((item: any) => getString(item?.status) === "approved") ??
    results[0] ??
    null;

  return approvedPayment;
}

async function createOrRenewActivationCodeForPayment(payment: any) {
  const payload = readCheckoutPayload(payment);

  const isUpgrade = getBoolean(payload.upgrade);
  const currentPlan = normalizePlanId(payload.currentPlan);
const targetPlan = normalizePlanId(payload.targetPlan || payment.plan);

if (isUpgrade && !targetPlan) {
  throw new Error("Plan destino inválido.");
}

if (isUpgrade) {
    const extraDays = getUpgradeExtraDays({
      currentPlan,
      targetPlan,
    });

    if (!extraDays) {
      throw new Error("Upgrade inválido o no disponible.");
    }

    const phoneE164 = normalizePhoneE164(payment.phoneE164);
    const now = new Date();

    const existingActiveCode = await prisma.activationCode.findFirst({
      where: {
        phoneE164,
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!existingActiveCode) {
      throw new Error("No se encontró una cuenta activa para extender.");
    }

    const userState = payment.deviceId
      ? await prisma.userState.findUnique({
          where: {
            id: payment.deviceId,
          },
        })
      : null;

    const baseDate =
      existingActiveCode.fullEndsAt &&
      existingActiveCode.fullEndsAt.getTime() > now.getTime()
        ? existingActiveCode.fullEndsAt
        : userState?.fullEndsAt && userState.fullEndsAt.getTime() > now.getTime()
          ? userState.fullEndsAt
          : now;

    const fullEndsAt = addPlanDays(baseDate, extraDays);

    const updatedCode = await prisma.activationCode.update({
      where: {
        id: existingActiveCode.id,
      },
      data: {
        plan: targetPlan!,
        fullStartedAt:
          existingActiveCode.fullStartedAt ?? userState?.fullStartedAt ?? now,
        fullEndsAt,
        lastPaymentId: payment.id,
        status: "active",
      },
    });

    if (payment.deviceId) {
      await prisma.userState.update({
        where: {
          id: payment.deviceId,
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
    }

    return updatedCode;
  }

  if (!isAidaPlanId(payment.plan)) {
    throw new Error("Plan inválido.");
  }

  return createOrRenewActivationCode({
    phone: payment.phoneE164,
    planId: payment.plan,
    paymentId: payment.id,
    deviceId: payment.deviceId,
  });
}

async function syncPaymentWithMercadoPago(payment: any) {
  if (payment.status === "approved" && payment.activationCodeId) {
    return payment;
  }

  if (payment.provider !== "mercadopago") {
    return payment;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return payment;
  }

  let mpPayment: any = null;

  if (payment.providerPaymentId) {
    const client = new MercadoPagoConfig({
      accessToken,
    });

    const mpPaymentClient = new MercadoPagoPayment(client);

    try {
      mpPayment = await mpPaymentClient.get({
        id: String(payment.providerPaymentId),
      });
    } catch (err) {
      console.error("Mercado Pago get by providerPaymentId ERROR:", err);
    }
  }

  if (!mpPayment) {
    mpPayment = await findApprovedMercadoPagoPaymentByExternalReference(
      accessToken,
      payment.id
    );
  }

  if (!mpPayment) {
    return payment;
  }

  const status = getString(mpPayment?.status) || payment.status || "pending";
  const providerPaymentId = mpPayment?.id ? String(mpPayment.id) : null;
  const rawPayload = mergeRawPayload(payment, mpPayment);

  if (status !== "approved") {
    return prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        providerPaymentId,
        status,
        rawPayload,
      },
    });
  }

  if (!isAidaPlanId(payment.plan)) {
    return prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        providerPaymentId,
        status: "approved",
        rawPayload,
        approvedAt: payment.approvedAt ?? new Date(),
      },
    });
  }

  const activationCode =
    payment.activationCodeId
      ? await prisma.activationCode.findUnique({
          where: {
            id: payment.activationCodeId,
          },
        })
      : await createOrRenewActivationCodeForPayment({
          ...payment,
          rawPayload,
        });

  return prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      providerPaymentId,
      status: "approved",
      rawPayload,
      approvedAt: payment.approvedAt ?? new Date(),
      activationCodeId: activationCode?.id ?? payment.activationCodeId,
    },
  });
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

    const existingPayment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!existingPayment) {
      return jsonERR(
        {
          ok: false,
          error: "payment_not_found",
          message: "Pago no encontrado.",
        },
        404
      );
    }

    const payment = await syncPaymentWithMercadoPago(existingPayment);

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