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
      ui?: any;
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

export default function PagoTresMesesClient({
  isUpgrade,
}: {
  isUpgrade: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [isLoadingUser, setIsLoadingUser] = useState(isUpgrade);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState("");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  const confirmUrl = paymentId ? `/pago/regreso?paymentId=${paymentId}` : "";

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!isUpgrade || !deviceId) return;

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
      } catch (err: any) {
        if (cancelled) return;

        setError(
          err?.message ||
            "No se pudo cargar la información de tu cuenta para la extensión."
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
  }, [isUpgrade, deviceId]);

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
    if (isCreatingCheckout || checkoutStarted) return;

    setError("");

    if (!phone.trim()) {
      setError(
        isUpgrade
          ? "No se encontró el celular vinculado a tu cuenta."
          : "Ingresa tu número de celular."
      );
      return;
    }

    if (!deviceId) {
      setError("No se encontró el dispositivo. Actualiza la página e intenta de nuevo.");
      return;
    }

    setIsCreatingCheckout(true);

    try {
      const res = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: "3-meses",
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

      const url = data.sandboxInitPoint || data.initPoint;

      if (!url) {
        throw new Error("Mercado Pago no devolvió una URL de pago.");
      }

      setPaymentId(data.paymentId);
      setCheckoutUrl(url);
      setCheckoutStarted(true);

      openMercadoPago(url);
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

  const maskedPhone = phone ? `•••••${phone.slice(-4)}` : "No disponible";

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
          style={backLinkStyle}
        >
          ← Volver a planes
        </a>

        <div style={cardStyle}>
          <div
            style={{
              ...badgeStyle,
              background: isUpgrade ? "#ecfdf5" : "#111827",
              color: isUpgrade ? "#065f46" : "white",
              border: isUpgrade ? "1px solid #a7f3d0" : "none",
            }}
          >
            {isUpgrade ? "Extensión de cuenta" : "Plan recomendado"}
          </div>

          <h1 style={titleStyle}>
            {isUpgrade
              ? "Extender AIDA a plan de 3 meses"
              : "Activar AIDA por 3 meses"}
          </h1>

          <p style={paragraphStyle}>
            {isUpgrade
              ? "Tu pago anterior se toma como crédito. Solo pagas la diferencia para cambiar al plan de 3 meses."
              : "Este plan está pensado para acompañarte durante un proceso completo de control glucémico, cambio de hábitos y seguimiento educativo."}
          </p>

          <div style={priceBoxStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>
              Total a pagar
            </div>

            {isUpgrade ? (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <div style={{ color: "#6b7280", fontSize: 14, fontWeight: 700 }}>
                  Precio del paquete:{" "}
                  <span style={{ textDecoration: "line-through", fontWeight: 900 }}>
                    $1,500
                  </span>
                </div>

                <div style={{ color: "#166534", fontSize: 14, fontWeight: 800 }}>
                  Crédito de tu plan anterior: -$500
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 6 }}>
              <span style={priceStyle}>{isUpgrade ? "$1,000" : "$1,500"}</span>
              <span style={priceLabelStyle}>
                {isUpgrade ? "MXN pagas hoy" : "MXN / 90 días"}
              </span>
            </div>
          </div>

          <h2 style={sectionTitleStyle}>Incluye:</h2>

          <ul style={listStyle}>
            <li>✓ Acceso completo a AIDA durante 90 días</li>
            <li>✓ Seguimiento educativo de glucosa</li>
            <li>✓ Recomendaciones según tus lecturas</li>
            <li>✓ Acompañamiento para mejorar hábitos</li>
            <li>✓ Activación vinculada a tu dispositivo y número de celular</li>
          </ul>

          {isUpgrade ? (
            <div style={accountBoxStyle}>
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
            <div style={formBoxStyle}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Nombre</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  disabled={isCreatingCheckout || checkoutStarted}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle}>Número de celular</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 4531234567"
                  inputMode="tel"
                  disabled={isCreatingCheckout || checkoutStarted}
                  style={inputStyle}
                />
              </label>
            </div>
          )}

          <div style={infoBoxStyle}>
            El pago se abrirá en una pestaña de Mercado Pago. Cuando veas el
            mensaje <strong> “Tu pago ya se acreditó”</strong>, regresa a esta
            pestaña de AIDA y confirma tu acceso.
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
              disabled={isCreatingCheckout || isLoadingUser}
              style={{
                ...primaryButtonStyle,
                background:
                  isCreatingCheckout || isLoadingUser ? "#d1d5db" : "#111827",
                cursor:
                  isCreatingCheckout || isLoadingUser ? "not-allowed" : "pointer",
              }}
            >
              {isCreatingCheckout
                ? "Abriendo Mercado Pago..."
                : isLoadingUser
                  ? "Cargando datos..."
                  : isUpgrade
                    ? "Pagar extensión"
                    : "Continuar al pago"}
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

          <a href={isUpgrade ? "/pago?upgrade=1" : "/pago"} style={secondaryButtonStyle}>
            Volver a planes
          </a>
        </div>
      </section>
    </main>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  color: "#111827",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 18,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
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

const accountBoxStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  borderRadius: 14,
  padding: 14,
  color: "#14532d",
  fontSize: 14,
  lineHeight: 1.45,
  marginBottom: 20,
};

const formBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 20,
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
  marginBottom: 18,
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