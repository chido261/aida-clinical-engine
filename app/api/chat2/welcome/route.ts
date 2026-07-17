// app/api/chat2/welcome/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  buildPendingFollowUpWelcome,
  buildResolvedEventWelcome,
  buildReturnWelcome,
} from "@/app/lib/aida/welcomeContextBuilder";
import { loadAida2ContextMemory } from "@/app/lib/aida2/contextMemory";

type Body = {
  deviceId?: string;
};

type LastReadingForWelcome = {
  glucose: number;
  moment: string;
  createdAt: Date;
};

function resolveUserId(body: Body) {
  const deviceId = body.deviceId?.trim();
  return deviceId || "chat2-local";
}

function cleanName(name: string | null | undefined) {
  const value = name?.trim();
  return value || null;
}

function buildFallbackWelcome(params: {
  name: string | null;
  contextSummary: string | null;
  lastMainTopic: string | null;
  nextSuggestedFollowUp: string | null;
  firstContact: boolean;
}) {
  const { name, contextSummary, lastMainTopic, nextSuggestedFollowUp, firstContact } = params;

  if (firstContact) {
    return [
      name ? `Hola ${name}, soy AIDA 👋` : "Hola, soy AIDA 👋",
      "Soy tu asistente de confianza para el control glucémico. Me especializo en acompañar a personas con prediabetes y diabetes tipo 2, incluso si utilizan insulina.",
      "También puedo brindar apoyo educativo en diabetes tipo 1, LADA o diabetes durante el embarazo, pero estos casos necesitan seguimiento cercano de un profesional de salud.",
      "Durante estos primeros 7 días te ayudaré a observar cómo responde tu glucosa a la alimentación. ¿Comenzamos?",
    ].join("\n\n");
  }

  const lines = [name ? `Hola ${name} 👋` : "Hola, soy AIDA2 👋"];

  if (lastMainTopic) {
    lines.push(`La última vez estábamos trabajando sobre: ${lastMainTopic}.`);
  } else if (contextSummary) {
    lines.push(contextSummary);
  } else {
    lines.push(
      "Estoy lista para ayudarte con comida, glucosa, ejercicio, protocolos y medicamentos en diabetes tipo 2."
    );
  }

  if (nextSuggestedFollowUp) {
    lines.push(nextSuggestedFollowUp);
  } else {
    lines.push("¿Qué te gustaría revisar ahora?");
  }

  return lines.join("\n\n");
}

function shouldPrioritizePendingFollowUp(params: {
  pendingFollowUpType: string | null | undefined;
  lastReading: LastReadingForWelcome | null;
}) {
  const { pendingFollowUpType, lastReading } = params;

  if (!pendingFollowUpType) return false;

  if (
    pendingFollowUpType === "HYPO_RECHECK_15MIN" ||
    pendingFollowUpType === "HYPO_STABILITY_RECHECK"
  ) {
    return true;
  }

  if (!lastReading) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const userId = resolveUserId(body);

    const [memory, userState, lastReading] = await Promise.all([
      loadAida2ContextMemory({ userId }),
      prisma.userState.findUnique({
        where: { id: userId },
        select: {
          name: true,
          clinicalState: true,
          lastEventType: true,
          lastEventAt: true,
          pendingFollowUpType: true,
          pendingFollowUpAt: true,
          lastRecommendation: true,
          currentNutritionGoal: true,
          activeProtocol: true,
          activePhase: true,
          onboardingDoneAt: true,
          totalMsgCount: true,
        },
      }),
      prisma.reading.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          glucose: true,
          moment: true,
          createdAt: true,
        },
      }),
    ]);

    const name = cleanName(userState?.name ?? memory.userState.name);
    const context = memory.metadata.conversationContext;

    let pendingWelcome: string | null = null;
    let readingWelcome: string | null = null;
    let resolvedWelcome: string | null = null;

    if (
      userState &&
      name &&
      shouldPrioritizePendingFollowUp({
        pendingFollowUpType: userState.pendingFollowUpType,
        lastReading,
      })
    ) {
      pendingWelcome = buildPendingFollowUpWelcome({
        name,
        userState,
      });
    }

    if (userState && name && lastReading) {
      readingWelcome = buildReturnWelcome({
        name,
        lastReading,
        clinicalState:
          lastReading.glucose < 70
            ? "HYPO_ACTIVE"
            : userState.clinicalState === "HYPO_ACTIVE"
              ? userState.clinicalState
              : null,
      });
    }

    if (userState && name && !pendingWelcome && !readingWelcome) {
      resolvedWelcome = buildResolvedEventWelcome({
        name,
        userState,
        lastReading,
      });
    }

    const fallbackWelcome = buildFallbackWelcome({
      name,
      contextSummary: context.contextSummary,
      lastMainTopic: context.lastMainTopic,
      nextSuggestedFollowUp: context.nextSuggestedFollowUp,
      firstContact: Boolean(userState?.onboardingDoneAt) &&
        (userState?.totalMsgCount ?? 0) === 0 &&
        !lastReading,
    });

    const welcome =
      pendingWelcome ??
      readingWelcome ??
      resolvedWelcome ??
      fallbackWelcome;

    return NextResponse.json({
      ok: true,
      welcome,
      userId,
      hasName: Boolean(name),
      hasLastReading: Boolean(lastReading),
      lastReading: lastReading
        ? {
            glucose: lastReading.glucose,
            moment: lastReading.moment,
            createdAt: lastReading.createdAt,
          }
        : null,
      pendingFollowUpType: userState?.pendingFollowUpType ?? null,
    });
  } catch (error: unknown) {
    console.error("API /api/chat2/welcome ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
