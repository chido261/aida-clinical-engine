// app/api/admin/activation-requests/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

export async function GET() {
  try {
    const requests = await prisma.activationRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    return jsonOK({
      ok: true,
      activationRequests: requests.map((request) => ({
        id: request.id,
        deviceId: request.deviceId,
        name: request.name,
        phone: request.phone,
        plan: request.plan,
        price: request.price,
        duration: request.duration,
        status: request.status,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })),
    });
  } catch (err: any) {
    console.error("API /api/admin/activation-requests ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}