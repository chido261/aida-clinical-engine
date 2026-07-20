export type StructuredSpecialistDefinition = {
  id: string;
  instructions: readonly string[];
  outputName: string;
  outputSchema: Record<string, unknown>;
  timeoutMs?: number;
};

export interface StructuredSpecialistClient {
  run<T>(definition: StructuredSpecialistDefinition, input: unknown): Promise<T>;
}
