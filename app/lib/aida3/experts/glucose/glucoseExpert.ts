import type { Aida3ExpertResult } from "../../core/contracts";
import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import { GLUCOSE_EXPERT_ID, RECORD_READING_ACTION, type GlucoseReading } from "./contracts";

function reading(input: Record<string, unknown>): GlucoseReading | null {
  const value = input.valueMgDl;
  const moment = input.moment;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 20 || value > 600) return null;
  if (moment !== null && typeof moment !== "string") return null;
  return { valueMgDl: value, moment: moment as string | null };
}

export class GlucoseExpert implements Aida3Expert {
  readonly id = GLUCOSE_EXPERT_ID;

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    if (context.task.action !== RECORD_READING_ACTION) return this.failed(context, "UNSUPPORTED_GLUCOSE_ACTION");
    const value = reading(context.task.input);
    if (!value) return this.failed(context, "INVALID_GLUCOSE_READING");
    const moment = value.moment ? ` (${value.moment})` : "";
    return { taskId: context.task.id, expertId: this.id, status: "COMPLETED", subject: context.task.subject,
      decision: "READING_ACCEPTED", patientSummary: `Registré ${value.valueMgDl} mg/dL${moment}.`,
      data: { reading: value }, missingUserFields: [], errorCode: null };
  }

  private failed(context: Aida3ExpertContext, errorCode: string): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status: "FAILED", subject: context.task.subject,
      decision: null, patientSummary: null, data: {}, missingUserFields: [], errorCode };
  }
}
