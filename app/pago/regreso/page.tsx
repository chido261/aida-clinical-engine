"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PagoRegresoPage() {
  return (
    <Suspense fallback={<PagoRegresoFallback />}>
      <PagoRegresoContent />
    </Suspense>
  );
}

function PagoRegresoFallback() {
  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={cardStyle}>Preparando confirmación...</div>
      </section>
    </main>
  );
}

function PagoRegresoContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const [seconds, setSeconds] = useState(3);

  const activateUrl = paymentId
    ? `/pago/activar?paymentId=${encodeURIComponent(paymentId)}`
    : "/pago";

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      window.location.href = activateUrl;
    }, 3000);

    const countdownTimer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [activateUrl]);

  return (
    <main style={pageStyle}>
      <section style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={cardStyle}>
          <div style={badgeStyle}>Pago recibido</div>

          <h1 style={titleStyle}>Estamos confirmando tu acceso</h1>

          <p style={paragraphStyle}>
            Tu pago fue procesado por Mercado Pago. Ahora AIDA verificará la
            operación y activará o extenderá tu cuenta automáticamente.
          </p>

          <div style={infoBoxStyle}>
            Te llevaremos a la pantalla de activación en {seconds} segundo(s).
          </div>

          <a href={activateUrl} style={primaryLinkStyle}>
            Continuar ahora
          </a>

          <a href="/pago" style={secondaryLinkStyle}>
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

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 900,
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
  margin: "0 0 18px",
};

const infoBoxStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 14,
  padding: 14,
  color: "#1e3a8a",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.45,
  marginBottom: 18,
};

const primaryLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  borderRadius: 14,
  padding: "14px 16px",
  background: "#111827",
  color: "white",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 16,
};

const secondaryLinkStyle: React.CSSProperties = {
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