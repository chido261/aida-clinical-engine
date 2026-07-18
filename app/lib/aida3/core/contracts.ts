export type Aida3TurnId = string;
export type Aida3TaskId = string;
export type Aida3ExpertId = string;

export type Aida3ResponseLength = "SHORT" | "MEDIUM" | "DETAILED";

export type Aida3Task = {
  id: Aida3TaskId;
  expertId: Aida3ExpertId;
  action: string;
  subject: string | null;
  input: Record<string, unknown>;
  dependsOn: Aida3TaskId[];
  required: boolean;
};

export type Aida3TurnPlan = {
  turnId: Aida3TurnId;
  originalMessage: string;
  tasks: Aida3Task[];
  responseLength: Aida3ResponseLength;
  relevantContext: Record<string, unknown>;
};

export type Aida3ExpertResultStatus =
  | "COMPLETED"
  | "NEEDS_USER_INPUT"
  | "FAILED"
  | "BLOCKED";

export type Aida3ExpertResult = {
  taskId: Aida3TaskId;
  expertId: Aida3ExpertId;
  status: Aida3ExpertResultStatus;
  subject: string | null;
  decision: string | null;
  patientSummary: string | null;
  data: Record<string, unknown>;
  missingUserFields: string[];
  errorCode: string | null;
};

export type Aida3AggregatedTurn = {
  turnId: Aida3TurnId;
  originalMessage: string;
  responseLength: Aida3ResponseLength;
  complete: boolean;
  results: Aida3ExpertResult[];
  missingRequiredTasks: Aida3TaskId[];
  missingUserFields: string[];
  failures: Array<{ taskId: Aida3TaskId; errorCode: string }>;
};

export type Aida3TurnOutcome =
  | { status: "READY_FOR_HUMANIZER"; bundle: Aida3AggregatedTurn }
  | { status: "NEEDS_USER_INPUT"; bundle: Aida3AggregatedTurn }
  | { status: "EXECUTION_FAILED"; bundle: Aida3AggregatedTurn };

