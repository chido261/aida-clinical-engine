export type Aida2TaskGraphOutcome =
  | { status: "NOT_APPLICABLE" }
  | { status: "COMPLETED"; content: string }
  | { status: "NEEDS_CLARIFICATION"; missingObligations: string[] }
  | { status: "EXECUTION_FAILED"; violations: string[] };

export function composeTaskGraphOutcome(outcome: Aida2TaskGraphOutcome) {
  if (outcome.status === "COMPLETED") return outcome.content;
  if (outcome.status === "NEEDS_CLARIFICATION") {
    const missing = outcome.missingObligations.filter(Boolean);
    return missing.length > 0
      ? `Entendí varias solicitudes, pero necesito aclarar esta parte antes de responder todo: ${missing.join("; ")}.`
      : "Entendí varias solicitudes, pero necesito una aclaración para asegurarme de responderlas todas juntas.";
  }
  if (outcome.status === "EXECUTION_FAILED") {
    return `No pude completar correctamente todas las partes de la solicitud. Falta resolver: ${outcome.violations.join("; ")}.`;
  }
  return "";
}
