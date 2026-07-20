import type OpenAI from "openai";
import type { StructuredSpecialistClient, StructuredSpecialistDefinition } from "./contracts";

export class OpenAiStructuredSpecialistClient implements StructuredSpecialistClient {
  constructor(private readonly openai: OpenAI,
    private readonly model = process.env.OPENAI_SPECIALIST_MODEL ?? "gpt-4.1-mini") {}

  async run<T>(definition: StructuredSpecialistDefinition, input: unknown): Promise<T> {
    const response = await this.openai.responses.create({
      model: this.model,
      instructions: definition.instructions.join("\n"),
      input: JSON.stringify(input),
      text: { format: { type: "json_schema", name: definition.outputName, strict: true,
        schema: definition.outputSchema } },
    }, { timeout: definition.timeoutMs ?? Number(process.env.OPENAI_SPECIALIST_TIMEOUT_MS ?? 12_000),
      maxRetries: 0 });
    const output = response.output_text?.trim();
    if (!output) throw new Error(`AIDA3_SPECIALIST_EMPTY_OUTPUT:${definition.id}`);
    try {
      return JSON.parse(output) as T;
    } catch {
      throw new Error(`AIDA3_SPECIALIST_INVALID_JSON:${definition.id}`);
    }
  }
}
