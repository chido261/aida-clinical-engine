"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function safeReadText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default function Chat2Page() {
  const [deviceId, setDeviceId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hola, soy AIDA2 👋\n\nEstoy en modo limpio de desarrollo. Puedo orientarte sobre comida, ejercicio, glucosa, protocolos y medicamentos en diabetes tipo 2.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !isSending && !!deviceId;
  }, [input, isSending, deviceId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || !deviceId) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          messages: nextMessages,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          safeReadText(data?.error) || "Error al llamar /api/chat2"
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: safeReadText(data.reply) || "No pude responder ahora.",
        },
      ]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.message ||
            "Tuve un problema técnico al responder. Inténtalo de nuevo.",
        },
      ]);
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
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: 16,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>AIDA2</h1>
        <p style={{ fontSize: 13, opacity: 0.7, margin: "4px 0 0" }}>
          Chat limpio de desarrollo · Cerebro nuevo
        </p>
      </header>

      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <div
              key={index}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                borderRadius: 16,
                padding: "10px 12px",
                background: isUser ? "#111827" : "#f3f4f6",
                color: isUser ? "white" : "#111827",
                whiteSpace: "pre-wrap",
                fontSize: 15,
                lineHeight: 1.4,
              }}
            >
              {message.content}
            </div>
          );
        })}

        {isSending ? (
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 16,
              padding: "10px 12px",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 15,
            }}
          >
            Pensando...
          </div>
        ) : null}

        <div ref={bottomRef} />
      </section>

      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: 12,
          display: "flex",
          gap: 8,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe aquí..."
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #d1d5db",
            borderRadius: 14,
            padding: "10px 12px",
            fontSize: 15,
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            border: "none",
            borderRadius: 14,
            padding: "0 16px",
            background: canSend ? "#111827" : "#9ca3af",
            color: "white",
            fontWeight: 700,
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          Enviar
        </button>
      </footer>
    </main>
  );
}