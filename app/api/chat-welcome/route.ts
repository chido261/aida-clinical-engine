// app/api/chat-welcome/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureUserState, getLastReading } from "@/app/lib/aidaMemory";
import {
  buildPendingFollowUpWelcome,
  buildResolvedEventWelcome,
  buildReturnWelcome,
} from "@/app/lib/aida/welcomeContextBuilder";

type Body = {
  deviceId?: string;
  onboarding?: {
    name?: string;
    fastingPeakMgDl?: string;
    postMealPeakMgDl?: string;
    wakeTime?: string;
  };
};

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
    const name = onboarding.name?.trim() || userState.name?.trim() || "David";

    const welcomeUserState = {
      clinicalState: userState.clinicalState ?? null,
      lastEventType: userState.lastEventType ?? null,
      lastEventAt: userState.lastEventAt ?? null,
      pendingFollowUpType: userState.pendingFollowUpType ?? null,
      pendingFollowUpAt: userState.pendingFollowUpAt ?? null,
      lastRecommendation: userState.lastRecommendation ?? null,
      currentNutritionGoal: userState.currentNutritionGoal ?? null,
      activeProtocol: userState.activeProtocol ?? null,
      activePhase: userState.activePhase ?? null,
    };

    const pendingFollowUpReply = buildPendingFollowUpWelcome({
      name,
      userState: welcomeUserState,
    });

    const resolvedEventReply = pendingFollowUpReply
      ? null
      : buildResolvedEventWelcome({
          name,
          userState: welcomeUserState,
          lastReading,
        });

    const reply = pendingFollowUpReply
      ? pendingFollowUpReply
      : resolvedEventReply
        ? resolvedEventReply
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
      hasResolvedEventContext: Boolean(resolvedEventReply),
    });
  } catch (err: any) {
    console.error("API /api/chat-welcome ERROR:", err);

    return NextResponse.json(
      { ok: false, error: err?.message ?? "Error desconocido" },
      { status: 500 }
    );
  }
}