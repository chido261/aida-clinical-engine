"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type OnboardingData = {
  name: string;
  age: string;
  heightCm: string;
  weightKg: string;
  diagnosis: "dm2" | "prediabetes" | "other" | "";
  meds: string;
  fastingPeakMgDl: string;
  postMealPeakMgDl: string;
  wakeTime: string;
  createdAt?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Paywall = {
  title: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
};

const LS_KEY = "glucosa_onboarding_v1";

function safeParse<T>(value: string | null): T | null {
  try {
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function safeReadJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [deviceId, setDeviceId] = useState<string>("");

  const [paywall, setPaywall] = useState<Paywall | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    const data = safeParse<OnboardingData>(localStorage.getItem(LS_KEY));
    setOnboarding(data);
  }, []);

  useEffect(() => {
    if (!onboarding) return;

    const fasting = Number(onboarding.fastingPeakMgDl);
    const postMeal = Number(onboarding.postMealPeakMgDl);

    const focus =
      postMeal > fasting
        ? "cómo responde tu cuerpo a los alimentos"
        : "tu balance de alimentos y horarios de comidas";

    const wakeTime = onboarding.wakeTime || "06:00";

    setMessages((prev) =>
      prev.length
        ? prev
        : [
            {
              role: "assistant",
              content: `Hola ${onboarding.name} 👋

Gracias por compartir tus datos. Para comenzar, me enfocaré en ${focus}.

☀️ Como normalmente despiertas a las ${wakeTime}, te voy a pedir tu lectura en ayunas alrededor de esa hora todos los días.

Cuando quieras, dime:
- ¿Qué sueles desayunar?
- o ¿Cuál fue tu última lectura de glucosa?`,
            },
          ]
    );
  }, [onboarding]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, paywall]);

  const chatLocked = !!paywall;

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !isSending && !!deviceId && !!onboarding && !chatLocked;
  }, [input, isSending, deviceId, onboarding, chatLocked]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || !deviceId || !onboarding || chatLocked) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          messages: nextMessages,
          onboarding,
        }),
      });

      // ✅ 402 Trial expired => paywall
      if (res.status === 402) {
        const data = await safeReadJson(res);

        const pw: Paywall = data?.paywall
          ? {
              title: String(data.paywall.title ?? "Tu prueba gratuita terminó"),
              message: String(
                data.paywall.message ??
                  "Gracias por usar nuestra versión de prueba de AIDA. Para continuar usando la versión completa por 1 año realiza tu pago en el siguiente botón."
              ),
              ctaText: String(data.paywall.ctaText ?? "Pagar 1 año"),
              ctaUrl: String(data.paywall.ctaUrl ?? "/pago"),
            }
          : {
              title: "Tu prueba gratuita terminó",
              message:
                "Gracias por usar nuestra versión de prueba de AIDA. Para continuar usando la versión completa por 1 año realiza tu pago en el siguiente botón.",
              ctaText: "Pagar 1 año",
              ctaUrl: "/pago",
            };

        setPaywall(pw);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Tu prueba gratuita terminó. Para continuar con la versión completa, realiza tu pago desde el botón que te muestro.",
          },
        ]);

        return;
      }

      // ✅ 429 Rate limit => mensaje claro, sin “problema técnico”
      if (res.status === 429) {
        const data = await safeReadJson(res);
        const msg =
          (typeof data?.error === "string" && data.error) ||
          "Límite diario alcanzado. Intenta mañana.";

        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
        return;
      }

      if (!res.ok) {
        const data = await safeReadJson(res);
        const msg = (typeof data?.error === "string" && data.error) || "Error al llamar /api/chat";
        throw new Error(msg);
      }

      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Tuve un problema técnico al responder 😕. Inténtalo de nuevo en unos segundos.",
        },
      ]);
      console.error(e);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, position: "relative" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>AIDA</h1>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          height: "70vh",
          overflowY: "auto",
          background: "white",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "85%",
                padding: "10px 12px",
                borderRadius: 12,
                whiteSpace: "pre-wrap",
                border: "1px solid #e5e7eb",
                background: m.role === "user" ? "#f3f4f6" : "white",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {isSending && <div style={{ opacity: 0.7, marginTop: 6 }}>AIDA está escribiendo…</div>}

        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            chatLocked
              ? "Tu prueba terminó. Realiza tu pago para continuar."
              : "Escribe aquí… (Enter para enviar, Shift+Enter salto de línea)"
          }
          rows={2}
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 10,
            resize: "none",
          }}
          disabled={!onboarding || isSending || !deviceId || chatLocked}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            padding: "0 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: canSend ? "black" : "#9ca3af",
            color: "white",
            fontWeight: 600,
          }}
        >
          Enviar
        </button>
      </div>

      {!onboarding && (
        <p style={{ marginTop: 10, opacity: 0.75 }}>
          No encontré tu onboarding. Ve a <b>/onboarding</b> y completa tus datos.
        </p>
      )}

      {paywall && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{paywall.title}</div>
                <div style={{ marginTop: 8, opacity: 0.9, whiteSpace: "pre-wrap" }}>{paywall.message}</div>
              </div>

              <button
                onClick={() => setPaywall(null)}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "white",
                  borderRadius: 10,
                  padding: "6px 10px",
                  height: 34,
                  cursor: "pointer",
                }}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <a
                href={paywall.ctaUrl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "black",
                  color: "white",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {paywall.ctaText}
              </a>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Si cambias de dispositivo, después agregaremos un flujo de revocación de licencia.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}