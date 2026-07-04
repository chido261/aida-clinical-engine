"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type RenderLine =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "space";
    }
  | {
      type: "bullet";
      text: string;
    }
  | {
      type: "number";
      number: string;
      text: string;
    };

function safeReadText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeMessage(content: string) {
  return content
    .replace(/(?<!\w)\s+(?=\d+\.\s)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseContent(content: string): RenderLine[] {
  const normalized = normalizeMessage(content);
  const rawLines = normalized.split("\n");

  const result: RenderLine[] = [];
  let paragraphBuffer: string[] = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) return;

    result.push({
      type: "paragraph",
      text: paragraphBuffer.join(" "),
    });

    paragraphBuffer = [];
  }

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();

      if (result.length && result[result.length - 1].type !== "space") {
        result.push({ type: "space" });
      }

      return;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);

    if (numberedMatch) {
      flushParagraph();

      result.push({
        type: "number",
        number: numberedMatch[1],
        text: numberedMatch[2],
      });

      return;
    }

    if (/^[-•]\s+/.test(line)) {
      flushParagraph();

      result.push({
        type: "bullet",
        text: line.replace(/^[-•]\s+/, ""),
      });

      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph();

  return result.filter((line, index, array) => {
    if (line.type !== "space") return true;
    if (index === 0 || index === array.length - 1) return false;
    return true;
  });
}

function renderMessageContent(content: string) {
  const lines = parseContent(content);

  return lines.map((line, index) => {
    if (line.type === "space") {
      return <div key={index} style={{ height: 4 }} />;
    }

    const previous = lines[index - 1];
    const isAfterSpace = previous?.type === "space";
    const isFirst = index === 0;

    if (line.type === "number") {
      return (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            marginTop: isFirst || isAfterSpace ? 0 : 8,
            paddingLeft: 8,
          }}
        >
          <span
            style={{
              minWidth: 18,
              fontWeight: 600,
            }}
          >
            {line.number}.
          </span>
          <span>{line.text}</span>
        </div>
      );
    }

    if (line.type === "bullet") {
      return (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            marginTop: isFirst || isAfterSpace ? 0 : 8,
            paddingLeft: 8,
          }}
        >
          <span>•</span>
          <span>{line.text}</span>
        </div>
      );
    }

    return (
      <p
        key={index}
        style={{
          margin: isFirst || isAfterSpace ? 0 : "10px 0 0",
        }}
      >
        {line.text}
      </p>
    );
  });
}

const FALLBACK_WELCOME =
  "Hola, soy AIDA2 👋\n\nEstoy lista para ayudarte con comida, glucosa, ejercicio, protocolos y medicamentos en diabetes tipo 2.";

export default function Chat2Page() {
  const [deviceId, setDeviceId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingWelcome, setIsLoadingWelcome] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;

    async function loadWelcome() {
      setIsLoadingWelcome(true);

      try {
        const res = await fetch("/api/chat2/welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(safeReadText(data?.error) || "Error al cargar bienvenida");
        }

        if (cancelled) return;

        setMessages([
          {
            role: "assistant",
            content: safeReadText(data.welcome) || FALLBACK_WELCOME,
          },
        ]);
      } catch {
        if (cancelled) return;

        setMessages([
          {
            role: "assistant",
            content: FALLBACK_WELCOME,
          },
        ]);
      } finally {
        if (!cancelled) {
          setIsLoadingWelcome(false);
        }
      }
    }

    loadWelcome();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, isLoadingWelcome]);

  const canSend = useMemo(() => {
    return input.trim().length > 0 && !isSending && !isLoadingWelcome && !!deviceId;
  }, [input, isSending, isLoadingWelcome, deviceId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending || isLoadingWelcome || !deviceId) return;

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
          gap: 12,
        }}
      >
        {isLoadingWelcome ? (
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 16,
              padding: "12px 14px",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 15,
              lineHeight: 1.58,
            }}
          >
            Cargando contexto...
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isUser = message.role === "user";

          return (
            <div
              key={index}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                borderRadius: 16,
                padding: "12px 14px",
                background: isUser ? "#111827" : "#f3f4f6",
                color: isUser ? "white" : "#111827",
                fontSize: 15,
                lineHeight: 1.58,
              }}
            >
              {renderMessageContent(message.content)}
            </div>
          );
        })}

        {isSending ? (
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 16,
              padding: "12px 14px",
              background: "#f3f4f6",
              color: "#111827",
              fontSize: 15,
              lineHeight: 1.58,
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
          disabled={isLoadingWelcome}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #d1d5db",
            borderRadius: 14,
            padding: "10px 12px",
            fontSize: 15,
            outline: "none",
            opacity: isLoadingWelcome ? 0.7 : 1,
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