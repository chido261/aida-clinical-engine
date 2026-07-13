import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import {
  runProtocolModule,
  type ProtocolId,
} from "@/app/lib/aida2/modules/protocolModule";

function resolveProtocolId(
  activePhase: string | null | undefined
): ProtocolId {
  const normalized = activePhase?.trim().toUpperCase();

  if (
    normalized === "DIAGNOSTICO" ||
    normalized === "DIAGNOSTICO_7_DIAS"
  ) {
    return "DIAGNOSTICO_7_DIAS";
  }

  if (normalized === "FASE_2") {
    return "FASE_2";
  }

  return "FASE_1";
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();

  if (!deviceId) {
    return NextResponse.json(
      {
        error: "MISSING_DEVICE_ID",
        message: "Debes enviar el parámetro deviceId.",
      },
      { status: 400 }
    );
  }

  const user = await prisma.userState.findUnique({
    where: {
      id: deviceId,
    },
    select: {
      id: true,
      activePhase: true,
      activeProtocol: true,
      protocolVersion: true,
      protocolStartedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "USER_NOT_FOUND",
        message: "No se encontró un usuario para ese deviceId.",
      },
      { status: 404 }
    );
  }

  const protocolId = resolveProtocolId(user.activePhase);
  const protocol = runProtocolModule({
    protocolId,
  });

  return NextResponse.json({
    user: {
      id: user.id,
      activePhase: user.activePhase,
      activeProtocol: user.activeProtocol,
      storedProtocolVersion: user.protocolVersion,
      protocolStartedAt: user.protocolStartedAt,
    },
    resolvedProtocolId: protocolId,
    protocol,
  });
}