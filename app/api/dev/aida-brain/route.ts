// app/api/dev/aida-brain/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runAidaBrain } from "@/app/lib/aida/aidaBrain";
import { buildAidaGptPrompt } from "@/app/lib/aida/gptPromptBuilder";
import { composeAidaResponse } from "@/app/lib/aida/responseComposer";

function isDevAllowed(req: Request) {
  const adminKey = process.env.AIDA_ADMIN_KEY;

  if (!adminKey) {
    return true;
  }

  const keyFromHeader = req.headers.get("x-aida-admin-key");
  return keyFromHeader === adminKey;
}

export async function POST(req: Request) {
  try {
    if (!isDevAllowed(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const body = await req.json();

    const userId =
      typeof body.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : "dev-aida-brain-user";

    const text =
      typeof body.text === "string" && body.text.trim()
        ? body.text.trim()
        : "";

    const historyPlain =
      typeof body.historyPlain === "string" ? body.historyPlain : "";

    const includeReply = body.includeReply === true;

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta text",
        },
        { status: 400 }
      );
    }

    const brainResult = await runAidaBrain({
      userId,
      text,
      historyPlain,
    });

    const gptPrompt = buildAidaGptPrompt(brainResult);

    const finalResponse = includeReply
      ? await composeAidaResponse(brainResult)
      : null;

    return NextResponse.json({
      ok: true,
      brainResult,
      gptPrompt,
      finalResponse,
    });
  } catch (error: any) {
    console.error("API /api/dev/aida-brain ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Error desconocido",
      },
      { status: 500 }
    );
  }
}