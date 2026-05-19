// app/api/activation-request/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type PlanKey = "mensual" | "3-meses" | "anual";

type Body = {
  deviceId?: string;
  name?: string;
  phone?: string;
  plan?: string;
};

const PLAN_CONFIG: Record<
  PlanKey,
  {
    price: number;
    duration: number;
  }
> = {
  mensual: {
    price: 500,
    duration: 30,
  },
  "3-meses": {
    price: 1500,
    duration: 90,
  },
  anual: {
    price: 3000,
    duration: 365,
  },
};

function normalizePlan(value: string | undefined): PlanKey | null {
  if (value === "mensual" || value === "3-meses" || value === "anual") {
    return value;
  }

  return null;
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

function jsonOK(payload: any) {
  return NextResponse.json(payload);
}

function jsonERR(payload: any, status: number) {
  return NextResponse.json(payload, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const deviceId = (body.deviceId ?? "").trim();
    const name = (body.name ?? "").trim();
    const phoneRaw = (body.phone ?? "").trim();
    const phone = cleanPhone(phoneRaw);
    const planKey = normalizePlan(body.plan);

    if (!deviceId) {
      return jsonERR({ ok: false, error: "Falta deviceId" }, 400);
    }

    if (name.length < 3) {
      return jsonERR({ ok: false, error: "Nombre inválido" }, 400);
    }

    if (phone.length < 10) {
      return jsonERR({ ok: false, error: "Celular inválido" }, 400);
    }

    if (!planKey) {
      return jsonERR({ ok: false, error: "Plan inválido" }, 400);
    }

    const plan = PLAN_CONFIG[planKey];

    const request = await prisma.activationRequest.create({
      data: {
        deviceId,
        name,
        phone,
        plan: planKey,
        price: plan.price,
        duration: plan.duration,
        status: "pending",
      },
    });

    return jsonOK({
      ok: true,
      activationRequest: {
        id: request.id,
        deviceId: request.deviceId,
        name: request.name,
        phone: request.phone,
        plan: request.plan,
        price: request.price,
        duration: request.duration,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err: any) {
    console.error("API /api/activation-request ERROR:", err);

    return jsonERR(
      {
        ok: false,
        error: err?.message ?? "Error desconocido",
      },
      500
    );
  }
}