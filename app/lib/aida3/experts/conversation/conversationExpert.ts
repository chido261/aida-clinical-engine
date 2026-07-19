import type { Aida3ExpertResult } from "../../core/contracts";
import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import { ANSWER_GENERAL_ACTION, CONVERSATION_EXPERT_ID, GREET_ACTION } from "./contracts";

function greeting(input: Record<string, unknown>) {
  const rawName = typeof input.patientName === "string" ? input.patientName.trim() : "";
  const firstName = rawName.split(/\s+/)[0]?.slice(0, 40) ?? "";
  const name = firstName ? `, ${firstName}` : "";
  const options = [
    `¡Hola${name}! ¿Cómo puedo ayudarte hoy?`,
    `Hola${name}. Es un gusto saludarte. ¿En qué puedo ayudarte?`,
    `¡Hola${name}! Estoy aquí para orientarte. ¿Qué te gustaría consultar?`,
  ];
  const seed = typeof input.variationSeed === "string" ? input.variationSeed : "";
  const index = [...seed].reduce((total, character) => total + character.codePointAt(0)!, 0) % options.length;
  return options[index];
}

export class ConversationExpert implements Aida3Expert {
  readonly id = CONVERSATION_EXPERT_ID;

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    if (context.task.action === GREET_ACTION) {
      return this.result(context, "COMPLETED", "GREETING", greeting(context.task.input), null);
    }
    if (context.task.action === ANSWER_GENERAL_ACTION) {
      const answer = context.task.input.answer;
      if (typeof answer !== "string" || !answer.trim()) {
        return this.result(context, "FAILED", null, null, "INVALID_GENERAL_EDUCATION_ANSWER");
      }
      return this.result(context, "COMPLETED", "GENERAL_EDUCATION", answer.trim(), null);
    }
    return this.result(context, "FAILED", null, null, "UNSUPPORTED_CONVERSATION_ACTION");
  }

  private result(context: Aida3ExpertContext, status: "COMPLETED" | "FAILED", decision: string | null,
    summary: string | null, errorCode: string | null): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status, subject: context.task.subject, decision,
      patientSummary: summary, data: {}, missingUserFields: [], errorCode };
  }
}
