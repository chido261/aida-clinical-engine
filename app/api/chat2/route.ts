// app/api/chat2/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAida2WorkPlan } from "@/app/lib/aida2/brain";
import { runAida2Modules } from "@/app/lib/aida2/moduleRunner";
import { buildAida2ConversationStrategy } from "@/app/lib/aida2/conversationStrategy";
import { buildAida2ComposerPrompt } from "@/app/lib/aida2/responseComposer";
import {
  buildAida2MemoryPrompt,
  buildConversationStateFromMemory,
  loadAida2ContextMemory,
  updateAida2ContextMemoryAfterResponse,
} from "@/app/lib/aida2/contextMemory";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Body = {
  deviceId?: string;
  messages?: ChatMessage[];
};

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

function buildHistory(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== "system")
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
}

function resolveUserId(body: Body) {
  const deviceId = body.deviceId?.trim();

  if (deviceId) return deviceId;

  return "chat2-local";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return NextResponse.json(
        { ok: false, error: "Historial de mensajes inválido" },
        { status: 400 }
      );
    }

    const lastUserMessage = getLastUserMessage(messages);

    if (!lastUserMessage.trim()) {
      return NextResponse.json(
        { ok: false, error: "Mensaje vacío" },
        { status: 400 }
      );
    }

    const userId = resolveUserId(body);
    const memory = await loadAida2ContextMemory({ userId });

    const recentHistory = buildHistory(messages);
    const memoryPrompt = buildAida2MemoryPrompt(memory);
    const history = [
      memoryPrompt,
      "",
      "HISTORIAL RECIENTE DE LA CONVERSACIÓN:",
      recentHistory || "Sin historial reciente.",
    ].join("\n");

    const conversationState = buildConversationStateFromMemory(memory);

    const workPlan = buildAida2WorkPlan({
      userId,
      message: lastUserMessage,
      history,
      conversationState,
    });

    const moduleResults = runAida2Modules({
      workPlan,
      history,
      userMessage: lastUserMessage,
    });

    const conversationStrategy = buildAida2ConversationStrategy({
      workPlan,
      moduleResults,
      userMessage: lastUserMessage,
    });

    const systemPrompt = buildAida2ComposerPrompt({
      workPlan,
      history,
      userMessage: lastUserMessage,
      contextModule: moduleResults.context,
      mealModule: moduleResults.meal,
      conversationStrategy,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.filter((m) => m.role !== "system").slice(-8),
      ],
    });

    const reply =
      response.choices[0]?.message?.content ??
      "No pude generar una respuesta en este momento.";

    await updateAida2ContextMemoryAfterResponse({
      userId,
      userMessage: lastUserMessage,
      assistantReply: reply,
      workPlan,
      moduleResults,
    });

    return NextResponse.json({
      ok: true,
      reply,
      aida2: true,
      userId,
      workPlan,
      modules: moduleResults,
      conversationStrategy,
    });
  } catch (error: unknown) {
    console.error("API /api/chat2 ERROR:", error);

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
