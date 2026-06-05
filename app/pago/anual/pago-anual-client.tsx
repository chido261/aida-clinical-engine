"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type CheckoutResponse =
  | {
      ok: true;
      paymentId: number;
      preferenceId: string;
      initPoint?: string | null;
      sandboxInitPoint?: string | null;
      amount?: number;
      amountPesos?: number;
      plan?: string;
      upgrade?: boolean;
      currentPlan?: string | null;
      creditCents?: number;
    }
  | {
      ok: false;
      error: string;
      message?: string;
    };

type UserStatusResponse =
  | {
      ok: true;
      ui?: {
        upgradeOffer?: {
          eligible?: boolean;
          currentPlan?: string | null;
        } | null;
      };
      user?: {
        name?: string | null;
        phoneE164?: string | null;
      };
    }
  | {
      ok: false;
      error: string;
      message?: string;
    };

type CurrentPlan = "mensual" | "3-meses" | "anual" | null;

async function safeReadJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function phoneForCheckout(phoneE164: string | null | undefined) {
  const raw = String(phoneE164 || "").trim();

  if (!raw) return "";

  if (raw.startsWith("+52")) {
    return raw.replace("+52", "");
  }

  return raw;
}

function normalizeCurrentPlan(value: string | null | undefined): CurrentPlan {
  const plan = String(value || "").toLowerCase().trim();

  if (plan === "mensual") return "mensual";
  if (plan === "3-meses") return "3-meses";
  if (plan === "trimestral") return "3-meses";
  if (plan === "anual") return "anual";

  return null;
}

function getUpgradeCredit(currentPlan: CurrentPlan) {
  if (currentPlan === "mensual") return 500;
  if (currentPlan === "3-meses") return 1500;
  return 0;
}

function getAmountToday({
  isUpgrade,
  isRenewal,
  hasAnnualDiscount,
  currentPlan,
}: {
  isUpgrade: boolean;
  isRenewal: boolean;
  hasAnnualDiscount: boolean;
  currentPlan: CurrentPlan;
}) {
  if (isRenewal && hasAnnualDiscount) return 2100;
  if (isUpgrade) return Math.max(0, 3000 - getUpgradeCredit(currentPlan));
  return 3000;
}

