"use client";

import { useEffect, useMemo, useState } from "react";

type ActivationRequest = {
  id: number;
  deviceId: string;
  name: string;
  phone: string;
  plan: string;
  price: number;
  duration: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  phoneE164: string;
  activationCodeId: number | null;
  activationCode: string | null;
  activationStatus: string | null;
  activationActivatedAt: string | null;
  activationCreatedAt: string | null;
  activationFullStartedAt: string | null;
  activationFullEndsAt: string | null;
  activationCurrentDeviceId: string | null;
  deviceSessionActive: boolean;
  deviceSessionCreatedAt: string | null;
  deviceSessionDisabledAt: string | null;
  activationRelation: "same_request" | "phone_current_code" | "none";
  isRenewalLike: boolean;
  activationNotice: string;
  hasRepeatedPhone: boolean;
};

const ADMIN_KEY_STORAGE = "aida_admin_key_v1";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
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

function getStatusLabel(status: string) {
  if (status === "pending") return "Pendiente";
  if (status === "paid") return "Pagado";
  if (status === "activated") return "Activado";
  if (status === "cancelled") return "Cancelado";
  return status;
}

function getPlanLabel(plan: string) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  return plan;
}

function getRelationLabel(request: ActivationRequest) {
  if (request.activationRelation === "same_request") {
    return "Coincide con el dispositivo activo.";
  }

  if (request.activationRelation === "phone_current_code") {
    return "Solicitud histórica: muestra la clave actual del teléfono.";
  }

  return "Sin clave activa vinculada.";
}

