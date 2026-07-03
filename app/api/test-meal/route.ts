import { NextResponse } from "next/server";
import { generateMealRecommendation } from "@/app/lib/aida2/specialists/mealSpecialist";

export async function GET() {

  const result = generateMealRecommendation({

    mealType: "desayuno",

    userMessage: "Amanecí en 140"

  });

  return NextResponse.json(result);

}