export default function PagoAnualClient({
  isUpgrade,
  isRenewal,
  hasAnnualDiscount,
}: {
  isUpgrade: boolean;
  isRenewal: boolean;
  hasAnnualDiscount: boolean;
}) {
  const shouldUseLinkedAccount = isUpgrade || isRenewal;

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(shouldUseLinkedAccount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!shouldUseLinkedAccount || !deviceId) return;

    let cancelled = false;

    async function loadUserStatus() {
      setIsLoadingUser(true);
      setError("");

      try {
        const res = await fetch("/api/user-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });

        const data = (await safeReadJson(res)) as UserStatusResponse | null;

        if (!res.ok || !data || !data.ok) {
          throw new Error(
            (data as any)?.message ||
              (data as any)?.error ||
              "No se pudo cargar la información de tu cuenta."
          );
        }

        if (cancelled) return;

        setName(data.user?.name || "");
        setPhone(phoneForCheckout(data.user?.phoneE164));
        setCurrentPlan(normalizeCurrentPlan(data.ui?.upgradeOffer?.currentPlan));
      } catch (err: any) {
        if (cancelled) return;

        setError(
          err?.message ||
            "No se pudo cargar la información de tu cuenta."
        );
      } finally {
        if (!cancelled) {
          setIsLoadingUser(false);
        }
      }
    }

    loadUserStatus();

    return () => {
      cancelled = true;
    };
  }, [shouldUseLinkedAccount, deviceId]);

  async function handleCheckout() {
    if (isSubmitting) return;

    setError("");

    if (!phone.trim()) {
      setError(
        shouldUseLinkedAccount
          ? "No se encontró el celular vinculado a tu cuenta."
          : "Ingresa tu número de celular."
      );
      return;
    }

    if (!deviceId) {
      setError("No se encontró el dispositivo. Actualiza la página e intenta de nuevo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: "anual",
          phone,
          name,
          deviceId,
          upgrade: isUpgrade,
        }),
      });

      const data = (await safeReadJson(res)) as CheckoutResponse | null;

      if (!res.ok || !data || !data.ok) {
        throw new Error(
          (data as any)?.message ||
            (data as any)?.error ||
            "No se pudo crear el checkout."
        );
      }

      const url = data.initPoint || data.sandboxInitPoint;

      if (!url) {
        throw new Error("Mercado Pago no devolvió una URL de pago.");
      }

      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar el pago.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const amountToday = getAmountToday({
    isUpgrade,
    isRenewal,
    hasAnnualDiscount,
    currentPlan,
  });

  const credit = getUpgradeCredit(currentPlan);

  const maskedPhone = phone ? `•••••${phone.slice(-4)}` : "No disponible";

  const badge = isUpgrade
    ? "Extensión de cuenta"
    : isRenewal
      ? "Renovación anual"
      : "Mayor ahorro";

  const title = isUpgrade
    ? "Extender AIDA a plan anual"
    : isRenewal
      ? "Renovar AIDA por 1 año"
      : "Activar AIDA por 1 año";

  const description = isUpgrade
    ? currentPlan === "3-meses"
      ? "Tu plan trimestral se toma como crédito. Solo pagas la diferencia para cambiar al plan anual."
      : "Tu pago anterior se toma como crédito. Solo pagas la diferencia para cambiar al plan anual."
    : isRenewal
      ? "Renueva tu plan anual y mantén tu acompañamiento activo durante 12 meses más."
      : "Este plan es ideal si quieres mantener acompañamiento continuo, seguimiento educativo y apoyo durante todo el año.";

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
      <section style={{ maxWidth: 720, margin: "0 auto" }}>
        <a
          href={isUpgrade ? "/pago?upgrade=1" : "/pago"}
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
              background: isUpgrade || isRenewal ? "#ecfdf5" : "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            {badge}
          </div>

          <h1
            style={{
              fontSize: 30,
              lineHeight: 1.1,
              margin: "0 0 10px",
              color: "#111827",
            }}
          >
            {title}
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              color: "#4b5563",
              margin: "0 0 22px",
            }}
          >
            {description}
          </p>

          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>
              Total a pagar
            </div>

            {isUpgrade ? (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Precio del paquete:{" "}
                  <span
                    style={{
                      textDecoration: "line-through",
                      fontWeight: 900,
                    }}
                  >
                    $3,000
                  </span>
                </div>

                <div
                  style={{
                    color: "#166534",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  Crédito de tu plan anterior: -${credit.toLocaleString("es-MX")}
                </div>
              </div>
            ) : isRenewal && hasAnnualDiscount ? (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  Precio normal:{" "}
                  <span
                    style={{
                      textDecoration: "line-through",
                      fontWeight: 900,
                    }}
                  >
                    $3,000
                  </span>
                </div>

                <div
                  style={{
                    color: "#166534",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  Descuento por renovación anticipada: -$900
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "#111827",
                }}
              >
                ${amountToday.toLocaleString("es-MX")}
              </span>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#6b7280",
                }}
              >
                {isUpgrade || isRenewal
                  ? "MXN pagas hoy"
                  : "MXN / 12 meses"}
              </span>
            </div>
          </div>

          <h2
            style={{
              fontSize: 18,
              margin: "0 0 10px",
              color: "#111827",
            }}
          >
            Incluye:
          </h2>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 22px",
              display: "grid",
              gap: 10,
              color: "#374151",
              fontSize: 15,
            }}
          >
            <li>✓ Acceso completo a AIDA durante 12 meses</li>
            <li>✓ Seguimiento educativo de glucosa</li>
            <li>✓ Recomendaciones según tus lecturas</li>
            <li>✓ Ideal para mantenimiento y seguimiento continuo</li>
            <li>✓ Mayor ahorro frente al pago mensual</li>
            <li>✓ Activación vinculada a tu dispositivo y número de celular</li>
          </ul>

          {shouldUseLinkedAccount ? (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: 14,
                padding: 14,
                color: "#14532d",
                fontSize: 14,
                lineHeight: 1.45,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 4 }}>
                Datos de tu cuenta
              </div>

              {isLoadingUser ? (
                <div>Cargando datos vinculados...</div>
              ) : (
                <>
                  <div>
                    <strong>Nombre:</strong> {name || "No disponible"}
                  </div>
                  <div>
                    <strong>Celular:</strong> {maskedPhone}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                  Nombre
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                  Número de celular
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 4531234567"
                  inputMode="tel"
                  style={inputStyle}
                />
              </label>
            </div>
          )}

          {error ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                borderRadius: 14,
                padding: 12,
                color: "#991b1b",
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || isLoadingUser}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              borderRadius: 14,
              padding: "14px 16px",
              background: isSubmitting || isLoadingUser ? "#d1d5db" : "#111827",
              color: "white",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 16,
              border: "none",
              cursor: isSubmitting || isLoadingUser ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting
              ? "Preparando pago..."
              : isLoadingUser
                ? "Cargando datos..."
                : isUpgrade
                  ? "Pagar extensión"
                  : isRenewal
                    ? "Pagar renovación"
                    : "Continuar al pago"}
          </button>

          <a
            href={isUpgrade ? "/pago?upgrade=1" : "/pago"}
            style={{
              marginTop: 12,
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 16,
  outline: "none",
};