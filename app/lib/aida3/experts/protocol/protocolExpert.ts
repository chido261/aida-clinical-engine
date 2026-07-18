import type { Aida3ExpertResult } from "../../core/contracts";
import type { Aida3Expert, Aida3ExpertContext } from "../../core/expert";
import type { ProtocolId } from "../../protocols/contracts";
import { GET_CURRENT_PROTOCOL_ACTION, PROTOCOL_EXPERT_ID } from "./contracts";

const descriptions: Record<ProtocolId, string> = {
  DIAGNOSTICO_7_DIAS: "Estás en el protocolo de diagnóstico de 7 días.",
  FASE_1: "Estás en la Fase 1.",
  FASE_2: "Estás en la Fase 2.",
};

export class ProtocolExpert implements Aida3Expert {
  readonly id = PROTOCOL_EXPERT_ID;

  async execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult> {
    const protocolId = context.task.input.protocolId;
    if (context.task.action !== GET_CURRENT_PROTOCOL_ACTION) return this.failed(context, "UNSUPPORTED_PROTOCOL_ACTION");
    if (!(typeof protocolId === "string" && protocolId in descriptions)) return this.failed(context, "INVALID_PROTOCOL_ID");
    return { taskId: context.task.id, expertId: this.id, status: "COMPLETED", subject: context.task.subject,
      decision: "CURRENT_PROTOCOL", patientSummary: descriptions[protocolId as ProtocolId], data: { protocolId },
      missingUserFields: [], errorCode: null };
  }

  private failed(context: Aida3ExpertContext, errorCode: string): Aida3ExpertResult {
    return { taskId: context.task.id, expertId: this.id, status: "FAILED", subject: context.task.subject,
      decision: null, patientSummary: null, data: {}, missingUserFields: [], errorCode };
  }
}
