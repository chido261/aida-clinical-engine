"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type UserStatusResponse =
  | {
      ok: true;
      user?: {
        name?: string | null;
        phoneE164?: string | null;
      };
    }
  | {
      ok: false;
      error?: string;
    };

type CheckoutResponse =
  | {
      ok: true;
      paymentId: number;
      initPoint?: string | null;
      sandboxInitPoint?: string | null;
    }
  | {
      ok: false;
      error?: string;
      message?: string;
    };

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhoneForInput(value: string | null | undefined) {
  const digits = onlyDigits(value || "");

  if (digits.length === 12 && digits.startsWith("52")) {
    return digits.slice(2);
  }

  if (digits.length === 13 && digits.startsWith("521")) {
    return digits.slice(3);
  }

  return digits;
}

export default function PagoMensualPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  const canCreateCheckout =
    phone.trim().length >= 10 && !isLoadingUser && !isCreatingCheckout;

  const confirmUrl = paymentId ? `/pago/regreso?paymentId=${paymentId}` : "";

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setIsLoadingUser(true);
      setError("");

      try {
        const deviceId = getDeviceId();

        const res = await fetch("/api/user-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            deviceId,
          }),
        });

        const data = (await res.json().catch(() => null)) as
          | UserStatusResponse
          | null;

        if (cancelled) return;

        if (res.ok && data?.ok) {
          setName(data.user?.name ?? "");
          setPhone(normalizePhoneForInput(data.user?.phoneE164));
        }
      } catch {
        // No bloqueamos el pago si no se puede cargar el usuario.
      } finally {
        if (!cancelled) {
          setIsLoadingUser(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  function openMercadoPago(url: string) {
    const opened = window.open(url, "_blank");

    if (!opened) {
      setError(
        "Tu navegador bloqueó la pestaña de Mercado Pago. Usa el botón “Abrir Mercado Pago” para continuar."
      );
      return false;
    }

    return true;
  }

  async function handleCheckout() {
    if (!canCreateCheckout) return;

    setIsCreatingCheckout(true);
    setError("");

    try {
      const deviceId = getDeviceId();

      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: "mensual",
          phone,
          name,
          deviceId,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | CheckoutResponse
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(
          (data as any)?.message ||
            (data as any)?.error ||
            "No se pudo iniciar el pago."
        );
      }

      const nextCheckoutUrl = data.sandboxInitPoint || data.initPoint;

      if (!nextCheckoutUrl) {
        throw new Error("No se recibió el enlace de pago.");
      }

      setPaymentId(data.paymentId);
      setCheckoutUrl(nextCheckoutUrl);
      setCheckoutStarted(true);

      openMercadoPago(nextCheckoutUrl);
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar el pago.");
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  function handleOpenExistingCheckout() {
    if (!checkoutUrl) {
      setError("No se encontró el enlace de Mercado Pago. Intenta iniciar el pago nuevamente.");
      return;
    }

    setError("");
    openMercadoPago(checkoutUrl);
  }

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 720, margin: "0 auto" }}>
        <a href="/pago" style={backLinkStyle}>
          ← Volver a planes
        </a>

        <div style={cardStyle}>
          <div style={badgeStyle}>Plan flexible</div>

          <h1 style={titleStyle}>Activar AIDA por 1 mes</h1>

          <p style={paragraphStyle}>
            Este plan es ideal si quieres continuar usando AIDA sin compromiso
            largo y probar el acompañamiento completo durante 30 días.
          </p>

          <div style={priceBoxStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>
              Total a pagar
            </div>

            <div style={{ marginTop: 6 }}>
              <span style={priceStyle}>$500</span>
              <span style={priceLabelStyle}>MXN / 30 días</span>
            </div>
          </div>

          <h2 style={sectionTitleStyle}>Incluye:</h2>

          <ul style={listStyle}>
            <li>✓ Acceso completo a AIDA durante 30 días</li>
            <li>✓ Seguimiento educativo de glucosa</li>
            <li>✓ Recomendaciones según tus lecturas</li>
            <li>✓ Ideal para continuar después de la prueba gratuita</li>
            <li>✓ Activación vinculada a tu dispositivo y número de celular</li>
          </ul>

          <div style={formBoxStyle}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>
              Datos para tu acceso
            </div>

            <label style={labelStyle}>
              <span style={fieldLabelStyle}>Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                disabled={isLoadingUser || isCreatingCheckout || checkoutStarted}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span style={fieldLabelStyle}>Celular</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Ej. 4531234567"
                inputMode="tel"
                disabled={isLoadingUser || isCreatingCheckout || checkoutStarted}
                style={inputStyle}
              />
            </label>

            <div style={infoBoxStyle}>
              El pago se abrirá en una pestaña de Mercado Pago. Cuando veas el
              mensaje <strong> “Tu pago ya se acreditó”</strong>, regresa a esta
              pestaña de AIDA y confirma tu acceso.
            </div>
          </div>

          {checkoutStarted && paymentId ? (
            <div style={confirmBoxStyle}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                Pago en proceso
              </div>

              <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 12 }}>
                Completa tu pago en Mercado Pago. No cierres esta pestaña de
                AIDA. Cuando termines el pago, vuelve aquí y confirma tu acceso.
              </div>

              <button
                type="button"
                onClick={handleOpenExistingCheckout}
                style={openPaymentButtonStyle}
              >
                Abrir Mercado Pago
              </button>

              <a href={confirmUrl} style={confirmButtonStyle}>
                Ya realicé mi pago, confirmar acceso
              </a>
            </div>
          ) : null}

          {error ? <div style={errorBoxStyle}>{error}</div> : null}

          {!checkoutStarted ? (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!canCreateCheckout}
              style={{
                ...primaryButtonStyle,
                background: canCreateCheckout ? "#111827" : "#d1d5db",
                cursor: canCreateCheckout ? "pointer" : "not-allowed",
              }}
            >
              {isCreatingCheckout
                ? "Abriendo Mercado Pago..."
                : isLoadingUser
                  ? "Cargando datos..."
                  : "Pagar con Mercado Pago"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              style={{
                ...primaryButtonStyle,
                background: "#d1d5db",
                cursor: "not-allowed",
              }}
            >
              Pago abierto en Mercado Pago
            </button>
          )}

          <a href="/pago" style={secondaryButtonStyle}>
            Volver a planes
          </a>
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
  background: "#fff7ed",
  color: "#111827",
  border: "1px solid #fed7aa",
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

const priceBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 16,
  padding: 18,
  marginBottom: 20,
};

const priceStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
  color: "#111827",
};

const priceLabelStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 15,
  fontWeight: 700,
  color: "#6b7280",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18,
  margin: "0 0 10px",
  color: "#111827",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 22px",
  display: "grid",
  gap: 10,
  color: "#374151",
  fontSize: 15,
};

const formBoxStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 16,
  padding: 16,
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
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

const infoBoxStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 12,
  padding: 12,
  color: "#1e3a8a",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.45,
};

const confirmBoxStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  borderRadius: 14,
  padding: 14,
  color: "#14532d",
  marginBottom: 16,
};

const openPaymentButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  padding: "12px 14px",
  background: "white",
  color: "#14532d",
  border: "1px solid #86efac",
  fontWeight: 900,
  fontSize: 15,
  marginBottom: 10,
  cursor: "pointer",
};

const confirmButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#14532d",
  color: "white",
  fontWeight: 900,
  fontSize: 15,
  textDecoration: "none",
};

const errorBoxStyle: React.CSSProperties = {
  marginBottom: 16,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  borderRadius: 12,
  padding: 12,
  color: "#991b1b",
  fontSize: 14,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 14,
  padding: "14px 16px",
  border: "none",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
};

const secondaryButtonStyle: React.CSSProperties = {
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
};