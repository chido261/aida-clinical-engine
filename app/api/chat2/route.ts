// app/api/chat2/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildAida2WorkPlan } from "@/app/lib/aida2/brain";
import { buildAida2ComposerPrompt } from "@/app/lib/aida2/responseComposer";

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

    const history = buildHistory(messages);

    const workPlan = buildAida2WorkPlan({
      userId: body.deviceId ?? null,
      message: lastUserMessage,
      history,
    });

    const systemPrompt = buildAida2ComposerPrompt({
      workPlan,
      history,
      userMessage: lastUserMessage,
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

    return NextResponse.json({
      ok: true,
      reply,
      aida2: true,
      workPlan,
    });
  } catch (error: any) {
    console.error("API /api/chat2 ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Error desconocido",
      },
      { status: 500 }
    );
  }
}