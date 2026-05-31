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
  activePlan: string | null;
  activePlanSource: string | null;
  lastMsgAt: string | null;
  totalMsgCount: number;
  dailyMsgDate: string | null;
  dailyMsgCount: number | null;
  createdAt: string;
  updatedAt: string;
  activationCodeId: number | null;
  activationCode: string | null;
  activationStatus: string | null;
  activationPhoneE164: string | null;
  activationActivatedAt: string | null;
  activationCreatedAt: string | null;
  activationFullStartedAt: string | null;
  activationFullEndsAt: string | null;
  activationCurrentDeviceId: string | null;
  deviceSessionActive: boolean;
  deviceSessionCreatedAt: string | null;
  deviceSessionDisabledAt: string | null;
};

type LicenseAction = "cancel-license" | "reset-trial";

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

function getPlanLabel(plan: string | null) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  if (plan === "manual") return "Manual";
  if (plan === "manual-30") return "30 días";
  if (plan === "manual-90") return "90 días";
  if (plan === "manual-365") return "365 días";
  return "—";
}

function getPlanSourceLabel(source: string | null) {
  if (source === "activation-code") return "Clave de activación";
  if (source === "payment") return "Pago automático";
  if (source === "activation-request") return "Solicitud";
  if (source === "manual-extension") return "Extensión manual";
  if (source === "promo") return "Promoción";
  if (source === "admin") return "Admin";
  return "—";
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");

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

  async function extendLicense(user: AdminUser, days: number) {
    const confirmText =
      days === 30
        ? `¿Extender 30 días la licencia de ${user.id.slice(0, 8)}...?`
        : days === 90
          ? `¿Extender 90 días la licencia de ${user.id.slice(0, 8)}...?`
          : `¿Extender 365 días la licencia de ${user.id.slice(0, 8)}...?`;

    const ok = window.confirm(confirmText);
    if (!ok) return;

    setError("");
    setUpdatingUserId(user.id);

    try {
      const res = await fetch("/api/admin/users/extend-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          userId: user.id,
          days,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setIsAuthorized(false);
          throw new Error("Clave incorrecta o acceso no autorizado.");
        }

        throw new Error(data?.error || "No se pudo extender la licencia.");
      }

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Error al extender licencia.");
    } finally {
      setUpdatingUserId("");
    }
  }

  async function updateLicense(user: AdminUser, action: LicenseAction) {
    const confirmText =
      action === "cancel-license"
        ? `¿Cancelar la licencia de ${user.id.slice(0, 8)}...? El usuario perderá acceso completo.`
        : `¿Reiniciar trial de ${user.id.slice(0, 8)}...? El usuario volverá a prueba gratuita de 7 días.`;

    const ok = window.confirm(confirmText);
    if (!ok) return;

    setError("");
    setUpdatingUserId(user.id);

    try {
      const res = await fetch("/api/admin/users/update-license", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          userId: user.id,
          action,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setIsAuthorized(false);
          throw new Error("Clave incorrecta o acceso no autorizado.");
        }

        throw new Error(data?.error || "No se pudo actualizar la licencia.");
      }

      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar licencia.");
    } finally {
      setUpdatingUserId("");
    }
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
              <label htmlFor="adminKey" style={labelStyle}>
                Clave admin
              </label>

              <input
                id="adminKey"
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="Escribe tu clave"
                style={inputStyle}
              />

              {error ? <div style={errorStyle}>{error}</div> : null}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  ...primaryLargeButtonStyle,
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
      <section style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={topNavStyle}>
            <a href="/admin/activaciones" style={topLinkStyle}>
              ← Ver activaciones
            </a>

            <a href="/pago" style={topLinkStyle}>
              Ver página de pagos
            </a>
          </div>

          <div style={cardStyle}>
            <div style={headerFlexStyle}>
              <div>
                <div style={badgeStyle}>Panel admin</div>

                <h1 style={titleStyle}>Usuarios de AIDA</h1>

                <p style={paragraphStyle}>
                  Vista operativa de usuarios, estado de licencia y uso general.
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

        <div style={metricsGridStyle}>
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

        <section style={tableWrapperStyle}>
          <div style={tableHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Listado de usuarios</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                Mostrando hasta 200 registros recientes
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadUsers()}
              disabled={isLoading}
              style={actionButtonStyle}
            >
              {isLoading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          {error ? <div style={errorStyle}>{error}</div> : null}

          {isLoading ? (
            <div style={emptyStyle}>Cargando usuarios...</div>
          ) : users.length === 0 ? (
            <div style={emptyStyle}>Todavía no hay usuarios registrados.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>Usuario</th>
<th style={thStyle}>Licencia</th>
<th style={thStyle}>Plan</th>
<th style={thStyle}>Celular</th>
<th style={thStyle}>Clave</th>
<th style={thStyle}>Dispositivo activo</th>
<th style={thStyle}>Activación</th>
<th style={thStyle}>Trial vence</th>
<th style={thStyle}>Plan vence</th>
<th style={thStyle}>Mensajes</th>
<th style={thStyle}>Último uso</th>
<th style={thStyle}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => {
                    const isUpdating = updatingUserId === user.id;

                    return (
                      <tr
                        key={user.id}
                        style={{ borderTop: "1px solid #e5e7eb" }}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 900 }}>
                            {user.id.slice(0, 8)}...
                          </div>
                          <div style={deviceIdStyle}>{user.id}</div>
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              borderRadius: 999,
                              padding: "5px 9px",
                              fontSize: 12,
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                              ...getLicenseBadgeStyle(user.licenseStatus),
                            }}
                          >
                            {user.licenseLabel}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <div style={planTitleStyle}>
                            {getPlanLabel(user.activePlan)}
                          </div>
                          <div style={planSourceStyle}>
                            {getPlanSourceLabel(user.activePlanSource)}
                          </div>
                        </td>

                        <td style={tdStyle}>{user.phoneE164 || "—"}</td>

                        <td style={tdStyle}>
  <div style={{ fontWeight: 900 }}>{user.activationCode || "—"}</div>
  <div style={{ color: "#6b7280", marginTop: 3, fontSize: 12 }}>
    {user.activationStatus ? `Estado: ${user.activationStatus}` : "Sin clave"}
  </div>
</td>

<td style={tdStyle}>
  <div style={{ fontWeight: 900 }}>
    {user.deviceSessionActive ? "Activo" : "—"}
  </div>
  <div style={deviceIdStyle}>
    {user.activationCurrentDeviceId || "Sin dispositivo vinculado"}
  </div>
</td>

<td style={tdStyle}>
  <div>
    <strong>Activada:</strong> {formatDate(user.activationActivatedAt)}
  </div>
  <div style={{ color: "#6b7280", marginTop: 3 }}>
    Vinculada: {formatDate(user.deviceSessionCreatedAt)}
  </div>
</td>

                        <td style={tdStyle}>{formatDate(user.trialEndsAt)}</td>

                        <td style={tdStyle}>{formatDate(user.fullEndsAt)}</td>

                        <td style={tdStyle}>
                          <div>
                            <strong>Total:</strong> {user.totalMsgCount ?? 0}
                          </div>
                          <div style={{ color: "#6b7280", marginTop: 3 }}>
                            Hoy: {user.dailyMsgCount ?? 0}
                            {user.dailyMsgDate
                              ? ` / ${user.dailyMsgDate}`
                              : ""}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div>{formatDate(user.lastMsgAt)}</div>
                          <div style={{ color: "#6b7280", marginTop: 3 }}>
                            Actualizado: {formatDate(user.updatedAt)}
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={actionsCellStyle}>
                            <button
                              type="button"
                              onClick={() => extendLicense(user, 30)}
                              disabled={isUpdating}
                              style={smallActionButtonStyle}
                            >
                              +30 días
                            </button>

                            <button
                              type="button"
                              onClick={() => extendLicense(user, 90)}
                              disabled={isUpdating}
                              style={smallActionButtonStyle}
                            >
                              +90 días
                            </button>

                            <button
                              type="button"
                              onClick={() => extendLicense(user, 365)}
                              disabled={isUpdating}
                              style={smallPrimaryButtonStyle}
                            >
                              +365 días
                            </button>

                            <button
                              type="button"
                              onClick={() => updateLicense(user, "reset-trial")}
                              disabled={isUpdating}
                              style={smallWarningButtonStyle}
                            >
                              Reiniciar trial
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateLicense(user, "cancel-license")
                              }
                              disabled={isUpdating}
                              style={smallDangerButtonStyle}
                            >
                              Cancelar
                            </button>

                            {isUpdating ? (
                              <div style={updatingTextStyle}>
                                Actualizando...
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 16,
  outline: "none",
};

const primaryLargeButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 900,
};

const topNavStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 16,
};

const topLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 800,
};

const headerFlexStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginBottom: 16,
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

const tableWrapperStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 1700,
  borderCollapse: "collapse",
  fontSize: 14,
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

const deviceIdStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#6b7280",
  fontSize: 12,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const planTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  minWidth: 90,
};

const planSourceStyle: React.CSSProperties = {
  color: "#6b7280",
  marginTop: 3,
  fontSize: 12,
};

const actionsCellStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 300,
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

const smallActionButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const smallPrimaryButtonStyle: React.CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const smallWarningButtonStyle: React.CSSProperties = {
  border: "1px solid #f59e0b",
  background: "#fffbeb",
  color: "#92400e",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const smallDangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
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

const updatingTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 800,
  width: "100%",
};

const errorStyle: React.CSSProperties = {
  margin: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  padding: 18,
  color: "#6b7280",
};