export default function AdminActivacionesPage() {
  const [requests, setRequests] = useState<ActivationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");

  const totalPending = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const totalActivated = useMemo(
    () => requests.filter((r) => r.status === "activated").length,
    [requests]
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

  async function loadRequests(keyOverride?: string) {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/activation-requests", {
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

        throw new Error(data?.error || "No se pudieron cargar las solicitudes.");
      }

      setRequests(data?.activationRequests ?? []);
      setIsAuthorized(true);
    } catch (err: any) {
      setError(err?.message || "Error al cargar solicitudes.");
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
    await loadRequests(cleanKey);
  }

  function handleLogout() {
    clearAdminKey();
    setAdminKey("");
    setRequests([]);
    setIsAuthorized(false);
    setError("");
  }

  async function updateRequestStatus(id: number, status: string) {
    const confirmText =
      status === "paid"
        ? "¿Marcar esta solicitud como pagada?"
        : status === "activated"
          ? "¿Activar esta solicitud?"
          : status === "cancelled"
            ? "¿Cancelar esta solicitud?"
            : "¿Cambiar estado?";

    const ok = window.confirm(confirmText);
    if (!ok) return;

    setError("");

    try {
      const res = await fetch("/api/admin/activation-requests/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          id,
          status,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setIsAuthorized(false);
          throw new Error("Clave incorrecta o acceso no autorizado.");
        }

        throw new Error(data?.error || "No se pudo actualizar la solicitud.");
      }

      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar solicitud.");
    }
  }

  useEffect(() => {
    const savedKey = getSavedAdminKey();

    if (!savedKey) {
      setIsAuthorized(false);
      return;
    }

    setAdminKey(savedKey);
    loadRequests(savedKey);
  }, []);

  if (!isAuthorized) {
    return (
      <main style={pageStyle}>
        <section style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={cardStyle}>
            <div style={badgeStyle}>Panel admin</div>

            <h1 style={titleStyle}>Acceso protegido</h1>

            <p style={paragraphStyle}>
              Escribe tu clave de administrador para revisar y activar
              solicitudes de AIDA.
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

              {error ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    borderRadius: 12,
                    padding: 12,
                    color: "#991b1b",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {error}
                </div>
              ) : null}

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
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
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
            <a
              href="/pago"
              style={{
                display: "inline-flex",
                color: "#111827",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              ← Volver a pagos
            </a>

            <a
              href="/admin/usuarios"
              style={{
                display: "inline-flex",
                color: "#111827",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              Ver usuarios →
            </a>
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

                <h1 style={titleStyle}>Solicitudes de activación</h1>

                <p style={paragraphStyle}>
                  Aquí puedes revisar solicitudes, marcar pagos, activar accesos
                  o cancelar registros.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={dangerButtonStyle}
              >
                Cerrar acceso
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Total solicitudes</div>
            <div style={metricValueStyle}>{requests.length}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Pendientes</div>
            <div style={metricValueStyle}>{totalPending}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Activadas</div>
            <div style={metricValueStyle}>{totalActivated}</div>
          </div>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 14,
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 900 }}>Últimas solicitudes</div>

            <button
              type="button"
              onClick={() => loadRequests()}
              disabled={isLoading}
              style={actionButtonStyle}
            >
              {isLoading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          {error ? (
            <div
              style={{
                margin: 14,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                borderRadius: 12,
                padding: 12,
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div style={{ padding: 18, color: "#6b7280" }}>
              Cargando solicitudes...
            </div>
          ) : requests.length === 0 ? (
            <div style={{ padding: 18, color: "#6b7280" }}>
              Todavía no hay solicitudes registradas.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 1600,
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thStyle}>Folio</th>
                    <th style={thStyle}>Nombre</th>
                    <th style={thStyle}>Celular</th>
                    <th style={thStyle}>Plan</th>
                    <th style={thStyle}>Clave</th>
                    <th style={thStyle}>Dispositivo</th>
                    <th style={thStyle}>Activación</th>
                    <th style={thStyle}>Vigencia</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      style={{ borderTop: "1px solid #e5e7eb" }}
                    >
                      <td style={tdStyle}>#{request.id}</td>

                      <td style={tdStyle}>{request.name}</td>

                      <td style={tdStyle}>
                        <div>{request.phone}</div>

                        <div
                          style={{
                            color: "#6b7280",
                            marginTop: 3,
                            fontSize: 12,
                          }}
                        >
                          {request.phoneE164}
                        </div>

                        {request.hasRepeatedPhone ? (
                          <div
                            style={{
                              display: "inline-flex",
                              marginTop: 6,
                              borderRadius: 999,
                              padding: "4px 7px",
                              background: "#fef3c7",
                              color: "#92400e",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            Teléfono repetido
                          </div>
                        ) : null}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900 }}>
                          {getPlanLabel(request.plan)}
                        </div>

                        <div
                          style={{
                            color: "#6b7280",
                            marginTop: 3,
                            fontSize: 12,
                          }}
                        >
                          {formatMoney(request.price)} · {request.duration} días
                        </div>

                        {request.isRenewalLike ? (
                          <div
                            style={{
                              display: "inline-flex",
                              marginTop: 6,
                              borderRadius: 999,
                              padding: "4px 7px",
                              background: "#ecfdf5",
                              color: "#065f46",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            Renovación / historial
                          </div>
                        ) : null}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900 }}>
                          {request.activationCode || "—"}
                        </div>

                        <div
                          style={{
                            color: "#6b7280",
                            marginTop: 3,
                            fontSize: 12,
                          }}
                        >
                          {request.activationStatus
                            ? `Estado: ${request.activationStatus}`
                            : "Sin clave"}
                        </div>

                        <div
                          style={{
                            marginTop: 6,
                            color:
                              request.activationRelation === "same_request"
                                ? "#166534"
                                : request.activationRelation ===
                                    "phone_current_code"
                                  ? "#92400e"
                                  : "#6b7280",
                            fontSize: 12,
                            fontWeight: 800,
                            maxWidth: 230,
                            lineHeight: 1.35,
                            whiteSpace: "normal",
                          }}
                        >
                          {getRelationLabel(request)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900 }}>
                          {request.deviceSessionActive ? "Activo" : "—"}
                        </div>

                        <div
                          style={{
                            color: "#6b7280",
                            marginTop: 3,
                            fontSize: 12,
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {request.activationCurrentDeviceId ||
                            "Sin dispositivo"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Activada:</strong>{" "}
                          {formatDate(request.activationActivatedAt)}
                        </div>

                        <div style={{ color: "#6b7280", marginTop: 3 }}>
                          Vinculada: {formatDate(request.deviceSessionCreatedAt)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Inicio:</strong>{" "}
                          {formatDate(request.activationFullStartedAt)}
                        </div>

                        <div style={{ color: "#6b7280", marginTop: 3 }}>
                          Vence: {formatDate(request.activationFullEndsAt)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            borderRadius: 999,
                            padding: "5px 8px",
                            fontSize: 12,
                            fontWeight: 900,
                            background:
                              request.status === "activated"
                                ? "#dcfce7"
                                : request.status === "paid"
                                  ? "#dbeafe"
                                  : request.status === "cancelled"
                                    ? "#fee2e2"
                                    : "#fef3c7",
                            color:
                              request.status === "activated"
                                ? "#166534"
                                : request.status === "paid"
                                  ? "#1e40af"
                                  : request.status === "cancelled"
                                    ? "#991b1b"
                                    : "#92400e",
                          }}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      </td>

                      <td style={tdStyle}>{formatDate(request.createdAt)}</td>

                      <td style={tdStyle}>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          {request.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request.id, "paid")
                                }
                                style={actionButtonStyle}
                              >
                                Marcar pagado
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request.id, "cancelled")
                                }
                                style={dangerButtonStyle}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}

                          {request.status === "paid" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request.id, "activated")
                                }
                                style={primaryButtonStyle}
                              >
                                Activar acceso
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateRequestStatus(request.id, "cancelled")
                                }
                                style={dangerButtonStyle}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : null}

                          {request.status === "activated" ? (
                            <span style={{ color: "#166534", fontWeight: 900 }}>
                              Activo
                            </span>
                          ) : null}

                          {request.status === "cancelled" ? (
                            <span style={{ color: "#991b1b", fontWeight: 900 }}>
                              Cancelado
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f9fafb",
  padding: 24,
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 22,
};

const smallCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "#111827",
  color: "white",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 30,
  color: "#111827",
};

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: 16,
  lineHeight: 1.5,
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 800,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  marginTop: 4,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  color: "#374151",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 10px",
  color: "#111827",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const actionButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};