// app/mi-cuenta/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type AccountResponse =
  | {
      ok: true;
      account: {
        id: string;
        name: string | null;
        phoneMasked: string | null;
        diagnosis: string | null;

        licenseStatus: string;
        licenseStatusLabel: string;
        activePlan: string | null;
        activePlanLabel: string;
        activePlanSource: string | null;

        trialStartedAt: string | null;
        trialEndsAt: string | null;
        fullStartedAt: string | null;
        fullEndsAt: string | null;
        daysRemaining: number | null;

        activation: {
          available: boolean;
          code: string | null;
          status: string | null;
          plan: string | null;
          fullStartedAt: string | null;
          fullEndsAt: string | null;
          activatedAt: string | null;
          currentDeviceMatches: boolean | null;
        };

        latestApprovedPayment: {
          id: number;
          plan: string;
          amount: number;
          currency: string;
          durationDays: number;
          approvedAt: string | null;
        } | null;

        createdAt: string;
        updatedAt: string;
      };
    }
  | {
      ok: false;
      error?: string;
      message?: string;
    };

function formatDate(value: string | null) {
  if (!value) return "No disponible";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "No disponible";
  }
}

function formatMoneyCents(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function getDiagnosisLabel(value: string | null) {
  if (value === "dm2") return "Diabetes tipo 2";
  if (value === "prediabetes") return "Prediabetes";
  if (value === "other") return "Otro";
  return "No registrada";
}

function getStatusStyles(status: string) {
  if (status === "active") {
    return {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }

  if (status === "trial") {
    return {
      border: "1px solid #fed7aa",
      background: "#fff7ed",
      color: "#9a3412",
    };
  }

  if (status === "expired") {
    return {
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#991b1b",
    };
  }

  return {
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#374151",
  };
}

function FieldCard({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
        background: "white",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          fontWeight: 700,
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
        {value ?? "No disponible"}
      </div>
    </div>
  );
}

export default function MiCuentaPage() {
  const [deviceId, setDeviceId] = useState("");
  const [account, setAccount] =
    useState<Extract<AccountResponse, { ok: true }>["account"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;

    async function loadAccount() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const res = await fetch("/api/account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId,
          }),
        });

        const data = (await res.json()) as AccountResponse;

        if (!res.ok || !data.ok) {
          throw new Error(
            (data as any)?.message ||
              (data as any)?.error ||
              "No se pudo cargar Mi cuenta."
          );
        }

        if (!cancelled) {
          setAccount(data.account);
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(
            error?.message || "No se pudo cargar la información de tu cuenta."
          );
          setAccount(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const statusStyles = useMemo(() => {
    return getStatusStyles(account?.licenseStatus || "");
  }, [account?.licenseStatus]);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: 16,
        background: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
            Mi cuenta
          </h1>

          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
            Consulta tu plan, vigencia y código de activación.
          </p>
        </div>

        <a
          href="/chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 12px",
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "white",
            color: "#111827",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          Volver
        </a>
      </div>

      {isLoading ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "white",
            color: "#4b5563",
            fontWeight: 700,
          }}
        >
          Cargando información de tu cuenta…
        </div>
      ) : errorMessage ? (
        <div
          style={{
            border: "1px solid #fecaca",
            borderRadius: 16,
            padding: 18,
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {errorMessage}
        </div>
      ) : account ? (
        <>
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 16,
              background: "white",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    fontWeight: 700,
                  }}
                >
                  Usuario
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#111827",
                    marginTop: 3,
                  }}
                >
                  {account.name || "Usuario AIDA"}
                </div>

                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {account.phoneMasked || "Teléfono no registrado"}
                </div>
              </div>

              <div
                style={{
                  ...statusStyles,
                  borderRadius: 999,
                  padding: "8px 11px",
                  fontSize: 13,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {account.licenseStatusLabel}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <FieldCard label="Plan activo" value={account.activePlanLabel} />
              <FieldCard
                label="Días restantes"
                value={
                  typeof account.daysRemaining === "number"
                    ? account.daysRemaining
                    : "No disponible"
                }
              />
              <FieldCard
                label="Diagnóstico"
                value={getDiagnosisLabel(account.diagnosis)}
              />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 16,
              background: "white",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 900,
                margin: "0 0 10px",
                color: "#111827",
              }}
            >
              Código de activación
            </h2>

            {account.activation.available && account.activation.code ? (
              <div
                style={{
                  border: "1px solid #bbf7d0",
                  background: "#f0fdf4",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    color: "#166534",
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 8,
                  }}
                >
                  Tu código está disponible
                </div>

                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 950,
                    letterSpacing: 1.5,
                    color: "#111827",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "white",
                    border: "1px dashed #86efac",
                    display: "inline-block",
                  }}
                >
                  {account.activation.code}
                </div>

                <div
                  style={{
                    color: "#166534",
                    fontSize: 13,
                    marginTop: 10,
                    lineHeight: 1.4,
                  }}
                >
                  Guarda este código. Te servirá para vincular tu cuenta o
                  recuperar tu acceso.
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  borderRadius: 16,
                  padding: 14,
                  color: "#4b5563",
                  fontSize: 14,
                  lineHeight: 1.45,
                }}
              >
                Todavía no hay código de activación disponible. Cuando tu pago
                sea aprobado, podrás verlo aquí.
              </div>
            )}
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 16,
              background: "white",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 900,
                margin: "0 0 10px",
                color: "#111827",
              }}
            >
              Vigencia
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
              }}
            >
              <FieldCard
                label="Inicio versión completa"
                value={formatDate(account.fullStartedAt)}
              />
              <FieldCard
                label="Fin versión completa"
                value={formatDate(account.fullEndsAt)}
              />
              <FieldCard
                label="Fin prueba gratuita"
                value={formatDate(account.trialEndsAt)}
              />
            </div>
          </section>

          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 16,
              background: "white",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 900,
                margin: "0 0 10px",
                color: "#111827",
              }}
            >
              Último pago aprobado
            </h2>

            {account.latestApprovedPayment ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                }}
              >
                <FieldCard
                  label="Pago"
                  value={`#${account.latestApprovedPayment.id}`}
                />
                <FieldCard
                  label="Monto"
                  value={formatMoneyCents(
                    account.latestApprovedPayment.amount,
                    account.latestApprovedPayment.currency
                  )}
                />
                <FieldCard
                  label="Plan"
                  value={account.activePlanLabel}
                />
                <FieldCard
                  label="Aprobado"
                  value={formatDate(account.latestApprovedPayment.approvedAt)}
                />
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  borderRadius: 16,
                  padding: 14,
                  color: "#4b5563",
                  fontSize: 14,
                }}
              >
                No encontramos pagos aprobados recientes para esta cuenta.
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}