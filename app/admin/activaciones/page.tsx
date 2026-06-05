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

type StatusFilter =
  | "all"
  | "pending"
  | "paid"
  | "activated"
  | "cancelled"
  | "repeated";

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

function formatShortDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
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

function getStatusBadgeStyle(status: string): React.CSSProperties {
  return {
    display: "inline-flex",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 12,
    fontWeight: 900,
    background:
      status === "activated"
        ? "#dcfce7"
        : status === "paid"
          ? "#dbeafe"
          : status === "cancelled"
            ? "#fee2e2"
            : "#fef3c7",
    color:
      status === "activated"
        ? "#166534"
        : status === "paid"
          ? "#1e40af"
          : status === "cancelled"
            ? "#991b1b"
            : "#92400e",
  };
}

export default function AdminActivacionesPage() {
  const [requests, setRequests] = useState<ActivationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(
    null
  );

  const totalPending = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const totalActivated = useMemo(
    () => requests.filter((r) => r.status === "activated").length,
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const cleanSearch = searchText.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesFilter =
        statusFilter === "all"
          ? true
          : statusFilter === "repeated"
            ? request.hasRepeatedPhone
            : request.status === statusFilter;

      const searchableText = [
        request.id,
        request.name,
        request.phone,
        request.phoneE164,
        request.plan,
        request.status,
        request.activationCode,
        request.deviceId,
        request.activationCurrentDeviceId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = cleanSearch
        ? searchableText.includes(cleanSearch)
        : true;

      return matchesFilter && matchesSearch;
    });
  }, [requests, searchText, statusFilter]);

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

  async function copyText(value: string | null | undefined) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
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
          <div style={topNavStyle}>
            <a href="/pago" style={navLinkStyle}>
              ← Volver a pagos
            </a>

            <a href="/admin/usuarios" style={navLinkStrongStyle}>
              Ver usuarios →
            </a>
          </div>

          <div style={cardStyle}>
            <div style={heroHeaderStyle}>
              <div style={{ flex: 1 }}>
                <div style={badgeStyle}>Panel admin</div>

                <h1 style={titleStyle}>Solicitudes manuales de activación</h1>

                <p style={paragraphStyle}>
                  Este panel sirve para revisar solicitudes manuales o históricas
                  de activación. Los pagos automáticos de Mercado Pago se revisan
                  en el panel de pagos.
                </p>

                <div style={infoBoxStyle}>
                  Importante: si el usuario pagó por Mercado Pago, revisa primero{" "}
                  <a href="/admin/pagos" style={infoLinkStyle}>
                    /admin/pagos
                  </a>
                  .
                </div>
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

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Últimas solicitudes</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>
                Mostrando {filteredRequests.length} de {requests.length}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadRequests()}
              disabled={isLoading}
              style={actionButtonStyle}
            >
              {isLoading ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div style={toolbarStyle}>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre, celular, clave o dispositivo..."
              style={searchInputStyle}
            />

            <div style={filtersStyle}>
              {[
                ["all", "Todos"],
                ["pending", "Pendientes"],
                ["paid", "Pagados"],
                ["activated", "Activados"],
                ["cancelled", "Cancelados"],
                ["repeated", "Repetidos"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value as StatusFilter)}
                  style={
                    statusFilter === value
                      ? activeFilterButtonStyle
                      : filterButtonStyle
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error ? <div style={errorBoxStyle}>{error}</div> : null}

          {isLoading ? (
            <div style={emptyStateStyle}>Cargando solicitudes...</div>
          ) : requests.length === 0 ? (
            <div style={emptyStateStyle}>
              Todavía no hay solicitudes registradas.
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={emptyStateStyle}>
              No hay solicitudes que coincidan con la búsqueda o filtro.
            </div>
          ) : (
            <div>
              <div style={compactHeaderStyle}>
                <div>Folio</div>
                <div>Nombre</div>
                <div>Estado</div>
                <div>Celular</div>
                <div>Plan</div>
                <div>Clave</div>
                <div>Fecha</div>
                <div>Detalles</div>
              </div>

              {filteredRequests.map((request) => {
                const isExpanded = expandedRequestId === request.id;

                return (
                  <div key={request.id} style={rowCardStyle}>
                    <div style={compactRowStyle}>
                      <div style={cellStrongStyle}>#{request.id}</div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>{request.name || "—"}</div>
                        {request.hasRepeatedPhone ? (
                          <div style={warningPillStyle}>Teléfono repetido</div>
                        ) : null}
                      </div>

                      <div style={cellStyle}>
                        <span style={getStatusBadgeStyle(request.status)}>
                          {getStatusLabel(request.status)}
                        </span>
                      </div>

                      <div style={cellStyle}>
                        <div>{request.phone || "—"}</div>
                        <div style={mutedSmallStyle}>{request.phoneE164}</div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {getPlanLabel(request.plan)}
                        </div>
                        <div style={mutedSmallStyle}>
                          {formatMoney(request.price)} · {request.duration} días
                        </div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {request.activationCode || "—"}
                        </div>
                        <div style={mutedSmallStyle}>
                          {request.activationStatus
                            ? `Estado: ${request.activationStatus}`
                            : "Sin clave"}
                        </div>
                      </div>

                      <div style={cellStyle}>
                        {formatShortDate(request.createdAt)}
                      </div>

                      <div style={cellStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedRequestId(isExpanded ? null : request.id)
                          }
                          style={actionButtonStyle}
                        >
                          {isExpanded ? "Ocultar" : "Detalles"}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div style={detailsBoxStyle}>
                        <div style={userLikeDetailsGridStyle}>
                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Clave"
                              value={request.activationCode || "—"}
                            />
                            <DetailItem
                              label="Estado de clave"
                              value={request.activationStatus || "—"}
                            />
                            <DetailItem
                              label="Relación"
                              value={getRelationLabel(request)}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="ID solicitud"
                              value={String(request.id)}
                            />
                            <DetailItem
                              label="ID dispositivo solicitud"
                              value={request.deviceId || "—"}
                            />
                            <DetailItem
                              label="ID dispositivo activo"
                              value={request.activationCurrentDeviceId || "—"}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Activada"
                              value={formatDate(request.activationActivatedAt)}
                            />
                            <DetailItem
                              label="Vinculada"
                              value={formatDate(request.deviceSessionCreatedAt)}
                            />
                            <DetailItem
                              label="Sesión"
                              value={request.deviceSessionActive ? "Activa" : "—"}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Inicio"
                              value={formatDate(request.activationFullStartedAt)}
                            />
                            <DetailItem
                              label="Vence"
                              value={formatDate(request.activationFullEndsAt)}
                            />
                            <DetailItem
                              label="Solicitud creada"
                              value={formatDate(request.createdAt)}
                            />
                          </div>
                        </div>

                        <div style={noticeStyle}>
                          {request.activationNotice || "Sin aviso adicional."}
                        </div>

                        <div style={actionsAreaStyle}>
                          <div style={sectionTitleStyle}>
                            Acciones administrativas
                          </div>

                          <div
                            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                          >
                            {request.activationCode ? (
                              <button
                                type="button"
                                onClick={() => copyText(request.activationCode)}
                                style={actionButtonStyle}
                              >
                                Copiar clave
                              </button>
                            ) : null}

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
                                Solicitud activada
                              </span>
                            ) : null}

                            {request.status === "cancelled" ? (
                              <span style={{ color: "#991b1b", fontWeight: 900 }}>
                                Solicitud cancelada
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailItemStyle}>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value}</div>
    </div>
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

const searchInputStyle: React.CSSProperties = {
  ...inputStyle,
  maxWidth: 460,
};

const topNavStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const navLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
};

const navLinkStrongStyle: React.CSSProperties = {
  ...navLinkStyle,
  fontWeight: 900,
};

const heroHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 12,
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.4,
};

const infoLinkStyle: React.CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 900,
  textDecoration: "underline",
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflow: "hidden",
};

const panelHeaderStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
};

const filtersStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#374151",
  borderRadius: 999,
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const activeFilterButtonStyle: React.CSSProperties = {
  ...filterButtonStyle,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
};

const compactHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1.25fr 110px 1.15fr 1fr 1.3fr 1fr 90px",
  gap: 10,
  padding: "12px 14px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontSize: 12,
  fontWeight: 900,
  minWidth: 980,
};

const compactRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1.25fr 110px 1.15fr 1fr 1.3fr 1fr 90px",
  gap: 10,
  padding: "14px",
  alignItems: "center",
  minWidth: 980,
};

const rowCardStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  overflowX: "auto",
};

const cellStyle: React.CSSProperties = {
  minWidth: 0,
  color: "#111827",
  fontSize: 14,
};

const cellStrongStyle: React.CSSProperties = {
  fontWeight: 900,
};

const mutedSmallStyle: React.CSSProperties = {
  color: "#6b7280",
  marginTop: 3,
  fontSize: 12,
};

const warningPillStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: 6,
  borderRadius: 999,
  padding: "4px 7px",
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 11,
  fontWeight: 900,
};

const detailsBoxStyle: React.CSSProperties = {
  padding: 14,
  background: "#f9fafb",
  borderTop: "1px solid #e5e7eb",
};

const userLikeDetailsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 14,
};

const detailBlockStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
  alignContent: "start",
};

const detailItemStyle: React.CSSProperties = {
  minWidth: 0,
};

const detailLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 4,
};

const detailValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: "anywhere",
  lineHeight: 1.35,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5e7eb",
  background: "white",
  borderRadius: 12,
  padding: 12,
  color: "#374151",
  fontSize: 13,
  fontWeight: 800,
  lineHeight: 1.4,
};

const actionsAreaStyle: React.CSSProperties = {
  marginTop: 14,
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  color: "#111827",
  marginBottom: 10,
};

const emptyStateStyle: React.CSSProperties = {
  padding: 18,
  color: "#6b7280",
};

const errorBoxStyle: React.CSSProperties = {
  margin: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontWeight: 700,
  fontSize: 14,
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