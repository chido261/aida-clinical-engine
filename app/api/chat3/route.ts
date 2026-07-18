export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/app/lib/prisma";
import {
  Aida3ExpertRegistry, Aida3TurnEngine, Aida3TurnOrchestrator, Aida3TurnResponseComposer,
  ChefExpert, NutritionExpert, OpenAiChefTools, OpenAiHumanizerProvider, OpenAiSemanticProvider,
  type ProtocolId,
} from "@/app/lib/aida3";
import { PrismaCulinaryMemory } from "@/app/lib/aida3/infrastructure/prismaCulinaryMemory";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type Body = { deviceId?: string; messages?: ChatMessage[] };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const culinaryMemory = new PrismaCulinaryMemory();
const culinary = new OpenAiChefTools(openai);
const registry = new Aida3ExpertRegistry().register(new NutritionExpert()).register(new ChefExpert(
  { generate: context => culinary.generateMeals(context) },
  { generate: context => culinary.generateBeverages(context) },
  { explain: recipe => culinary.explain(recipe) }, culinaryMemory
));
const engine = new Aida3TurnEngine(new OpenAiSemanticProvider(openai), new Aida3TurnOrchestrator(registry),
  new Aida3TurnResponseComposer(new OpenAiHumanizerProvider(openai)));

function protocolId(activePhase?: string | null, activeProtocol?: string | null): ProtocolId {
  const value = `${activePhase ?? ""} ${activeProtocol ?? ""}`.toUpperCase().replace(/[\s-]+/g, "_");
  if (value.includes("FASE_2") || value.includes("FASE2")) return "FASE_2";
  if (value.includes("FASE_1") || value.includes("FASE1")) return "FASE_1";
  return "DIAGNOSTICO_7_DIAS";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Body;
    const messages = Array.isArray(body.messages) ? body.messages.filter(message =>
      message && ["user", "assistant", "system"].includes(message.role) && typeof message.content === "string") : [];
    const message = [...messages].reverse().find(item => item.role === "user")?.content.trim() ?? "";
    if (!message) return NextResponse.json({ ok: false, error: "Mensaje requerido" }, { status: 400 });
    const userId = body.deviceId?.trim() || "chat3-local";
    const user = await prisma.userState.upsert({ where: { id: userId }, create: { id: userId }, update: {},
      select: { name: true, activePhase: true, activeProtocol: true, clinicalState: true,
        currentNutritionGoal: true, lastRecommendation: true } });
    const contextRecord = await prisma.conversationContext.findUnique({ where: { userId }, select: {
      clinicalSummary: true, currentGoal: true, lastConcern: true, pendingConversationFollowUp: true,
    } });
    const options = await culinaryMemory.listOptions(userId);
    const recentHistory = messages.filter(item => item.role !== "system").slice(-8);
    const execution = await engine.execute({ turnId: randomUUID(), message,
      protocolId: protocolId(user.activePhase, user.activeProtocol), relevantContext: {
        conversationId: userId, patientName: user.name, clinicalState: user.clinicalState,
        nutritionGoal: user.currentNutritionGoal, lastRecommendation: user.lastRecommendation,
        clinicalSummary: contextRecord?.clinicalSummary, currentGoal: contextRecord?.currentGoal,
        lastConcern: contextRecord?.lastConcern, pendingFollowUp: contextRecord?.pendingConversationFollowUp,
        recentHistory, culinaryOptions: options,
      } });
    console.info("AIDA3_TURN_TIMINGS", { userId, turnId: execution.plan.turnId, ...execution.timings });
    return NextResponse.json({ ok: true, reply: execution.response.text, aida3: true,
      ...(process.env.NODE_ENV === "production" ? {} : { turnId: execution.plan.turnId,
        tasks: execution.plan.tasks, outcome: execution.outcome.status, timings: execution.timings }) });
  } catch (error) {
    console.error("API /api/chat3 ERROR:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 });
  }
}
