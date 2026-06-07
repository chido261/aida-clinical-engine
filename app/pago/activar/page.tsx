"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDeviceId } from "@/app/lib/deviceId";

type VerifyResponse =
  | {
      ok: true;
      status: "activated";
      message: string;
      code: string;
      plan: string;
      fullEndsAt: string | null;
    }
  | {
      ok: false;
      status:
        | "invalid_code"
        | "phone_mismatch"
        | "inactive_code"
        | "expired_code"
        | "device_transfer_required";
      message: string;
      maskedPhone?: string;
    };

type PaymentStatusResponse =
  | {
      ok: true;
      payment: {
        id: number;
        provider?: string;
        providerPaymentId?: string | null;
        providerRef?: string | null;
        status: string;
        plan: string;
        amount: number;
        currency: string;
        durationDays: number;
        phoneMasked: string | null;
        deviceId?: string | null;
        approvedAt: string | null;
        createdAt: string;
        updatedAt?: string;
        activationCodeId?: number | null;
        activationCode: string | null;
        activationStatus?: string | null;
        activationFullStartedAt?: string | null;
        activationFullEndsAt: string | null;
        activationCurrentDeviceId?: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

type AutoActivationResponse =
  | {
      ok: true;
      status: "activated";
      message: string;
      paymentId: number;
      code: string;
      plan: string;
      fullStartedAt: string | null;
      fullEndsAt: string | null;
    }
  | {
      ok: false;
      error: string;
      message?: string;
      paymentStatus?: string;
    };

function normalizePlan(value: string | null) {
  if (value === "mensual") return "mensual";
  if (value === "3-meses") return "3 meses";
  if (value === "anual") return "anual";
  return "AIDA";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No disponible";

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "long",
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

function getStatusLabel(status: string) {
  if (status === "approved") return "Aprobado";
  if (status === "pending") return "Pendiente";
  if (status === "in_process") return "Procesando";
  if (status === "created") return "Creado";
  if (status === "rejected") return "Rechazado";
  if (status === "cancelled") return "Cancelado";
  if (status === "refunded") return "Reembolsado";
  return status || "—";
}

function getFriendlyPaymentError(message: string, paymentStatus?: string) {
  const cleanMessage = String(message || "").toLowerCase();
  const cleanStatus = String(paymentStatus || "").toLowerCase();

  const isPendingLike =
    cleanStatus === "pending" ||
    cleanStatus === "in_process" ||
    cleanStatus === "created" ||
    cleanMessage.includes("todavía no aparece como aprobado") ||
    cleanMessage.includes("aún no aparece como aprobado") ||
    cleanMessage.includes("no aparece como aprobado") ||
    cleanMessage.includes("pending") ||
    cleanMessage.includes("in_process");

  if (isPendingLike) {
    return "Tu pago aún no ha sido confirmado por Mercado Pago. Si Mercado Pago ya te mostró que el pago fue aprobado, espera unos minutos y vuelve a verificar. Si sigue sin confirmarse, revisa tu comprobante o comunícate con soporte.";
  }

  return message || "Tu pago se encontró, pero no se pudo activar automáticamente.";
}

function getAccessActionLabels({
  paymentId,
  autoSuccess,
  payment,
}: {
  paymentId: string | null;
  autoSuccess: Extract<AutoActivationResponse, { ok: true }> | null;
  payment: Extract<PaymentStatusResponse, { ok: true }>["payment"] | null;
}) {
  if (!paymentId) {
    return {
      badge: "Activación de acceso",
      title: "Activa tu clave de AIDA",
      description:
        "Ingresa el celular con el que realizaste tu pago y tu clave de activación.",
      successTitle: "Acceso activado correctamente",
      successMessage: "Tu clave quedó vinculada a este dispositivo.",
      autoLoadingText: "Activando acceso automático...",
    };
  }

  const isExtension =
    Boolean(payment?.activationCodeId || autoSuccess) && Number(payment?.id ?? paymentId) > 1;

  if (isExtension) {
    return {
      badge: "Extensión de acceso",
      title: "Confirmando la extensión de tu cuenta",
      description:
        "Estamos verificando tu pago y extendiendo la vigencia de tu cuenta en este dispositivo.",
      successTitle: "Cuenta extendida automáticamente",
      successMessage:
        "Tu pago fue confirmado y los días se sumaron a la vigencia de tu cuenta.",
      autoLoadingText: "Extendiendo acceso automáticamente...",
    };
  }

  return {
    badge: "Activación de acceso",
    title: "Confirmando tu acceso",
    description:
      "Estamos verificando tu pago y activando tu cuenta automáticamente en este dispositivo.",
    successTitle: "Acceso activado automáticamente",
    successMessage:
      "Tu pago fue confirmado y tu cuenta completa quedó vinculada a este dispositivo.",
    autoLoadingText: "Activando acceso automático...",
  };
}

export default function PagoActivarPage() {
  return (
    <Suspense fallback={<PagoActivarFallback />}>
      <PagoActivarContent />
    </Suspense>
  );
}

function PagoActivarFallback() {
  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={cardStyle}>Cargando acceso...</div>
      </section>
    </main>
  );
}

function PagoActivarContent() {
  const searchParams = useSearchParams();
  const selectedPlanLabel = normalizePlan(searchParams.get("plan"));
  const paymentId = searchParams.get("paymentId");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [isAutoActivating, setIsAutoActivating] = useState(false);
  const [autoAttempted, setAutoAttempted] = useState(false);
  const [forceTransfer, setForceTransfer] = useState(false);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [warning, setWarning] = useState("");
  const [payment, setPayment] = useState<
    Extract<PaymentStatusResponse, { ok: true }>["payment"] | null
  >(null);
  const [success, setSuccess] = useState<Extract<VerifyResponse, { ok: true }> | null>(
    null
  );
  const [autoSuccess, setAutoSuccess] = useState<
    Extract<AutoActivationResponse, { ok: true }> | null
  >(null);

  const actionLabels = getAccessActionLabels({
    paymentId,
    autoSuccess,
    payment,
  });

  const paymentView = useMemo(() => {
    if (!payment) return null;

    if (!autoSuccess) return payment;

    return {
      ...payment,
      status: "approved",
      activationCode: autoSuccess.code,
      activationCodeId: payment.activationCodeId ?? 1,
      activationFullStartedAt: autoSuccess.fullStartedAt,
      activationFullEndsAt: autoSuccess.fullEndsAt,
    };
  }, [payment, autoSuccess]);

  const effectivePlanLabel = paymentView?.plan
    ? normalizePlan(paymentView.plan)
    : autoSuccess?.plan
      ? normalizePlan(autoSuccess.plan)
      : selectedPlanLabel;

  const effectiveCode = paymentView?.activationCode ?? autoSuccess?.code ?? code;

  const canSubmit = useMemo(() => {
    return phone.trim().length >= 10 && effectiveCode.trim().length >= 8;
  }, [phone, effectiveCode]);

  async function refreshPaymentStatus() {
    if (!paymentId) return;

    const res = await fetch(`/api/payments/status?paymentId=${paymentId}`, {
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as
      | PaymentStatusResponse
      | null;

    if (!res.ok) {
      throw new Error(
        (data as any)?.error || "No se pudo consultar el estado del pago."
      );
    }

    if (!data || !data.ok) {
      throw new Error((data as any)?.error || "No se pudo consultar el pago.");
    }

    setPayment(data.payment);

    if (data.payment.activationCode) {
      setCode(data.payment.activationCode);
    }
  }

  async function activatePaidAccess(nextForceTransfer = false) {
    if (!paymentId || isAutoActivating) return;

    setIsAutoActivating(true);
    setPaymentError("");
    setWarning("");

    try {
      const deviceId = getDeviceId();

      const res = await fetch("/api/payments/activate-paid-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentId,
          deviceId,
          forceTransfer: nextForceTransfer,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | AutoActivationResponse
        | null;

      if (!res.ok) {
        if ((data as any)?.error === "device_transfer_required") {
          setWarning(
            (data as any)?.message ||
              "Esta clave ya está activa en otro dispositivo. Puedes activarla aquí si deseas transferir el acceso."
          );
          setForceTransfer(true);
          return;
        }

        throw new Error(
          (data as any)?.message ||
            (data as any)?.error ||
            "No se pudo activar automáticamente el acceso."
        );
      }

      if (!data || !data.ok) {
        throw new Error(
          (data as any)?.message ||
            (data as any)?.error ||
            "No se pudo activar automáticamente el acceso."
        );
      }

      setAutoSuccess(data);
      setCode(data.code);
      setForceTransfer(false);

      await refreshPaymentStatus().catch(() => null);
    } catch (err: any) {
      setPaymentError(getFriendlyPaymentError(err?.message, payment?.status));
    } finally {
      setIsAutoActivating(false);
      setAutoAttempted(true);
    }
  }

  useEffect(() => {
    if (!paymentId) return;

    let cancelled = false;

    async function loadPaymentStatus() {
      setIsLoadingPayment(true);
      setPaymentError("");

      try {
        const res = await fetch(`/api/payments/status?paymentId=${paymentId}`, {
          cache: "no-store",
        });

        const data = (await res.json().catch(() => null)) as
          | PaymentStatusResponse
          | null;

        if (!res.ok) {
          throw new Error(
            (data as any)?.error || "No se pudo consultar el estado del pago."
          );
        }

        if (!data) {
          throw new Error("Respuesta inválida del servidor.");
        }

        if (!data.ok) {
          throw new Error(data.error || "No se pudo consultar el pago.");
        }

        if (cancelled) return;

        setPayment(data.payment);

        if (data.payment.activationCode) {
          setCode(data.payment.activationCode);
        }

        if (!autoAttempted) {
          await activatePaidAccess(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        setPaymentError(err?.message || "No se pudo consultar el pago.");
      } finally {
        if (!cancelled) {
          setIsLoadingPayment(false);
        }
      }
    }

    loadPaymentStatus();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  async function submitActivation(nextForceTransfer = false) {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setWarning("");
    setSuccess(null);

    try {
      const deviceId = getDeviceId();

      const res = await fetch("/api/activation/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          code: effectiveCode,
          deviceId,
          forceTransfer: nextForceTransfer,
        }),
      });

      const data = (await res.json().catch(() => null)) as VerifyResponse | null;

      if (!res.ok) {
        throw new Error(
          (data as any)?.error || "No se pudo validar la clave de activación."
        );
      }

      if (!data) {
        throw new Error("Respuesta inválida del servidor.");
      }

      if (data.ok) {
        setSuccess(data);
        setForceTransfer(false);
        return;
      }

      if (data.status === "device_transfer_required") {
        setWarning(data.message);
        setForceTransfer(true);
        return;
      }

      setError(data.message || "No se pudo activar la clave.");
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al activar la clave.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitActivation(false);
  }

  const shouldShowManualForm =
    !paymentId || (!autoSuccess && autoAttempted && paymentView?.status !== "approved");

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/pago" style={backLinkStyle}>
          ← Volver a planes
        </a>

        <div style={cardStyle}>
          <div style={badgeStyle}>{actionLabels.badge}</div>

          <h1 style={titleStyle}>
            {paymentId ? actionLabels.title : "Activa tu clave de AIDA"}
          </h1>

          <p style={paragraphStyle}>{actionLabels.description}</p>

          {paymentId ? (
            <div style={paymentBoxStyle}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
                Estado del pago
              </div>

              {isLoadingPayment && !paymentView ? (
                <div style={{ fontWeight: 800 }}>Consultando pago...</div>
              ) : paymentView ? (
                <div style={{ display: "grid", gap: 7, fontSize: 15 }}>
                  <div>
                    <strong>Pago:</strong> #{paymentView.id}
                  </div>
                  <div>
                    <strong>Estado:</strong> {getStatusLabel(paymentView.status)}
                  </div>
                  <div>
                    <strong>Monto:</strong>{" "}
                    {formatMoneyCents(paymentView.amount, paymentView.currency)}
                  </div>
                  <div>
                    <strong>Celular:</strong> {paymentView.phoneMasked ?? "—"}
                  </div>
                  <div>
                    <strong>Inicio:</strong>{" "}
                    {formatDate(paymentView.activationFullStartedAt)}
                  </div>
                  <div>
                    <strong>Vence:</strong>{" "}
                    {formatDate(paymentView.activationFullEndsAt)}
                  </div>
                  <div>
                    <strong>Clave:</strong>{" "}
                    <span style={codePillStyle}>
                      {paymentView.activationCode ?? "Procesando..."}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontWeight: 800 }}>
                  No se ha podido cargar el pago todavía.
                </div>
              )}

              {isAutoActivating ? (
                <div style={infoBoxStyle}>{actionLabels.autoLoadingText}</div>
              ) : null}

              {paymentError ? <div style={errorBoxStyle}>{paymentError}</div> : null}

              {warning ? (
                <div style={warningBoxStyle}>
                  {warning}

                  {forceTransfer ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={isAutoActivating}
                        onClick={() => activatePaidAccess(true)}
                        style={primaryButtonStyle}
                      >
                        {isAutoActivating
                          ? "Activando..."
                          : "Sí, activar aquí y desactivar el anterior"}
                      </button>

                      <button
                        type="button"
                        disabled={isAutoActivating}
                        onClick={() => {
                          setForceTransfer(false);
                          setWarning("");
                        }}
                        style={secondaryButtonStyle}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={planBoxStyle}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280" }}>
              Plan seleccionado
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
              {effectivePlanLabel}
            </div>
          </div>

          {autoSuccess ? (
            <SuccessBox
              title={actionLabels.successTitle}
              message={actionLabels.successMessage}
              plan={autoSuccess.plan}
              fullStartedAt={autoSuccess.fullStartedAt}
              fullEndsAt={autoSuccess.fullEndsAt}
            />
          ) : success ? (
            <SuccessBox
              title="Acceso activado correctamente"
              message="Tu clave quedó vinculada a este dispositivo."
              plan={success.plan}
              fullStartedAt={null}
              fullEndsAt={success.fullEndsAt}
            />
          ) : shouldShowManualForm ? (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={fieldLabelStyle}>Número de celular</span>

                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setForceTransfer(false);
                      setWarning("");
                    }}
                    placeholder="Ej. 4531234567"
                    inputMode="tel"
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={fieldLabelStyle}>Clave de activación</span>

                  <input
                    value={effectiveCode}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setForceTransfer(false);
                      setWarning("");
                    }}
                    placeholder="Ej. AIDA-7K82-MP4Q"
                    autoCapitalize="characters"
                    readOnly={Boolean(paymentView?.activationCode)}
                    style={{
                      ...inputStyle,
                      textTransform: "uppercase",
                      background: paymentView?.activationCode ? "#f9fafb" : "white",
                    }}
                  />
                </label>
              </div>

              {error ? <div style={errorBoxStyle}>{error}</div> : null}

              {!forceTransfer ? (
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  style={{
                    ...primaryButtonStyle,
                    marginTop: 20,
                    background:
                      canSubmit && !isSubmitting ? "#111827" : "#d1d5db",
                    cursor:
                      canSubmit && !isSubmitting ? "pointer" : "not-allowed",
                  }}
                >
                  {isSubmitting ? "Validando clave..." : "Activar acceso"}
                </button>
              ) : (
                <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitActivation(true)}
                    style={primaryButtonStyle}
                  >
                    {isSubmitting
                      ? "Activando en este dispositivo..."
                      : "Sí, activar aquí y desactivar el anterior"}
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setForceTransfer(false);
                      setWarning("");
                    }}
                    style={secondaryButtonStyle}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div style={infoBoxStyle}>
              Estamos terminando de confirmar tu pago. En unos segundos verás el
              estado final de tu acceso.
            </div>
          )}

          <a href="/pago" style={bottomLinkStyle}>
            Volver a planes
          </a>
        </div>
      </section>
    </main>
  );
}

function SuccessBox({
  title,
  message,
  plan,
  fullStartedAt,
  fullEndsAt,
}: {
  title: string;
  message: string;
  plan: string;
  fullStartedAt: string | null;
  fullEndsAt: string | null;
}) {
  return (
    <div style={successBoxStyle}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
        {title}
      </div>

      <p style={{ margin: "0 0 10px" }}>{message}</p>

      <div style={{ display: "grid", gap: 4, fontSize: 15 }}>
        <div>
          <strong>Plan:</strong> {normalizePlan(plan)}
        </div>
        <div>
          <strong>Inicio:</strong> {formatDate(fullStartedAt)}
        </div>
        <div>
          <strong>Vence:</strong> {formatDate(fullEndsAt)}
        </div>
      </div>

      <a href="/chat" style={chatButtonStyle}>
        Ir al chat
      </a>
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
  padding: 24,
  boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
};

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 18,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "#111827",
  color: "white",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 14,
};

const titleStyle: React.CSSProperties = {
  fontSize: 30,
  lineHeight: 1.1,
  margin: "0 0 10px",
  color: "#111827",
};

const paragraphStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.5,
  color: "#4b5563",
  margin: "0 0 22px",
};

const paymentBoxStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  borderRadius: 16,
  padding: 16,
  marginBottom: 18,
  color: "#14532d",
};

const planBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 16,
  padding: 16,
  marginBottom: 22,
};

const codePillStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: 6,
  background: "white",
  border: "1px solid #86efac",
  borderRadius: 12,
  padding: "8px 10px",
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: "0.04em",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
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

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 14,
  padding: "14px 16px",
  background: "#111827",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  padding: "12px 16px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const successBoxStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  borderRadius: 16,
  padding: 18,
  color: "#14532d",
  lineHeight: 1.5,
};

const chatButtonStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  borderRadius: 14,
  padding: "12px 16px",
  background: "#111827",
  color: "white",
  border: "none",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 15,
};

const bottomLinkStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  borderRadius: 14,
  padding: "12px 16px",
  background: "white",
  color: "#111827",
  border: "1px solid #e5e7eb",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 15,
};

const infoBoxStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 12,
  padding: 12,
  color: "#1e3a8a",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.45,
};

const warningBoxStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  borderRadius: 12,
  padding: 12,
  color: "#9a3412",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45,
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontSize: 14,
  fontWeight: 700,
};