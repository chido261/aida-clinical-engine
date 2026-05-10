// app/api/chat-welcome/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { ensureUserState, getLastReading } from "@/app/lib/aidaMemory";

type Body = {
  deviceId?: string;
  onboarding?: {
    name?: string;
    fastingPeakMgDl?: string;
    postMealPeakMgDl?: string;
    wakeTime?: string;
  };
};

type FollowUpUserState = {
  clinicalState: string | null;
  lastEventType: string | null;
  lastEventAt: Date | null;
  pendingFollowUpType: string | null;
  pendingFollowUpAt: Date | null;
  lastRecommendation: string | null;
};

const MX_TZ = "America/Mexico_City";

function getNowMx() {
  return DateTime.now().setZone(MX_TZ);
}

function getPartOfDay(now: DateTime) {
  const hour = now.hour;

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

function getDayRelation(date: Date, now: DateTime) {
  const value = DateTime.fromJSDate(date).setZone(MX_TZ);
  const diffDays = Math.floor(now.startOf("day").diff(value.startOf("day"), "days").days);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "older";
}

function getElapsedMinutes(date: Date, now: DateTime) {
  const value = DateTime.fromJSDate(date).setZone(MX_TZ);
  return Math.max(0, Math.floor(now.diff(value, "minutes").minutes));
}

function buildFirstWelcome(onboarding: NonNullable<Body["onboarding"]>) {
  const name = onboarding.name?.trim() || "Hola";
  const fasting = Number(onboarding.fastingPeakMgDl);
  const postMeal = Number(onboarding.postMealPeakMgDl);

  const focus =
    Number.isFinite(postMeal) && Number.isFinite(fasting) && postMeal > fasting
      ? "cómo responde tu cuerpo a los alimentos"
      : "tu balance de alimentos y horarios de comidas";

  const wakeTime = onboarding.wakeTime || "06:00";

  return `Hola ${name} 👋

Gracias por compartir tus datos. Para comenzar, me enfocaré en ${focus}.

☀️ Como normalmente despiertas a las ${wakeTime}, te voy a pedir tu lectura en ayunas alrededor de esa hora todos los días.

Cuando quieras, dime:
- ¿Qué sueles desayunar?
- o ¿Cuál fue tu última lectura de glucosa?`;
}

function buildPendingFollowUpWelcome(params: {
  name: string;
  userState: FollowUpUserState;
}) {
  const { name, userState } = params;
  const now = getNowMx();

  if (
    userState.pendingFollowUpType === "HYPO_RECHECK_15MIN" &&
    userState.pendingFollowUpAt
  ) {
    const minutes = getElapsedMinutes(userState.pendingFollowUpAt, now);

    const timePhrase =
      minutes < 60
        ? "Hace un rato"
        : getDayRelation(userState.pendingFollowUpAt, now) === "today"
          ? "Hoy"
          : "La última vez";

    return `Hola ${name} 👋

${timePhrase} registraste una glucosa baja y quedamos en volver a medir después del protocolo 15-15.

Antes de seguir, dime cuánto marca tu glucosa ahora.`;
  }

  if (
    userState.pendingFollowUpType === "HYPO_STABILITY_RECHECK" &&
    userState.pendingFollowUpAt
  ) {
    const minutes = getElapsedMinutes(userState.pendingFollowUpAt, now);

    const timePhrase =
      minutes < 60
        ? "Hace un rato"
        : getDayRelation(userState.pendingFollowUpAt, now) === "today"
          ? "Hoy"
          : "La última vez";

    return `Hola ${name} 👋

${timePhrase} subiste después de una glucosa baja. Quiero confirmar que sigas estable.

Dime cómo te sientes y cuánto marca tu glucosa ahora.`;
  }

  return null;
}

function buildReturnWelcome(params: {
  name: string;
  lastReading: {
    glucose: number;
    moment: string;
    createdAt: Date;
  };
  clinicalState: string | null;
}) {
  const { name, lastReading, clinicalState } = params;

  const now = getNowMx();
  const partOfDay = getPartOfDay(now);
  const relation = getDayRelation(lastReading.createdAt, now);
  const reading = `${lastReading.glucose} mg/dL`;

  const moment =
    lastReading.moment === "AYUNO"
      ? "en ayunas"
      : lastReading.moment === "POSTCOMIDA"
        ? "postcomida"
        : lastReading.moment === "NOCHE"
          ? "antes de dormir"
          : "";

  const readingWithMoment = moment ? `${reading} ${moment}` : reading;

  if (clinicalState === "HYPO_ACTIVE" || lastReading.glucose < 70) {
    if (relation === "today") {
      return `Hola ${name} 👋

Hoy registraste una glucosa baja de ${readingWithMoment}. Antes de seguir, dime cómo te sientes en este momento.`;
    }

    return `Hola ${name} 👋

La última lectura que tengo registrada fue una glucosa baja de ${readingWithMoment}. Antes de avanzar, conviene confirmar cómo te encuentras ahora.`;
  }

  if (relation === "today") {
    if (!moment) {
      return `Hola ${name} 👋

Hoy registraste ${reading}. No quedó identificado si fue en ayunas, después de comer o antes de dormir, así que dime qué te gustaría revisar ahora.`;
    }

    if (partOfDay === "morning") {
      return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar qué sigue según cómo vaya tu mañana.`;
    }

    if (partOfDay === "afternoon") {
      if (lastReading.moment === "AYUNO") {
        return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Si ya comiste, podemos revisar cómo respondió tu glucosa después de los alimentos.`;
      }

      if (lastReading.moment === "POSTCOMIDA") {
        return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo va el resto de tu día y qué conviene hacer después.`;
      }

      return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo vas ahora.`;
    }

    if (lastReading.moment === "NOCHE") {
      return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo va cerrando tu día.`;
    }

    return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo va cerrando tu día.`;
  }

  if (relation === "yesterday") {
    if (partOfDay === "morning") {
      return `Hola ${name} 👋

Ayer registraste ${readingWithMoment}. Cuando tengas tu lectura de hoy, compártemela y la comparamos.`;
    }

    return `Hola ${name} 👋

Ayer registraste ${readingWithMoment}. Podemos revisar cómo vas hoy y ver si el patrón se mantiene.`;
  }

  if (partOfDay === "morning") {
    return `Hola ${name} 👋

La última lectura que tengo registrada fue de ${readingWithMoment}. Cuando tengas tu lectura en ayunas de hoy, compártemela y vemos cómo inicia tu día.`;
  }

  return `Hola ${name} 👋

La última lectura que tengo registrada fue de ${readingWithMoment}. ¿Qué te gustaría revisar ahora?`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const userId = body.deviceId?.trim();
    const onboarding = body.onboarding;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Falta deviceId" }, { status: 400 });
    }

    if (!onboarding) {
      return NextResponse.json({ ok: false, error: "Falta onboarding" }, { status: 400 });
    }

    const userState = await ensureUserState(userId);
    const lastReading = await getLastReading(userId);
    const name = onboarding.name?.trim() || "David";

    const pendingFollowUpReply = buildPendingFollowUpWelcome({
      name,
      userState: {
        clinicalState: userState.clinicalState ?? null,
        lastEventType: userState.lastEventType ?? null,
        lastEventAt: userState.lastEventAt ?? null,
        pendingFollowUpType: userState.pendingFollowUpType ?? null,
        pendingFollowUpAt: userState.pendingFollowUpAt ?? null,
        lastRecommendation: userState.lastRecommendation ?? null,
      },
    });

    const reply = pendingFollowUpReply
      ? pendingFollowUpReply
      : lastReading
        ? buildReturnWelcome({
            name,
            lastReading,
            clinicalState: userState.clinicalState ?? null,
          })
        : buildFirstWelcome(onboarding);

    return NextResponse.json({
      ok: true,
      reply,
      isFirstWelcome: !lastReading,
      hasPendingFollowUp: Boolean(pendingFollowUpReply),
    });
  } catch (err: any) {
    console.error("API /api/chat-welcome ERROR:", err);

    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}