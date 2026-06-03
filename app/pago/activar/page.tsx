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
        status: string;
        plan: string;
        amount: number;
        currency: string;
        durationDays: number;
        phoneMasked: string | null;
        approvedAt: string | null;
        createdAt: string;
        activationCode: string | null;
        activationFullEndsAt: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

function normalizePlan(value: string | null) {
  if (value === "mensual") return "mensual";
  if (value === "3-meses") return "3 meses";
  if (value === "anual") return "anual";
  return "AIDA";
}

function formatDate(value: string | null) {
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

export default function PagoActivarPage() {
  return (
    <Suspense fallback={<PagoActivarFallback />}>
      <PagoActivarContent />
    </Suspense>
  );
}

function PagoActivarFallback() {
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
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
            color: "#4b5563",
            fontWeight: 800,
          }}
        >
          Cargando activación...
        </div>
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

  const effectivePlanLabel = payment?.plan
    ? normalizePlan(payment.plan)
    : selectedPlanLabel;

  const effectiveCode = payment?.activationCode ?? code;

  const canSubmit = useMemo(() => {
    return phone.trim().length >= 10 && effectiveCode.trim().length >= 8;
  }, [phone, effectiveCode]);

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
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <a
          href="/pago"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#111827",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          ← Volver a planes
        </a>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
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
              marginBottom: 14,
            }}
          >
            Activación de acceso
          </div>

          <h1
            style={{
              fontSize: 30,
              lineHeight: 1.1,
              margin: "0 0 10px",
              color: "#111827",
            }}
          >
            Activa tu clave de AIDA
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              color: "#4b5563",
              margin: "0 0 22px",
            }}
          >
            Ingresa el celular con el que realizaste tu pago. Si tu pago ya fue
            aprobado, aquí verás tu clave de activación.
          </p>

          {paymentId ? (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
                color: "#14532d",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
                Estado del pago
              </div>

              {isLoadingPayment ? (
                <div style={{ fontWeight: 800 }}>Consultando pago...</div>
              ) : paymentError ? (
                <div style={{ color: "#991b1b", fontWeight: 800 }}>
                  {paymentError}
                </div>
              ) : payment ? (
                <div style={{ display: "grid", gap: 6, fontSize: 15 }}>
                  <div>
                    <strong>Pago:</strong> #{payment.id}
                  </div>
                  <div>
                    <strong>Estado:</strong>{" "}
                    {payment.status === "approved" ? "Aprobado" : payment.status}
                  </div>
                  <div>
                    <strong>Monto:</strong>{" "}
                    {formatMoneyCents(payment.amount, payment.currency)}
                  </div>
                  <div>
                    <strong>Celular:</strong> {payment.phoneMasked ?? "—"}
                  </div>
                  <div>
                    <strong>Clave:</strong>{" "}
                    <span
                      style={{
                        display: "inline-flex",
                        marginTop: 6,
                        background: "white",
                        border: "1px solid #86efac",
                        borderRadius: 12,
                        padding: "8px 10px",
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {payment.activationCode ?? "Procesando..."}
                    </span>
                  </div>
                  <div>
                    <strong>Vence:</strong>{" "}
                    {formatDate(payment.activationFullEndsAt)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              borderRadius: 16,
              padding: 16,
              marginBottom: 22,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280" }}>
              Plan seleccionado
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
              {effectivePlanLabel}
            </div>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Número de celular
                  </span>

                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setForceTransfer(false);
                      setWarning("");
                    }}
                    placeholder="Ej. 4531234567"
                    inputMode="tel"
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Clave de activación
                  </span>

                  <input
                    value={effectiveCode}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setForceTransfer(false);
                      setWarning("");
                    }}
                    placeholder="Ej. AIDA-7K82-MP4Q"
                    autoCapitalize="characters"
                    readOnly={Boolean(payment?.activationCode)}
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                      textTransform: "uppercase",
                      background: payment?.activationCode ? "#f9fafb" : "white",
                    }}
                  />
                </label>
              </div>

              {warning ? (
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid #fed7aa",
                    background: "#fff7ed",
                    borderRadius: 12,
                    padding: 12,
                    color: "#9a3412",
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {warning}
                </div>
              ) : null}

              {error ? (
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    borderRadius: 12,
                    padding: 12,
                    color: "#991b1b",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {!forceTransfer ? (
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  style={{
                    marginTop: 20,
                    width: "100%",
                    border: "none",
                    borderRadius: 14,
                    padding: "14px 16px",
                    background:
                      canSubmit && !isSubmitting ? "#111827" : "#d1d5db",
                    color: "white",
                    fontWeight: 900,
                    fontSize: 16,
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
                    style={{
                      width: "100%",
                      border: "none",
                      borderRadius: 14,
                      padding: "14px 16px",
                      background: "#111827",
                      color: "white",
                      fontWeight: 900,
                      fontSize: 16,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
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
                    style={{
                      width: "100%",
                      borderRadius: 14,
                      padding: "12px 16px",
                      background: "white",
                      color: "#111827",
                      border: "1px solid #e5e7eb",
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: 16,
                padding: 18,
                color: "#14532d",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
                Acceso activado correctamente
              </div>

              <p style={{ margin: "0 0 10px" }}>
                Tu clave quedó vinculada a este dispositivo.
              </p>

              <div style={{ display: "grid", gap: 4, fontSize: 15 }}>
                <div>
                  <strong>Plan:</strong> {success.plan}
                </div>
                <div>
                  <strong>Vigencia:</strong> {formatDate(success.fullEndsAt)}
                </div>
              </div>

              <a
                href="/chat"
                style={{
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
                }}
              >
                Ir al chat
              </a>
            </div>
          )}

          <a
            href="/pago"
            style={{
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
            }}
          >
            Volver a planes
          </a>
        </div>
      </section>
    </main>
  );
}