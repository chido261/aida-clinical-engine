export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/app/lib/prisma";
import {
  Aida3Brain, Aida3BrainTurnEngine, Aida3DeterministicResponseAssembler, Aida3ExpertRegistry,
  Aida3TurnOrchestrator, ChefExpert, ConversationExpert, GlucoseExpert, NutritionExpert,
  OpenAiChefTools, OpenAiCurrentTurnAnalyzer,
  type ProtocolId,
} from "@/app/lib/aida3";
import { PrismaCulinaryMemory } from "@/app/lib/aida3/infrastructure/prismaCulinaryMemory";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
type Body = { deviceId?: string; messages?: ChatMessage[] };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const culinaryMemory = new PrismaCulinaryMemory();
const culinary = new OpenAiChefTools(openai);
const registry = new Aida3ExpertRegistry()
  .register(new ConversationExpert())
  .register(new GlucoseExpert())
  .register(new NutritionExpert())
  .register(new ChefExpert({ generate: context => culinary.generateMeals(context) },
    { generate: context => culinary.generateBeverages(context) },
    { explain: recipe => culinary.explain(recipe) }, culinaryMemory));
const engine = new Aida3BrainTurnEngine(new OpenAiCurrentTurnAnalyzer(openai), new Aida3Brain(),
  new Aida3TurnOrchestrator(registry), new Aida3DeterministicResponseAssembler());

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
      select: { activePhase: true, activeProtocol: true } });
    const options = await culinaryMemory.listOptions(userId);
    const execution = await engine.execute({ turnId: randomUUID(), message,
      context: { conversationId: userId, protocolId: protocolId(user.activePhase, user.activeProtocol),
        availableRecipes: options.map(option => ({ id: option.id, name: option.name })) } });
    console.info("AIDA3_TURN_TIMINGS", { userId, turnId: execution.plan.turnId, ...execution.timings });
    if (execution.response.source === "FAILURE") {
      const diagnostics = execution.outcome.bundle.results
        .filter(result => result.status === "FAILED" || result.status === "BLOCKED")
        .map(result => ({ taskId: result.taskId, expertId: result.expertId,
          status: result.status, errorCode: result.errorCode, data: result.data }));
      console.error("AIDA3_TURN_FAILED", { turnId: execution.plan.turnId, diagnostics });
      return NextResponse.json({ ok: false, error: "Chat3 no pudo completar todos los módulos.",
        ...(process.env.NODE_ENV === "production" ? {} : { diagnostics, tasks: execution.plan.tasks,
          timings: execution.timings }) }, { status: 422 });
    }
    return NextResponse.json({ ok: true, reply: execution.response.text, aida3: true,
      ...(process.env.NODE_ENV === "production" ? {} : { turnId: execution.plan.turnId,
        tasks: execution.plan.tasks, outcome: execution.outcome.status, timings: execution.timings }) });
  } catch (error) {
    console.error("API /api/chat3 ERROR:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" }, { status: 500 });
  }
}
