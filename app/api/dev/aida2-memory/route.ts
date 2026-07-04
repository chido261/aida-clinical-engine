// app/api/dev/aida2-memory/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { loadAida2ContextMemory } from "@/app/lib/aida2/contextMemory";

function getUserIdFromUrl(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("userId")?.trim() || "chat2-local";
}

function safeParseJson(value: string | null | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return {
      parseError: true,
      raw: value,
    };
  }
}

export async function GET(req: Request) {
  try {
    const userId = getUserIdFromUrl(req);

    const memory = await loadAida2ContextMemory({ userId });

    const [userState, conversationContext, recentReadings, recentMeals] =
      await Promise.all([
        prisma.userState.findUnique({
          where: { id: userId },
        }),
        prisma.conversationContext.findUnique({
          where: { userId },
        }),
        prisma.reading.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.mealLog.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    return NextResponse.json({
      ok: true,
      userId,
      memory,
      db: {
        userState,
        conversationContext: conversationContext
          ? {
              ...conversationContext,
              metadataJson: safeParseJson(conversationContext.metadataJson),
            }
          : null,
        recentReadings,
        recentMeals,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/dev/aida2-memory ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = getUserIdFromUrl(req);

    await prisma.conversationContext.deleteMany({
      where: { userId },
    });

    await prisma.userState.updateMany({
      where: { id: userId },
      data: {
        clinicalState: null,
        lastEventType: null,
        lastEventAt: null,
        pendingFollowUpType: null,
        pendingFollowUpAt: null,
        lastRecommendation: null,
        currentNutritionGoal: null,
      },
    });

    return NextResponse.json({
      ok: true,
      userId,
      message: "Memoria conversacional AIDA2 reseteada.",
    });
  } catch (error: unknown) {
    console.error("DELETE /api/dev/aida2-memory ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
