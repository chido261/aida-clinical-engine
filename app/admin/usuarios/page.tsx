"use client";

import { useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string;
  licenseStatus: string;
  licenseLabel: string;
  phoneE164: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  fullStartedAt: string | null;
  fullEndsAt: string | null;
  lastMsgAt: string | null;
  totalMsgCount: number;
  dailyMsgDate: string | null;
  dailyMsgCount: number | null;
  baselineA1c: number | null;
  baselineAvgGlucose: number | null;
  baselineSetAt: string | null;
  clinicalState: string | null;
  pendingFollowUpType: string | null;
  pendingFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const ADMIN_KEY_STORAGE = "aida_admin_key_v1";

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

function getLicenseBadgeStyle(status: string): React.CSSProperties {
  if (status === "active") {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (status === "expired") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (status === "maintenance") {
    return {
      background: "#dbeafe",
      color: "#1e40af",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
  };
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");

  const totalActive = useMemo(
    () => users.filter((user) => user.licenseStatus === "active").length,
    [users]
  );

  const totalTrial = useMemo(
    () => users.filter((user) => user.licenseStatus === "trial").length,
    [users]
  );

  const totalExpired = useMemo(
    () => users.filter((user) => user.licenseStatus === "expired").length,
    [users]
  );

  function getAdminHeaders(keyOverride?: string) {
    const key = keyOverride ?? adminKey;

    return {
      "x-aida-admin-key": key,
    };
  }

  async function loadUsers(keyOverride?: string) {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
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

        throw new Error(data?.error || "No se pudieron cargar los usuarios.");
      }

      setUsers(data?.users ?? []);
      setIsAuthorized(true);
    } catch (err: any) {
      setError(err?.message || "Error al cargar usuarios.");
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
    await loadUsers(cleanKey);
  }

  function handleLogout() {
    clearAdminKey();
    setAdminKey("");
    setUsers([]);
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
    loadUsers(savedKey);
  }, []);

  if (!isAuthorized) {
    return (
      <main style={pageStyle}>
        <section style={{ maxWidth: 460, margin: "0 auto" }}>
          <div style={cardStyle}>
            <div style={badgeStyle}>Panel admin</div>

            <h1 style={titleStyle}>Acceso protegido</h1>

            <p style={paragraphStyle}>
              Escribe tu clave de administrador para revisar los usuarios de
              AIDA.
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
      <section style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <a
            href="/admin/activaciones"
            style={{
              display: "inline-flex",
              color: "#111827",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            ← Ver activaciones
          </a>

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

                <h1 style={titleStyle}>Usuarios de AIDA</h1>

                <p style={paragraphStyle}>
                  Aquí puedes revisar usuarios registrados, estado de licencia,
                  uso del chat, fechas y seguimiento clínico básico.
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
            <div style={metricLabelStyle}>Total usuarios</div>
            <div style={metricValueStyle}>{users.length}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Activos</div>
            <div style={metricValueStyle}>{totalActive}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>En prueba</div>
            <div style={metricValueStyle}>{totalTrial}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Expirados</div>
            <div style={metricValueStyle}>{totalExpired}</div>
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
            <div style={{ fontWeight: 900 }}>Últimos usuarios</div>

            <button
              type="button"
              onClick={() => loadUsers()}
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
              Cargando usuarios...
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: 18, color: "#6b7280" }}>
              Todavía no hay usuarios registrados.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thStyle}>Usuario</th>
                    <th style={thStyle}>Licencia</th>
                    <th style={thStyle}>Celular</th>
                    <th style={thStyle}>Trial</th>
                    <th style={thStyle}>Versión completa</th>
                    <th style={thStyle}>Uso</th>
                    <th style={thStyle}>Baseline</th>
                    <th style={thStyle}>Seguimiento</th>
                    <th style={thStyle}>Última actividad</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900 }}>
                          {user.id.slice(0, 8)}...
                        </div>
                        <div style={mutedStyle}>{user.id}</div>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            borderRadius: 999,
                            padding: "5px 8px",
                            fontSize: 12,
                            fontWeight: 900,
                            ...getLicenseBadgeStyle(user.licenseStatus),
                          }}
                        >
                          {user.licenseLabel}
                        </span>
                      </td>

                      <td style={tdStyle}>{user.phoneE164 || "—"}</td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Inicio:</strong> {formatDate(user.trialStartedAt)}
                        </div>
                        <div>
                          <strong>Fin:</strong> {formatDate(user.trialEndsAt)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Inicio:</strong> {formatDate(user.fullStartedAt)}
                        </div>
                        <div>
                          <strong>Fin:</strong> {formatDate(user.fullEndsAt)}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Total:</strong> {user.totalMsgCount ?? 0}
                        </div>
                        <div>
                          <strong>Hoy:</strong>{" "}
                          {user.dailyMsgCount ?? 0}
                          {user.dailyMsgDate ? ` / ${user.dailyMsgDate}` : ""}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>A1c:</strong>{" "}
                          {user.baselineA1c != null ? user.baselineA1c : "—"}
                        </div>
                        <div>
                          <strong>Promedio:</strong>{" "}
                          {user.baselineAvgGlucose != null
                            ? `${user.baselineAvgGlucose} mg/dL`
                            : "—"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Clínico:</strong>{" "}
                          {user.clinicalState || "—"}
                        </div>
                        <div>
                          <strong>Pendiente:</strong>{" "}
                          {user.pendingFollowUpType || "—"}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div>
                          <strong>Último mensaje:</strong>{" "}
                          {formatDate(user.lastMsgAt)}
                        </div>
                        <div>
                          <strong>Actualizado:</strong>{" "}
                          {formatDate(user.updatedAt)}
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

const mutedStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#6b7280",
  fontSize: 12,
  maxWidth: 190,
  overflow: "hidden",
  textOverflow: "ellipsis",
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