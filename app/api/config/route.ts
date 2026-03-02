// app/api/config/route.ts
import { NextResponse } from "next/server";
import { APP_MODE } from "@/app/lib/runtimeConfig";

export async function GET() {
  return NextResponse.json({ appMode: APP_MODE });
}