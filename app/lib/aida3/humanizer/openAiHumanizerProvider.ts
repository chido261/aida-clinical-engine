import type OpenAI from "openai";
import type { HumanizedResponse, HumanizerInput, HumanizerProvider } from "./contracts";

const SCHEMA = { type: "object", additionalProperties: false, required: ["parts"], properties: {
  parts: { type: "array", items: { type: "object", additionalProperties: false,
    required: ["taskId", "decision", "text"], properties: { taskId: { type: "string" },
      decision: { type: ["string", "null"] }, text: { type: "string" } } } },
} } as const;

function parse(value: string): HumanizedResponse {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("AIDA3_HUMANIZER_INVALID_JSON"); }
  const record = parsed as Partial<HumanizedResponse>;
  if (!record || !Array.isArray(record.parts) || !record.parts.every(item => item &&
    typeof item.taskId === "string" && typeof item.text === "string" &&
    (typeof item.decision === "string" || item.decision === null))) throw new Error("AIDA3_HUMANIZER_INVALID_OUTPUT");
  return record as HumanizedResponse;
}

export class OpenAiHumanizerProvider implements HumanizerProvider {
  constructor(private readonly openai: OpenAI, private readonly model = process.env.OPENAI_HUMANIZER_MODEL ?? "gpt-5.6-sol") {}

  async humanize(input: HumanizerInput): Promise<HumanizedResponse> {
    const response = await this.openai.responses.create({ model: this.model,
      instructions: [
        "Eres la voz final de AIDA. Redacta una sola respuesta cálida, clara y natural en español.",
        "No tomes decisiones nuevas, no cambies decisiones y no agregues alimentos, restricciones ni datos ausentes.",
        "Devuelve un part por cada resultado. Copia taskId y decision sin modificarlos.",
        "En el text de cada part conserva literalmente nombres de opciones, bebidas, alimentos y pasos recibidos.",
        "SHORT debe ser breve; MEDIUM sólo lo necesario; DETAILED se usa para pasos o explicación solicitada.",
        "No muestres códigos internos, nombres de módulos ni palabras como ALLOWED o NOT_ALLOWED.",
      ].join("\n"), input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: "aida3_humanized_response", strict: true, schema: SCHEMA } },
    });
    const output = response.output_text?.trim();
    if (!output) throw new Error("AIDA3_HUMANIZER_EMPTY_OUTPUT");
    return parse(output);
  }
}
