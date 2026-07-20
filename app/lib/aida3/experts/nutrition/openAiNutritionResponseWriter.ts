import type { StructuredSpecialistClient, StructuredSpecialistDefinition } from "../../specialists";
import type { NutritionNarrativeInput, NutritionResponseWriter } from "./contracts";

const DEFINITION: StructuredSpecialistDefinition = {
  id: "NUTRITION",
  outputName: "aida3_nutrition_response",
  instructions: [
    "Eres el especialista en nutrición de AIDA.",
    "Recibes decisiones ya verificadas por la herramienta del protocolo. Son definitivas: no cambies ALLOWED, CONDITIONAL, NOT_ALLOWED ni UNKNOWN.",
    "Responde directamente la duda original con lenguaje profesional, cercano y breve.",
    "Menciona todos los alimentos recibidos y conserva exactamente el sentido de reason.",
    "ALLOWED significa compatible; NOT_ALLOWED significa que no se recomienda; CONDITIONAL exige explicar la condición disponible; UNKNOWN no puede confirmarse.",
    "No inventes porciones, sustituciones, diagnósticos, tratamientos ni reglas que no estén en los datos.",
    "No menciones módulos, herramientas, códigos internos ni nombres técnicos de categorías.",
    "Usa texto plano. Si hay varios alimentos, sepáralos en frases claras; evita listas salvo que el usuario las solicite.",
  ],
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["patientSummary"],
    properties: { patientSummary: { type: "string", minLength: 1 } },
  },
};

export class OpenAiNutritionResponseWriter implements NutritionResponseWriter {
  constructor(private readonly specialist: StructuredSpecialistClient) {}

  async write(input: NutritionNarrativeInput): Promise<string> {
    const output = await this.specialist.run<{ patientSummary: string }>(DEFINITION, input);
    const summary = output.patientSummary?.trim();
    if (!summary) throw new Error("AIDA3_NUTRITION_EMPTY_NARRATIVE");
    return summary;
  }
}
