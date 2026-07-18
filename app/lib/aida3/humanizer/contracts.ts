import type { Aida3AggregatedTurn, Aida3ResponseLength } from "../core/contracts";

export type HumanizedPart = { taskId: string; decision: string | null; text: string };

export type HumanizedResponse = {
  parts: HumanizedPart[];
};

export type HumanizerInput = {
  responseLength: Aida3ResponseLength;
  originalMessage: string;
  results: Aida3AggregatedTurn["results"];
};

export interface HumanizerProvider {
  humanize(input: HumanizerInput): Promise<HumanizedResponse>;
}

export type ComposedTurnResponse = {
  text: string;
  source: "ASSEMBLER" | "HUMANIZER" | "CLARIFICATION" | "FAILURE";
  coveredTaskIds: string[];
};
