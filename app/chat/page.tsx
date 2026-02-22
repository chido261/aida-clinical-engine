"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type OnboardingData = {
  name: string;
  age: string;
  heightCm: string;
  weightKg: string;
  diagnosis: "dm2" | "prediabetes" | "other" | "";
  meds: string;
  fastingPeakMgDl: string;
  postMealPeakMgDl: string;
  wakeTime: string; // "06:00"
  createdAt?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
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

export default function ChatPage() {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1) Cargar onboarding desde localStorage
  useEffect(() => {
    const data = safeParse<OnboardingData>(localStorage.getItem(LS_KEY));
    setOnboarding(data);
  }, []);

  // 2) Mensaje inicial (solo una vez)
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

  // 3) Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !isSending;
  }, [input, isSending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    // a) Agrega tu mensaje a la pantalla
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      // b) Llama a /api/chat enviando historial + onboarding
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          onboarding, // contexto para el modelo
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error al llamar /api/chat");
      }

      const data = (await res.json()) as { reply: string };

      // c) Agrega respuesta del asistente
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Tuve un problema técnico al responder 😕. Inténtalo de nuevo en unos segundos.",
        },
      ]);
      console.error(e);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía, Shift+Enter hace salto de línea
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
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

        {isSending && (
          <div style={{ opacity: 0.7, marginTop: 6 }}>AIDA está escribiendo…</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe aquí… (Enter para enviar, Shift+Enter salto de línea)"
          rows={2}
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 10,
            resize: "none",
          }}
          disabled={!onboarding || isSending}
        />
        <button
          onClick={handleSend}
          disabled={!canSend || !onboarding}
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
    </main>
  );
}
