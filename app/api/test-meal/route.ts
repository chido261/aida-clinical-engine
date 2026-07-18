import { NextResponse } from "next/server";
import { generateMealRecommendation } from "@/app/lib/aida2/specialists/mealSpecialist";
import type { ProtocolId } from "@/app/lib/aida2/modules/protocolModule";
import type { MealType } from "@/app/lib/aida2/specialists/mealSpecialist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get("message") ?? "Amanecí en 140";
  const protocolId = (searchParams.get("protocol") ?? "FASE_1") as ProtocolId;
  const mealType = (searchParams.get("mealType") ?? "desayuno") as MealType;
  const result = generateMealRecommendation({
    mealType,
    protocolId,
    userMessage: message,
  });

  return NextResponse.json(result);
}
