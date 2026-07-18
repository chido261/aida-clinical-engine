import type {
  Aida3ExpertId,
  Aida3ExpertResult,
  Aida3Task,
  Aida3TurnPlan,
} from "./contracts";
import type { Aida3WorkingMemory } from "./workingMemory";

export type Aida3ExpertContext = {
  plan: Aida3TurnPlan;
  task: Aida3Task;
  memory: Aida3WorkingMemory;
  dependencyResults: Aida3ExpertResult[];
};

export interface Aida3Expert {
  readonly id: Aida3ExpertId;
  execute(context: Aida3ExpertContext): Promise<Aida3ExpertResult>;
}

