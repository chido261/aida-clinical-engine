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
type UserFilter =
  | "all"
  | "active"
  | "trial"
  | "expired"
  | "without-phone"
  | "without-device";

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

function formatShortDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getDaysRemaining(value: string | null) {
  if (!value) return "—";

  const endDate = new Date(value);
  const now = new Date();

  if (Number.isNaN(endDate.getTime())) return "—";

  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Vencido";
  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "1 día";

  return `${diffDays} días`;
}

function getDisplayEndDate(user: AdminUser) {
  if (user.fullEndsAt) return user.fullEndsAt;
  if (user.activationFullEndsAt) return user.activationFullEndsAt;
  return user.trialEndsAt;
}

function getDisplayStartDate(user: AdminUser) {
  if (user.fullStartedAt) return user.fullStartedAt;
  if (user.activationFullStartedAt) return user.activationFullStartedAt;
  return user.trialStartedAt;
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

function normalizeSearch(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [activeFilter, setActiveFilter] = useState<UserFilter>("all");
  const [expandedUserId, setExpandedUserId] = useState("");

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

  const filteredUsers = useMemo(() => {
    const cleanSearch = normalizeSearch(searchPhone);

    return users.filter((user) => {
      const phone = normalizeSearch(user.phoneE164 || "");
      const activationPhone = normalizeSearch(user.activationPhoneE164 || "");

      const matchesSearch =
        !cleanSearch ||
        phone.includes(cleanSearch) ||
        activationPhone.includes(cleanSearch);

      if (!matchesSearch) return false;

      if (activeFilter === "active") return user.licenseStatus === "active";
      if (activeFilter === "trial") return user.licenseStatus === "trial";
      if (activeFilter === "expired") return user.licenseStatus === "expired";
      if (activeFilter === "without-phone") {
        return !user.phoneE164 && !user.activationPhoneE164;
      }
      if (activeFilter === "without-device") {
        return !user.deviceSessionActive && !user.activationCurrentDeviceId;
      }

      return true;
    });
  }, [users, searchPhone, activeFilter]);

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

  async function deleteUser(user: AdminUser) {
    const ok = window.confirm(
      `¿Eliminar definitivamente el registro del usuario ${user.id.slice(
        0,
        8
      )}...?\n\nSe borrará UserState, lecturas, uso diario y sesiones de dispositivo.\n\nNo se borrarán pagos, claves ni solicitudes.\n\nEsta acción no se puede deshacer.`
    );

    if (!ok) return;

    setError("");
    setUpdatingUserId(user.id);

    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAdminHeaders(),
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          clearAdminKey();
          setIsAuthorized(false);
          throw new Error("Clave incorrecta o acceso no autorizado.");
        }

        throw new Error(data?.error || "No se pudo eliminar el usuario.");
      }

      setExpandedUserId("");
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Error al eliminar usuario.");
    } finally {
      setUpdatingUserId("");
    }
  }

  function toggleExpandedUser(userId: string) {
    setExpandedUserId((current) => (current === userId ? "" : userId));
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

            <a href="/admin/pagos" style={topLinkStyle}>
              Ver pagos
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

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Listado de usuarios</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                Mostrando {filteredUsers.length} de {users.length} registros
                recientes
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

          <div style={toolbarStyle}>
            <div style={{ flex: "1 1 280px" }}>
              <label htmlFor="searchPhone" style={labelStyle}>
                Buscar por celular
              </label>

              <input
                id="searchPhone"
                type="search"
                value={searchPhone}
                onChange={(event) => setSearchPhone(event.target.value)}
                placeholder="Ejemplo: 4531234567"
                style={inputStyle}
              />
            </div>

            <div style={filtersWrapStyle}>
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "all" ? activeFilterButtonStyle : {}),
                }}
              >
                Todos
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("active")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "active" ? activeFilterButtonStyle : {}),
                }}
              >
                Activos
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("trial")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "trial" ? activeFilterButtonStyle : {}),
                }}
              >
                En prueba
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("expired")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "expired" ? activeFilterButtonStyle : {}),
                }}
              >
                Expirados
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("without-phone")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "without-phone"
                    ? activeFilterButtonStyle
                    : {}),
                }}
              >
                Sin celular
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter("without-device")}
                style={{
                  ...filterButtonStyle,
                  ...(activeFilter === "without-device"
                    ? activeFilterButtonStyle
                    : {}),
                }}
              >
                Sin dispositivo
              </button>
            </div>
          </div>

          {error ? <div style={errorStyle}>{error}</div> : null}

          {isLoading ? (
            <div style={emptyStyle}>Cargando usuarios...</div>
          ) : users.length === 0 ? (
            <div style={emptyStyle}>Todavía no hay usuarios registrados.</div>
          ) : filteredUsers.length === 0 ? (
            <div style={emptyStyle}>No hay usuarios con ese filtro.</div>
          ) : (
            <div style={usersListStyle}>
              {filteredUsers.map((user) => {
                const isUpdating = updatingUserId === user.id;
                const isExpanded = expandedUserId === user.id;
                const displayEndDate = getDisplayEndDate(user);
                const displayStartDate = getDisplayStartDate(user);
                const phone = user.phoneE164 || user.activationPhoneE164 || "—";
                const deviceLabel =
                  user.deviceSessionActive || user.activationCurrentDeviceId
                    ? "Vinculado"
                    : "No vinculado";

                return (
                  <article key={user.id} style={userCardStyle}>
                    <div style={compactGridStyle}>
                      <div style={expandCellStyle}>
                        <button
                          type="button"
                          onClick={() => toggleExpandedUser(user.id)}
                          style={expandIconButtonStyle}
                          aria-label={
                            isExpanded
                              ? "Ocultar detalles"
                              : "Mostrar detalles"
                          }
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Usuario</div>
                        <div style={compactUserValueStyle}>
                          {user.id.slice(0, 8)}...
                        </div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Estado</div>
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
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Celular</div>
                        <div style={compactValueStyle}>{phone}</div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Plan</div>
                        <div style={compactValueStyle}>
                          {getPlanLabel(user.activePlan)}
                        </div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Vence</div>
                        <div style={compactValueStyle}>
                          {formatShortDate(displayEndDate)}
                        </div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Restan</div>
                        <div style={compactValueStyle}>
                          {getDaysRemaining(displayEndDate)}
                        </div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Último uso</div>
                        <div style={compactValueStyle}>
                          {formatShortDate(user.lastMsgAt)}
                        </div>
                      </div>

                      <div style={compactFieldStyle}>
                        <div style={compactLabelStyle}>Dispositivo</div>
                        <div style={compactValueStyle}>{deviceLabel}</div>
                      </div>

                      <div style={detailsCellStyle}>
                        <button
                          type="button"
                          onClick={() => toggleExpandedUser(user.id)}
                          style={detailsButtonStyle}
                        >
                          Detalles
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div style={detailsBoxStyle}>
                        <div style={detailsGridStyle}>
                          <div>
                            <div style={detailLabelStyle}>Clave</div>
                            <div style={detailValueStyle}>
                              {user.activationCode || "—"}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Estado de clave</div>
                            <div style={detailValueStyle}>
                              {user.activationStatus || "Sin clave"}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>ID usuario</div>
                            <div style={detailValueMonoStyle}>{user.id}</div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>ID dispositivo</div>
                            <div style={detailValueMonoStyle}>
                              {user.activationCurrentDeviceId ||
                                "Sin dispositivo vinculado"}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Inicio</div>
                            <div style={detailValueStyle}>
                              {formatDate(displayStartDate)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Activada</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.activationActivatedAt)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Vinculada</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.deviceSessionCreatedAt)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Trial vence</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.trialEndsAt)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Plan vence</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.fullEndsAt)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Mensajes</div>
                            <div style={detailValueStyle}>
                              Total: {user.totalMsgCount ?? 0} / Hoy:{" "}
                              {user.dailyMsgCount ?? 0}
                              {user.dailyMsgDate
                                ? ` / ${user.dailyMsgDate}`
                                : ""}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Creado</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.createdAt)}
                            </div>
                          </div>

                          <div>
                            <div style={detailLabelStyle}>Actualizado</div>
                            <div style={detailValueStyle}>
                              {formatDate(user.updatedAt)}
                            </div>
                          </div>
                        </div>

                        <div style={detailsActionsStyle}>
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

                        <div style={dangerZoneStyle}>
                          <div>
                            <div style={dangerZoneTitleStyle}>
                              Zona peligrosa
                            </div>
                            <div style={dangerZoneTextStyle}>
                              Elimina solo registros de prueba, duplicados o
                              usuarios que ya no deben conservarse en el panel.
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            disabled={isUpdating}
                            style={deleteRecordButtonStyle}
                          >
                            Eliminar registro
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
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

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
};

const panelHeaderStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  gap: 14,
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const filtersWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#374151",
  borderRadius: 999,
  padding: "9px 12px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const activeFilterButtonStyle: React.CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
};

const usersListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
};

const userCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#ffffff",
  overflow: "hidden",
};

const compactGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "42px 150px 90px 145px 95px 115px 95px 115px 120px 100px",
  alignItems: "center",
  columnGap: 10,
  rowGap: 8,
  padding: "10px 12px",
  overflowX: "auto",
};

const expandCellStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
};

const compactFieldStyle: React.CSSProperties = {
  minWidth: 0,
};

const compactLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 11,
  fontWeight: 900,
  marginBottom: 2,
  lineHeight: 1.1,
};

const compactValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const compactUserValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 14,
  fontWeight: 900,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const expandIconButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#111827",
  borderRadius: 10,
  width: 34,
  height: 34,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
};

const detailsCellStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const detailsButtonStyle: React.CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const detailsBoxStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
  background: "#f9fafb",
  padding: 16,
};

const detailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const detailLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 3,
};

const detailValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 14,
  fontWeight: 800,
  wordBreak: "break-word",
};

const detailValueMonoStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 12,
  fontWeight: 800,
  wordBreak: "break-all",
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

const detailsActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 16,
};

const dangerZoneStyle: React.CSSProperties = {
  marginTop: 18,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const dangerZoneTitleStyle: React.CSSProperties = {
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 14,
};

const dangerZoneTextStyle: React.CSSProperties = {
  color: "#7f1d1d",
  fontSize: 13,
  marginTop: 3,
};

const deleteRecordButtonStyle: React.CSSProperties = {
  border: "1px solid #991b1b",
  background: "#991b1b",
  color: "white",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
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