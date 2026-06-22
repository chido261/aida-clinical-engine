// app/lib/aida/responseComposer.ts

import OpenAI from "openai";

import type { AidaBrainResult } from "@/app/lib/aida/aidaBrain";
import { buildAidaGptPrompt } from "@/app/lib/aida/gptPromptBuilder";

export type AidaFinalResponse = {
  reply: string;
  source: "DETERMINISTIC" | "GPT_ASSISTED";
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function composeAidaResponse(
  brainResult: AidaBrainResult
): Promise<AidaFinalResponse> {
  const { conversationPlan } = brainResult;

  if (
    conversationPlan.responseMode === "DETERMINISTIC" &&
    conversationPlan.deterministicReply
  ) {
    return {
      reply: conversationPlan.deterministicReply,
      source: "DETERMINISTIC",
    };
  }

  const { systemPrompt, userPrompt } = buildAidaGptPrompt(brainResult);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  return {
    reply:
      completion.choices[0]?.message?.content ??
      "No pude generar una respuesta en este momento.",
    source: "GPT_ASSISTED",
  };
}