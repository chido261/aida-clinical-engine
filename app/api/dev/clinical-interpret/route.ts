// app/api/dev/clinical-interpret/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { interpretAidaClinicalText } from "@/app/lib/aida/clinicalInterpreter";

function isAuthorized(req: Request) {
  const expectedKey = process.env.AIDA_ADMIN_KEY;

  if (!expectedKey) {
    return false;
  }

  const providedKey = req.headers.get("x-aida-admin-key");

  return providedKey === expectedKey;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta text",
        },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        {
          ok: false,
          error: "Texto demasiado largo",
        },
        { status: 400 }
      );
    }

    const interpretation = interpretAidaClinicalText(text);

    return NextResponse.json({
      ok: true,
      input: text,
      interpretation,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ??
          "Error desconocido al interpretar texto clínico.",
      },
      { status: 500 }
    );
  }
}