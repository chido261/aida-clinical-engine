"use client";

import { useEffect, useState } from "react";

import { getDeviceId } from "@/app/lib/deviceId";

type Review = {
  id: number;
  weekStart: string;
  recordedReadings: number;
  completionPercent: number;
  controlledPercent: number;
  hypoglycemiaCount: number;
  passed: boolean;
};

type SimulatorStatus = {
  user: {
    activePhase: string;
    activeProtocol: string;
    licenseStatus: string;
    trialEndsAt: string | null;
    medicationReductionPercent: number;
    eligibleForNextProtocol: boolean;
    protocolReviewReason: string | null;
  } | null;
  readingCount: number;
  reviews: Review[];
};

type Action =
  | "STATUS"
  | "RESET_DIAGNOSTIC"
  | "EXPIRE_TRIAL"
  | "ACTIVATE_PHASE_1"
  | "LOAD_PASSING_WEEK"
  | "CONFIRM_MEDICATION_REDUCTION"
  | "RUN_WEEKLY_REVIEW";

const buttonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
} as const;

export default function Aida2TestsPage() {
  const [deviceId, setDeviceId] = useState("");
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [message, setMessage] = useState("Cargando...");
  const [busy, setBusy] = useState(false);

  async function run(action: Action, weekOffset = 0) {
    if (!deviceId || busy) return;
    setBusy(true);
    setMessage(`Ejecutando ${action}...`);

    try {
      const response = await fetch("/api/dev/aida2-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, action, weekOffset }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo ejecutar la prueba.");
      }
      setStatus(data.status);
      setMessage(`Listo: ${action}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    void run("STATUS");
    // La carga inicial debe ejecutarse una sola vez al resolver deviceId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Simulador local de AIDA2</h1>
          <p style={{ marginTop: 0, color: "#475569" }}>Solo funciona con <code>npm run dev</code>.</p>
        </div>
        <a href="/chat2" style={{ color: "#1d4ed8", fontWeight: 800 }}>Volver al chat</a>
      </div>

      <section style={{ padding: 16, borderRadius: 14, background: "#f1f5f9", marginBottom: 18 }}>
        <div><strong>Dispositivo:</strong> {deviceId || "Cargando..."}</div>
        <div style={{ marginTop: 6 }}><strong>Resultado:</strong> {message}</div>
      </section>

      <section style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <button style={buttonStyle} disabled={busy} onClick={() => run("RESET_DIAGNOSTIC")}>1. Reiniciar en Diagnóstico</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("EXPIRE_TRIAL")}>2. Vencer prueba</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("ACTIVATE_PHASE_1")}>3. Activar Fase 1</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("LOAD_PASSING_WEEK", 1)}>4. Cargar semana anterior</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("RUN_WEEKLY_REVIEW", 1)}>5. Evaluar semana anterior</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("LOAD_PASSING_WEEK", 0)}>6. Cargar semana actual</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("CONFIRM_MEDICATION_REDUCTION")}>7. Confirmar reducción 51%</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("RUN_WEEKLY_REVIEW", 0)}>8. Evaluar y avanzar</button>
        <button style={buttonStyle} disabled={busy} onClick={() => run("STATUS")}>Actualizar estado</button>
      </section>

      {status ? (
        <section style={{ marginTop: 22 }}>
          <h2>Estado actual</h2>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatusCard label="Licencia" value={status.user?.licenseStatus ?? "—"} />
            <StatusCard label="Fase" value={status.user?.activePhase ?? "—"} />
            <StatusCard label="Lecturas" value={String(status.readingCount)} />
            <StatusCard label="Reducción" value={`${status.user?.medicationReductionPercent ?? 0}%`} />
          </div>

          <p style={{ color: "#475569" }}>
            {status.user?.protocolReviewReason ?? "Sin evaluación de avance."}
          </p>

          <h2>Revisiones semanales</h2>
          {status.reviews.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>Semana</Th><Th>Lecturas</Th><Th>Cumplimiento</Th><Th>Control</Th><Th>Hipos</Th><Th>Resultado</Th></tr></thead>
                <tbody>
                  {status.reviews.map((review) => (
                    <tr key={review.id}>
                      <Td>{new Date(review.weekStart).toLocaleDateString("es-MX")}</Td>
                      <Td>{review.recordedReadings}/42</Td>
                      <Td>{review.completionPercent}%</Td>
                      <Td>{review.controlledPercent}%</Td>
                      <Td>{review.hypoglycemiaCount}</Td>
                      <Td>{review.passed ? "Aprobada" : "Pendiente"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>Aún no hay revisiones.</p>}
        </section>
      ) : null}
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 12 }}><div style={{ color: "#64748b", fontSize: 12 }}>{label}</div><strong>{value}</strong></div>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: 9, borderBottom: "1px solid #cbd5e1" }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 9, borderBottom: "1px solid #e2e8f0" }}>{children}</td>;
}

