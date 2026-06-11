// app/soporte/page.tsx

"use client";

import { useState } from "react";

const SUPPORT_WHATSAPP = "524531030592";
const SUPPORT_EMAIL = "soporte@bajatuglucosa.com";

function getTodayTicketDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

function generateShortCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < 4; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function createFolio() {
  return `FOLIO-${getTodayTicketDate()}-${generateShortCode()}`;
}

function encodeMessage(value: string) {
  return encodeURIComponent(value);
}

function buildWhatsappMessage(folio: string) {
  return [
    "Hola, necesito soporte de pagos o activación de AIDA.",
    "",
    `Folio: ${folio}`,
    "Motivo: ",
    "Nombre: ",
    "Teléfono registrado: ",
    "Plan o pago relacionado: ",
    "",
    "Importante: entiendo que este WhatsApp es solo para pagos, activaciones, códigos o cambio de dispositivo.",
  ].join("\n");
}

function buildEmailSubject(folio: string) {
  return `Soporte técnico AIDA - ${folio}`;
}

function buildEmailBody(folio: string) {
  return [
    "Hola, necesito soporte técnico de AIDA.",
    "",
    `Folio: ${folio}`,
    "Nombre: ",
    "Teléfono registrado: ",
    "Descripción del problema: ",
    "",
    "¿Qué estaba intentando hacer?",
    "",
    "¿Qué error apareció?",
    "",
    "Adjunto captura de pantalla para revisión.",
  ].join("\n");
}

export default function SoportePage() {
  const [folio, setFolio] = useState("");

  function openWhatsappSupport() {
    const newFolio = createFolio();
    setFolio(newFolio);

    const whatsappMessage = buildWhatsappMessage(newFolio);
    const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeMessage(
      whatsappMessage
    )}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function openEmailSupport() {
    const newFolio = createFolio();
    setFolio(newFolio);

    const emailSubject = buildEmailSubject(newFolio);
    const emailBody = buildEmailBody(newFolio);

    const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeMessage(
      emailSubject
    )}&body=${encodeMessage(emailBody)}`;

    window.location.href = emailUrl;
  }

  return (
    <main
      style={{
        maxWidth: 820,
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
          <h1 style={{ fontSize: 26, fontWeight: 950, margin: 0 }}>
            Soporte AIDA
          </h1>

          <p style={{ margin: "5px 0 0", color: "#4b5563", fontSize: 14 }}>
            Elige el canal correcto para que podamos ayudarte más rápido.
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
            fontSize: 13,
            color: "#6b7280",
            fontWeight: 800,
            marginBottom: 5,
          }}
        >
          Folio de atención
        </div>

        <div
          style={{
            display: "inline-block",
            border: "1px dashed #cbd5e1",
            background: "#f8fafc",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: folio ? 20 : 15,
            fontWeight: 950,
            letterSpacing: folio ? 0.5 : 0,
            color: "#111827",
          }}
        >
          {folio || "El folio se generará al abrir una solicitud de soporte."}
        </div>

        <p style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.45 }}>
          Conserva el folio en tu mensaje. Nos ayuda a identificar tu caso.
          Este folio no es una clave de activación.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            border: "1px solid #bbf7d0",
            borderRadius: 18,
            padding: 16,
            background: "#f0fdf4",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>

          <h2
            style={{
              fontSize: 20,
              fontWeight: 950,
              margin: "0 0 8px",
              color: "#14532d",
            }}
          >
            WhatsApp
          </h2>

          <p
            style={{
              fontSize: 14,
              color: "#166534",
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            Usa WhatsApp únicamente para temas de pago, activación, código de
            activación o cambio de dispositivo.
          </p>

          <div
            style={{
              border: "1px solid #86efac",
              background: "white",
              borderRadius: 14,
              padding: 12,
              color: "#14532d",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            <strong>WhatsApp atiende:</strong>
            <br />
            Pago aprobado pero cuenta no activada.
            <br />
            Problemas con código de activación.
            <br />
            Dudas sobre pago o renovación.
            <br />
            Cambio de dispositivo vinculado.
          </div>

          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              borderRadius: 14,
              padding: 12,
              color: "#991b1b",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 14,
              fontWeight: 700,
            }}
          >
            No uses WhatsApp para fallas de funcionamiento, errores de pantalla
            o problemas con el chat. Para eso usa correo y adjunta captura.
          </div>

          <button
            type="button"
            onClick={openWhatsappSupport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #16a34a",
              background: "#16a34a",
              color: "white",
              fontWeight: 950,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Abrir WhatsApp
          </button>
        </div>

        <div
          style={{
            border: "1px solid #bfdbfe",
            borderRadius: 18,
            padding: 16,
            background: "#eff6ff",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>

          <h2
            style={{
              fontSize: 20,
              fontWeight: 950,
              margin: "0 0 8px",
              color: "#1e3a8a",
            }}
          >
            Correo técnico
          </h2>

          <p
            style={{
              fontSize: 14,
              color: "#1e40af",
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            Usa correo para reportar fallas de funcionamiento. Puedes adjuntar
            capturas de pantalla para revisar mejor tu caso.
          </p>

          <div
            style={{
              border: "1px solid #93c5fd",
              background: "white",
              borderRadius: 14,
              padding: 12,
              color: "#1e3a8a",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            <strong>Correo atiende:</strong>
            <br />
            Errores en pantalla.
            <br />
            Problemas con el chat.
            <br />
            Problemas al cargar imágenes o archivos.
            <br />
            Fallas de funcionamiento de la app.
            <br />
            Reportes con capturas de pantalla.
          </div>

          <div
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              borderRadius: 14,
              padding: 12,
              color: "#92400e",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 14,
              fontWeight: 700,
            }}
          >
            Para pagos, activaciones o códigos, usa WhatsApp. Así evitamos
            mezclar reportes técnicos con soporte de acceso.
          </div>

          <button
            type="button"
            onClick={openEmailSupport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #1d4ed8",
              background: "#1d4ed8",
              color: "white",
              fontWeight: 950,
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Enviar correo
          </button>
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
            fontWeight: 950,
            margin: "0 0 10px",
            color: "#111827",
          }}
        >
          Horario de soporte
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Lunes a viernes
            </div>
            <div style={{ fontSize: 16, fontWeight: 950, marginTop: 4 }}>
              9:00 a.m. a 7:00 p.m.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Sábados
            </div>
            <div style={{ fontSize: 16, fontWeight: 950, marginTop: 4 }}>
              9:00 a.m. a 2:00 p.m.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "#f9fafb",
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800 }}>
              Domingos
            </div>
            <div style={{ fontSize: 16, fontWeight: 950, marginTop: 4 }}>
              Sin soporte
            </div>
          </div>
        </div>

        <p style={{ color: "#4b5563", fontSize: 13, lineHeight: 1.45 }}>
          Responderemos a la brevedad dentro del horario laboral. Los mensajes
          enviados fuera de horario serán revisados en el siguiente periodo de
          atención.
        </p>
      </section>
    </main>
  );
}