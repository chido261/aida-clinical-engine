import type { Aida3ExpertResult } from "../../core/contracts";
import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import { ANSWER_GENERAL_ACTION, CONVERSATION_EXPERT_ID, GREET_ACTION } from "./contracts";

export class ConversationExpert implements Aida3Expert {
  readonly id = CONVERSATION_EXPERT_ID;

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    if (context.task.action === GREET_ACTION) {
      return this.result(context, "COMPLETED", "GREETING", "¡Hola! ¿En qué te ayudo?", null);
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
