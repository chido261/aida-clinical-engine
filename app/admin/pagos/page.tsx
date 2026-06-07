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
  customerName: string | null;
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

type PaymentFilter =
  | "all"
  | "approved"
  | "pending"
  | "failed"
  | "with_code"
  | "without_code";

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

function getPlanLabel(plan: string) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  return plan || "—";
}

function getStatusLabel(status: string) {
  if (status === "created") return "Creado";
  if (status === "pending") return "Pendiente";
  if (status === "in_process") return "Procesando";
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Rechazado";
  if (status === "cancelled") return "Cancelado";
  if (status === "refunded") return "Reembolsado";
  return status || "—";
}

function isPendingStatus(status: string) {
  return status === "created" || status === "pending" || status === "in_process";
}

function isFailedStatus(status: string) {
  return status === "rejected" || status === "cancelled" || status === "refunded";
}

function getStatusBadgeStyle(status: string): React.CSSProperties {
  if (status === "approved") {
    return {
      ...statusBadgeStyle,
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (isFailedStatus(status)) {
    return {
      ...statusBadgeStyle,
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (status === "in_process") {
    return {
      ...statusBadgeStyle,
      background: "#dbeafe",
      color: "#1e40af",
    };
  }

  return {
    ...statusBadgeStyle,
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
  const [searchText, setSearchText] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [expandedPaymentId, setExpandedPaymentId] = useState<number | null>(
    null
  );

  const totalApproved = useMemo(
    () => payments.filter((payment) => payment.status === "approved").length,
    [payments]
  );

  const totalPending = useMemo(
    () => payments.filter((payment) => isPendingStatus(payment.status)).length,
    [payments]
  );

  const totalApprovedAmount = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "approved")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments]
  );

  const filteredPayments = useMemo(() => {
    const cleanSearch = searchText.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesFilter =
        paymentFilter === "all"
          ? true
          : paymentFilter === "approved"
            ? payment.status === "approved"
            : paymentFilter === "pending"
              ? isPendingStatus(payment.status)
              : paymentFilter === "failed"
                ? isFailedStatus(payment.status)
                : paymentFilter === "with_code"
                  ? Boolean(payment.activationCode)
                  : !payment.activationCode;

      const searchableText = [
        payment.id,
        payment.customerName,
        payment.provider,
        payment.providerPaymentId,
        payment.providerRef,
        payment.status,
        getStatusLabel(payment.status),
        payment.plan,
        payment.phoneE164,
        payment.deviceId,
        payment.activationCode,
        payment.activationCodeId,
        payment.activationCurrentDeviceId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = cleanSearch
        ? searchableText.includes(cleanSearch)
        : true;

      return matchesFilter && matchesSearch;
    });
  }, [payments, searchText, paymentFilter]);

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

  async function copyText(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return;

    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
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
      <section style={{ maxWidth: 1300, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={topNavStyle}>
            <a href="/pago" style={topLinkStyle}>
              ← Volver a página de pagos
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
            <div style={heroHeaderStyle}>
              <div>
                <div style={badgeStyle}>Panel admin</div>

                <h1 style={titleStyle}>Pagos Mercado Pago</h1>

                <p style={paragraphStyle}>
                  Vista operativa de pagos automáticos, claves generadas,
                  renovaciones y vigencias.
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
            <div style={metricLabelStyle}>Total pagos</div>
            <div style={metricValueStyle}>{payments.length}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Aprobados</div>
            <div style={metricValueStyle}>{totalApproved}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Pendientes / procesando</div>
            <div style={metricValueStyle}>{totalPending}</div>
          </div>

          <div style={smallCardStyle}>
            <div style={metricLabelStyle}>Total aprobado</div>
            <div style={metricValueStyle}>
              {formatMoneyCents(totalApprovedAmount)}
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Listado de pagos</div>
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>
                Mostrando {filteredPayments.length} de {payments.length} pagos
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadPayments()}
              disabled={isLoading}
              style={actionButtonStyle}
            >
              {isLoading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div style={toolbarStyle}>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre, celular, clave, pago o referencia..."
              style={searchInputStyle}
            />

            <div style={filtersStyle}>
              {[
                ["all", "Todos"],
                ["approved", "Aprobados"],
                ["pending", "Pendientes"],
                ["failed", "Fallidos"],
                ["with_code", "Con clave"],
                ["without_code", "Sin clave"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentFilter(value as PaymentFilter)}
                  style={
                    paymentFilter === value
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
            <div style={emptyStateStyle}>Cargando pagos...</div>
          ) : payments.length === 0 ? (
            <div style={emptyStateStyle}>No hay pagos registrados.</div>
          ) : filteredPayments.length === 0 ? (
            <div style={emptyStateStyle}>
              No hay pagos que coincidan con la búsqueda o filtro.
            </div>
          ) : (
            <div>
              <div style={compactHeaderStyle}>
                <div>Pago</div>
                <div>Estado</div>
                <div>Nombre</div>
                <div>Celular</div>
                <div>Plan</div>
                <div>Monto</div>
                <div>Clave</div>
                <div>Fecha</div>
                <div>Detalles</div>
              </div>

              {filteredPayments.map((payment) => {
                const isExpanded = expandedPaymentId === payment.id;

                return (
                  <div key={payment.id} style={rowCardStyle}>
                    <div style={compactRowStyle}>
                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>#{payment.id}</div>
                        <div style={mutedSmallStyle}>{payment.provider}</div>
                      </div>

                      <div style={cellStyle}>
                        <span style={getStatusBadgeStyle(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </span>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {payment.customerName || "—"}
                        </div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>{payment.phoneE164}</div>
                        <div style={ellipsisStyle}>{payment.deviceId ?? "—"}</div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {getPlanLabel(payment.plan)}
                        </div>
                        <div style={mutedSmallStyle}>
                          {payment.durationDays} días
                        </div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {formatMoneyCents(payment.amount, payment.currency)}
                        </div>
                        <div style={mutedSmallStyle}>{payment.currency}</div>
                      </div>

                      <div style={cellStyle}>
                        <div style={cellStrongStyle}>
                          {payment.activationCode ?? "—"}
                        </div>
                        <div style={mutedSmallStyle}>
                          {payment.activationCodeId
                            ? `ID: ${payment.activationCodeId}`
                            : "Sin clave"}
                        </div>
                      </div>

                      <div style={cellStyle}>
                        {formatShortDate(payment.createdAt)}
                      </div>

                      <div style={cellStyle}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedPaymentId(isExpanded ? null : payment.id)
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
                            <DetailItem label="Pago interno" value={`#${payment.id}`} />
                            <DetailItem
                              label="Proveedor"
                              value={payment.provider || "—"}
                            />
                            <DetailItem
                              label="Estado pago"
                              value={getStatusLabel(payment.status)}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Nombre"
                              value={payment.customerName ?? "—"}
                            />
                            <DetailItem
                              label="Celular"
                              value={payment.phoneE164 || "—"}
                            />
                            <DetailItem
                              label="Device ID"
                              value={payment.deviceId ?? "—"}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="ID Mercado Pago"
                              value={payment.providerPaymentId ?? "—"}
                            />
                            <DetailItem
                              label="Referencia"
                              value={payment.providerRef ?? "—"}
                            />
                            <DetailItem
                              label="Plan"
                              value={`${getPlanLabel(payment.plan)} · ${
                                payment.durationDays
                              } días`}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Clave"
                              value={payment.activationCode ?? "—"}
                            />
                            <DetailItem
                              label="ID clave"
                              value={
                                payment.activationCodeId
                                  ? String(payment.activationCodeId)
                                  : "—"
                              }
                            />
                            <DetailItem
                              label="Estado clave"
                              value={payment.activationStatus ?? "—"}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Monto"
                              value={`${formatMoneyCents(
                                payment.amount,
                                payment.currency
                              )} ${payment.currency}`}
                            />
                            <DetailItem
                              label="Creado"
                              value={formatDate(payment.createdAt)}
                            />
                            <DetailItem
                              label="Actualizado"
                              value={formatDate(payment.updatedAt)}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Aprobado"
                              value={formatDate(payment.approvedAt)}
                            />
                            <DetailItem
                              label="Inicio vigencia"
                              value={formatDate(payment.activationFullStartedAt)}
                            />
                            <DetailItem
                              label="Fin vigencia"
                              value={formatDate(payment.activationFullEndsAt)}
                            />
                          </div>

                          <div style={detailBlockStyle}>
                            <DetailItem
                              label="Dispositivo activo"
                              value={payment.activationCurrentDeviceId ?? "—"}
                            />
                          </div>
                        </div>

                        <div style={actionsAreaStyle}>
                          <div style={sectionTitleStyle}>Acciones rápidas</div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => copyText(payment.customerName)}
                              style={actionButtonStyle}
                            >
                              Copiar nombre
                            </button>

                            <button
                              type="button"
                              onClick={() => copyText(payment.providerPaymentId)}
                              style={actionButtonStyle}
                            >
                              Copiar ID Mercado Pago
                            </button>

                            <button
                              type="button"
                              onClick={() => copyText(payment.providerRef)}
                              style={actionButtonStyle}
                            >
                              Copiar referencia
                            </button>

                            {payment.activationCode ? (
                              <button
                                type="button"
                                onClick={() => copyText(payment.activationCode)}
                                style={actionButtonStyle}
                              >
                                Copiar clave
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => copyText(payment.phoneE164)}
                              style={actionButtonStyle}
                            >
                              Copiar celular
                            </button>
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
  color: "#111827",
  padding: "32px 18px",
  boxSizing: "border-box",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

const topLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 900,
};

const heroHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
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
  gridTemplateColumns: "90px 125px 1.1fr 1.25fr 0.9fr 0.95fr 1.15fr 0.9fr 90px",
  gap: 10,
  padding: "12px 14px",
  background: "#f9fafb",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
  fontSize: 12,
  fontWeight: 900,
  minWidth: 1160,
};

const compactRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 125px 1.1fr 1.25fr 0.9fr 0.95fr 1.15fr 0.9fr 90px",
  gap: 10,
  padding: "14px",
  alignItems: "center",
  minWidth: 1160,
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

const ellipsisStyle: React.CSSProperties = {
  ...mutedSmallStyle,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 13,
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
  margin: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontWeight: 700,
  fontSize: 14,
};