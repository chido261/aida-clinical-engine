// app/lib/aidaActivation.ts

import { prisma } from "@/app/lib/prisma";
import { addPlanDays, getAidaPlan, type AidaPlanId } from "@/app/lib/aidaPlans";

const CODE_PREFIX = "AIDA";
const CODE_RANDOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCodePart(length: number) {
  let result = "";

  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * CODE_RANDOM_CHARS.length);
    result += CODE_RANDOM_CHARS[index];
  }

  return result;
}

export function normalizePhoneE164(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) {
    return `+52${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return `+${digits}`;
  }

  if (digits.startsWith("521") && digits.length === 13) {
    return `+52${digits.slice(3)}`;
  }

  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function maskPhone(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, "");

  if (digits.length <= 4) return phoneE164;

  const last4 = digits.slice(-4);
  return `•••• ${last4}`;
}

export function generateActivationCodeCandidate() {
  return `${CODE_PREFIX}-${randomCodePart(4)}-${randomCodePart(4)}`;
}

export async function generateUniqueActivationCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateActivationCodeCandidate();

    const existing = await prisma.activationCode.findUnique({
      where: { code },
    });

    if (!existing) return code;
  }

  throw new Error("No se pudo generar una clave única de activación.");
}

function getLatestValidDate(dates: Array<Date | null | undefined>, fallback: Date) {
  const validDates = dates.filter(
    (date): date is Date => !!date && date.getTime() > fallback.getTime()
  );

  if (validDates.length === 0) return fallback;

  return validDates.reduce((latest, current) =>
    current.getTime() > latest.getTime() ? current : latest
  );
}

export async function createOrRenewActivationCode(params: {
  phone: string;
  planId: AidaPlanId;
  paymentId?: number | null;
}) {
  const { phone, planId, paymentId = null } = params;

  const phoneE164 = normalizePhoneE164(phone);
  const plan = getAidaPlan(planId);

  if (!phoneE164) {
    throw new Error("Celular inválido.");
  }

  if (!plan) {
    throw new Error("Plan inválido.");
  }

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

  if (existingActiveCode) {
    const currentUserState = existingActiveCode.currentDeviceId
      ? await prisma.userState.findUnique({
          where: { id: existingActiveCode.currentDeviceId },
        })
      : null;

    const renewalBaseDate = getLatestValidDate(
      [existingActiveCode.fullEndsAt, currentUserState?.fullEndsAt],
      now
    );

    const renewedFullEndsAt = addPlanDays(renewalBaseDate, plan.durationDays);

    const updatedCode = await prisma.activationCode.update({
      where: { id: existingActiveCode.id },
      data: {
        plan: plan.id,
        fullStartedAt: existingActiveCode.fullStartedAt ?? currentUserState?.fullStartedAt ?? now,
        fullEndsAt: renewedFullEndsAt,
        lastPaymentId: paymentId,
        status: "active",
      },
    });

    if (updatedCode.currentDeviceId) {
      await prisma.userState.update({
        where: { id: updatedCode.currentDeviceId },
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

  const code = await generateUniqueActivationCode();
  const fullEndsAt = addPlanDays(now, plan.durationDays);

  return prisma.activationCode.create({
    data: {
      code,
      phoneE164,
      plan: plan.id,
      status: "active",
      createdBy: "payment",
      lastPaymentId: paymentId,
      fullStartedAt: now,
      fullEndsAt,
    },
  });
}

export async function activateCodeOnDevice(params: {
  code: string;
  phone: string;
  deviceId: string;
  forceTransfer?: boolean;
}) {
  const { code, phone, deviceId, forceTransfer = false } = params;

  const normalizedCode = code.trim().toUpperCase();
  const phoneE164 = normalizePhoneE164(phone);

  if (!normalizedCode) {
    throw new Error("Ingresa tu clave de activación.");
  }

  if (!phoneE164) {
    throw new Error("Ingresa un celular válido.");
  }

  if (!deviceId) {
    throw new Error("No se detectó el dispositivo.");
  }

  const activationCode = await prisma.activationCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!activationCode) {
    return {
      ok: false as const,
      status: "invalid_code" as const,
      message: "La clave de activación no existe o está mal escrita.",
    };
  }

  if (activationCode.phoneE164 !== phoneE164) {
    return {
      ok: false as const,
      status: "phone_mismatch" as const,
      message: "Esta clave no corresponde al celular ingresado.",
    };
  }

  if (activationCode.status !== "active") {
    return {
      ok: false as const,
      status: "inactive_code" as const,
      message: "Esta clave no está activa.",
    };
  }

  if (activationCode.fullEndsAt && activationCode.fullEndsAt.getTime() <= Date.now()) {
    return {
      ok: false as const,
      status: "expired_code" as const,
      message: "Esta clave ya venció. Renueva tu plan para continuar.",
    };
  }

  if (
    activationCode.currentDeviceId &&
    activationCode.currentDeviceId !== deviceId &&
    !forceTransfer
  ) {
    return {
      ok: false as const,
      status: "device_transfer_required" as const,
      message:
        "Esta clave ya está activa en otro dispositivo. Si la activas aquí, el otro dispositivo dejará de tener acceso. ¿Deseas continuar?",
      maskedPhone: maskPhone(phoneE164),
    };
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

  const updatedCode = await prisma.activationCode.update({
    where: { id: activationCode.id },
    data: {
      currentDeviceId: deviceId,
      activatedAt: activationCode.activatedAt ?? new Date(),
    },
  });

  await prisma.deviceSession.create({
    data: {
      phoneE164,
      deviceId,
      activationCodeId: activationCode.id,
      active: true,
    },
  });

  await prisma.userState.upsert({
    where: { id: deviceId },
    create: {
      id: deviceId,
      phoneE164,
      phoneVerifiedAt: new Date(),
      licenseStatus: "active",
      fullStartedAt: updatedCode.fullStartedAt,
      fullEndsAt: updatedCode.fullEndsAt,
      activePlan: updatedCode.plan,
      activePlanSource: "activation-code",
    },
    update: {
      phoneE164,
      phoneVerifiedAt: new Date(),
      licenseStatus: "active",
      fullStartedAt: updatedCode.fullStartedAt,
      fullEndsAt: updatedCode.fullEndsAt,
      activePlan: updatedCode.plan,
      activePlanSource: "activation-code",
    },
  });

  return {
    ok: true as const,
    status: "activated" as const,
    message: "Clave activada correctamente.",
    code: updatedCode.code,
    plan: updatedCode.plan,
    fullEndsAt: updatedCode.fullEndsAt,
  };
}