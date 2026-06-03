"use client";

import { useEffect, useMemo, useState } from "react";

type Payment = {
  id: number;
  provider: string;
  providerPaymentId: string | null;
  providerRef: string | null;
  status: string;
  amount: number;
  currency: string;
  plan: string;
  durationDays: number;
  phoneE164: string;
  deviceId: string | null;
  activationCodeId: number | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  activationCode: string | null;
  activationStatus: string | null;
  activationFullStartedAt: string | null;
  activationFullEndsAt: string | null;
  activationCurrentDeviceId: string | null;
};

const ADMIN_KEY_STORAGE = "aida_admin_key_v1";

function formatMoneyCents(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getPlanLabel(plan: string) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  return plan || "—";
}

function getStatusLabel(status: string) {
  if (status === "created") return "Creado";
  if (status === "pending") return "Pendiente";
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "cancelled") return "Cancelado";
  if (status === "refunded") return "Reembolsado";
  return status || "—";
}

function getStatusStyle(status: string) {
  if (status === "approved") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (status === "rejected" || status === "cancelled" || status === "refunded") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
  };
}

export default function AdminPagosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");

  const totalApproved = useMemo(
    () => payments.filter((payment) => payment.status === "approved").length,
    [payments]
  );

  const totalPending = useMemo(
    () =>
      payments.filter(
        (payment) => payment.status === "created" || payment.status === "pending"
      ).length,
    [payments]
  );

  const totalApprovedAmount = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "approved")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments]
  );

  function getSavedAdminKey() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
  }

  function saveAdminKey(value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_KEY_STORAGE, value);
  }

  function clearAdminKey() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ADMIN_KEY_STORAGE);
  }

  function getAdminHeaders(keyOverride?: string) {
    const key = keyOverride ?? adminKey;

    return {
      "x-aida-admin-key": key,
    };
  }

  async function loadPayments(keyOverride?: string) {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/payments", {
        cache: "no-store",
        headers: getAdminHeaders(keyOverride),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setIsAuthorized(false);
          throw new Error("Clave incorrecta o acceso no autorizado.");
        }

        throw new Error(data?.error || "No se pudieron cargar los pagos.");
      }

      setPayments(data?.payments ?? []);
      setIsAuthorized(true);
    } catch (err: any) {
      setError(err?.message || "Error al cargar pagos.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanKey = adminKey.trim();

    if (!cleanKey) {
      setError("Escribe la clave de administrador.");
      return;
    }

    saveAdminKey(cleanKey);
    await loadPayments(cleanKey);
  }

  function handleLogout() {
    clearAdminKey();
    setAdminKey("");
    setPayments([]);
    setIsAuthorized(false);
    setError("");
  }

  useEffect(() => {
    const savedKey = getSavedAdminKey();

    if (!savedKey) {
      setIsAuthorized(false);
      return;
    }

    setAdminKey(savedKey);
    loadPayments(savedKey);
  }, []);

  if (!isAuthorized) {
    return (
      <main style={pageStyle}>
        <section style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={cardStyle}>
            <div style={badgeStyle}>Panel admin</div>

            <h1 style={titleStyle}>Acceso protegido</h1>

            <p style={paragraphStyle}>
              Escribe tu clave de administrador para revisar los pagos de AIDA.
            </p>

            <form onSubmit={handleAdminLogin} style={{ marginTop: 18 }}>
              <label
                htmlFor="adminKey"
                style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                Clave admin
              </label>

              <input
                id="adminKey"
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Escribe tu clave"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #d1d5db",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 16,
                  outline: "none",
                }}
              />

              {error ? <div style={errorBoxStyle}>{error}</div> : null}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  marginTop: 14,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "white",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "Verificando..." : "Entrar al panel"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <a href="/pago" style={topLinkStyle}>
              ← Volver a pagos
            </a>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a href="/admin/activaciones" style={topLinkStyle}>
                Ver activaciones →
              </a>

              <a href="/admin/usuarios" style={topLinkStyle}>
                Ver usuarios →
              </a>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={badgeStyle}>Panel admin</div>

                <h1 style={titleStyle}>Pagos Mercado Pago</h1>

                <p style={paragraphStyle}>
                  Aquí puedes revisar pagos, estatus, teléfono, plan y clave
                  generada o renovada.
                </p>
              </div>

              <button type="button" onClick={handleLogout} style={dangerButtonStyle}>
                Cerrar acceso
              </button>
            </div>
          </div>
        </div>

        <div style={metricsGridStyle}>
          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Total pagos</div>
            <div style={metricValueStyle}>{payments.length}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Aprobados</div>
            <div style={metricValueStyle}>{totalApproved}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Pendientes</div>
            <div style={metricValueStyle}>{totalPending}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Total aprobado</div>
            <div style={metricValueStyle}>
              {formatMoneyCents(totalApprovedAmount)}
            </div>
          </div>
        </div>

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        <div style={tableCardStyle}>
          <div style={tableHeaderStyle}>
            <div style={{ fontWeight: 900 }}>Últimos pagos</div>

            <button
              type="button"
              onClick={() => loadPayments()}
              disabled={isLoading}
              style={actionButtonStyle}
            >
              {isLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1180,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>Pago</th>
                  <th style={thStyle}>Mercado Pago</th>
                  <th style={thStyle}>Celular</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Monto</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Clave</th>
                  <th style={thStyle}>Vigencia</th>
                  <th style={thStyle}>Fechas</th>
                </tr>
              </thead>

              <tbody>
                {payments.length ? (
                  payments.map((payment) => (
                    <tr key={payment.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>
                        <div style={strongStyle}>#{payment.id}</div>
                        <div style={mutedStyle}>{payment.provider}</div>
                      </td>

                      <td style={tdStyle}>
                        <div style={strongStyle}>
                          {payment.providerPaymentId ?? "—"}
                        </div>
                        <div style={mutedStyle}>
                          Ref: {payment.providerRef ?? "—"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={strongStyle}>{payment.phoneE164}</div>
                        <div style={mutedStyle}>
                          Device: {payment.deviceId ?? "—"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={strongStyle}>{getPlanLabel(payment.plan)}</div>
                        <div style={mutedStyle}>{payment.durationDays} días</div>
                      </td>

                      <td style={tdStyle}>
                        <div style={strongStyle}>
                          {formatMoneyCents(payment.amount, payment.currency)}
                        </div>
                        <div style={mutedStyle}>{payment.currency}</div>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            ...statusBadgeStyle,
                            ...getStatusStyle(payment.status),
                          }}
                        >
                          {getStatusLabel(payment.status)}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div style={strongStyle}>
                          {payment.activationCode ?? "—"}
                        </div>
                        <div style={mutedStyle}>
                          {payment.activationCodeId
                            ? `ID: ${payment.activationCodeId}`
                            : "Sin clave vinculada"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Inicio:</strong>{" "}
                          {formatDate(payment.activationFullStartedAt)}
                        </div>
                        <div style={mutedStyle}>
                          <strong>Vence:</strong>{" "}
                          {formatDate(payment.activationFullEndsAt)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Creado:</strong> {formatDate(payment.createdAt)}
                        </div>
                        <div style={mutedStyle}>
                          <strong>Aprobado:</strong>{" "}
                          {formatDate(payment.approvedAt)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={tdStyle} colSpan={9}>
                      No hay pagos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f9fafb",
  color: "#111827",
  padding: "32px 18px",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
};

const smallCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  background: "#111827",
  color: "white",
  fontSize: 13,
  fontWeight: 900,
  padding: "8px 12px",
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
  fontWeight: 500,
  letterSpacing: "-0.04em",
};

const paragraphStyle: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#4b5563",
  fontSize: 16,
  lineHeight: 1.5,
};

const topLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  fontWeight: 900,
};

const metricValueStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 30,
  fontWeight: 900,
};

const tableCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 13,
  color: "#374151",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  verticalAlign: "top",
  fontSize: 14,
  color: "#111827",
};

const strongStyle: React.CSSProperties = {
  fontWeight: 900,
};

const mutedStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 13,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 900,
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const actionButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  borderRadius: 12,
  padding: "9px 12px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontWeight: 700,
  fontSize: 14,
};