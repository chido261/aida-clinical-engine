export const runtime = "nodejs";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AIDA_INSTRUCTIONS } from "@/app/lib/aida3/aidaInstructions";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  messages?: ChatMessage[];
};

type Citation = {
  title: string;
  url: string;
};

const OFFICIAL_DOMAINS = [
  "diabetes.org",
  "professional.diabetes.org",
  "who.int",
  "cdc.gov",
  "niddk.nih.gov",
  "nih.gov",
  "medlineplus.gov",
  "fda.gov",
  "gob.mx",
  "imss.gob.mx",
  "salud.gob.mx",
];

const MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4_000;

let protocolPromise: Promise<string> | null = null;

function loadPhaseOneProtocol() {
  protocolPromise ??= readFile(
    path.join(process.cwd(), "docs", "protocols", "fase1.md"),
    "utf8",
  );
  return protocolPromise;
}

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<ChatMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string"
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-MAX_MESSAGES);
}

function collectCitations(output: unknown): Citation[] {
  const citations = new Map<string, Citation>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const item = value as Record<string, unknown>;
    if (
      item.type === "url_citation" &&
      typeof item.url === "string" &&
      item.url.startsWith("https://")
    ) {
      citations.set(item.url, {
        url: item.url,
        title: typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "Fuente oficial",
      });
    }

    Object.values(item).forEach(visit);
  }

  visit(output);
  return [...citations.values()].slice(0, 3);
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY no está configurada." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as RequestBody;
    const messages = cleanMessages(body.messages);

    if (messages.length === 0 || messages.at(-1)?.role !== "user") {
      return NextResponse.json(
        { ok: false, error: "Escribe un mensaje para AIDA." },
        { status: 400 },
      );
    }

    const protocol = await loadPhaseOneProtocol();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: MODEL,
      instructions: `${AIDA_INSTRUCTIONS}\n\n# PROTOCOLO ACTIVO: FASE 1\n\n${protocol}`,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: [{
        type: "web_search",
        filters: { allowed_domains: OFFICIAL_DOMAINS },
      }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
    });

    const reply = response.output_text?.trim();
    if (!reply) {
      return NextResponse.json(
        { ok: false, error: "AIDA no pudo generar una respuesta." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      reply,
      sources: collectCitations(response.output),
    });
  } catch (error) {
    console.error("Chat3 error", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : "No fue posible consultar a AIDA.",
      },
      { status: 500 },
    );
  }
}
