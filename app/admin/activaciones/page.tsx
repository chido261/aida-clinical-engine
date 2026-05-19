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
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
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

export default function AdminActivacionesPage() {
  const [requests, setRequests] = useState<ActivationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPending = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const totalActivated = useMemo(
    () => requests.filter((r) => r.status === "activated").length,
    [requests]
  );

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
        },
        body: JSON.stringify({
          id,
          status,
        }),
      });
  
      const data = await res.json().catch(() => null);
  
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar la solicitud.");
      }
  
      await loadRequests();
    } catch (err: any) {
      setError(err?.message || "Error al actualizar solicitud.");
    }
  }

  async function loadRequests() {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/activation-requests", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar las solicitudes.");
      }

      setRequests(data?.activationRequests ?? []);
    } catch (err: any) {
      setError(err?.message || "Error al cargar solicitudes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: 24,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <a
            href="/pago"
            style={{
              display: "inline-flex",
              color: "#111827",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            ← Volver a pagos
          </a>

          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                background: "#111827",
                color: "white",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 12,
              }}
            >
              Panel admin
            </div>

            <h1
              style={{
                margin: "0 0 8px",
                fontSize: 30,
                color: "#111827",
              }}
            >
              Solicitudes de activación
            </h1>

            <p
              style={{
                margin: 0,
                color: "#4b5563",
                fontSize: 16,
                lineHeight: 1.5,
              }}
            >
              Aquí podrás revisar las solicitudes generadas desde la página de
              activación. Por ahora es solo lectura; después agregaremos botones
              para marcar pagado, activar acceso o cancelar.
            </p>
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
          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Total solicitudes
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
              {requests.length}
            </div>
          </div>

          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Pendientes
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
              {totalPending}
            </div>
          </div>

          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Activadas
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
              {totalActivated}
            </div>
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
              onClick={loadRequests}
              disabled={isLoading}
              style={{
                border: "1px solid #e5e7eb",
                background: "white",
                borderRadius: 10,
                padding: "8px 10px",
                fontWeight: 800,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
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
                    <th style={thStyle}>Precio</th>
                    <th style={thStyle}>Duración</th>
                    <th style={thStyle}>Estado</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={tdStyle}>#{request.id}</td>
                      <td style={tdStyle}>{request.name}</td>
                      <td style={tdStyle}>{request.phone}</td>
                      <td style={tdStyle}>{getPlanLabel(request.plan)}</td>
                      <td style={tdStyle}>{formatMoney(request.price)}</td>
                      <td style={tdStyle}>{request.duration} días</td>
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
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {request.status === "pending" ? (
      <>
        <button
          type="button"
          onClick={() => updateRequestStatus(request.id, "paid")}
          style={actionButtonStyle}
        >
          Marcar pagado
        </button>

        <button
          type="button"
          onClick={() => updateRequestStatus(request.id, "cancelled")}
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
          onClick={() => updateRequestStatus(request.id, "activated")}
          style={primaryButtonStyle}
        >
          Activar acceso
        </button>

        <button
          type="button"
          onClick={() => updateRequestStatus(request.id, "cancelled")}
          style={dangerButtonStyle}
        >
          Cancelar
        </button>
      </>
    ) : null}

    {request.status === "activated" ? (
      <span style={{ color: "#166534", fontWeight: 900 }}>Activo</span>
    ) : null}

    {request.status === "cancelled" ? (
      <span style={{ color: "#991b1b", fontWeight: 900 }}>Cancelado</span>
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