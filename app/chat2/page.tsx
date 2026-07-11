// app/chat2/page.tsx

"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

      if (
        result.length &&
        result[result.length - 1].type !== "space"
      ) {
        result.push({
          type: "space",
        });
      }

      return;
    }

    const numberedMatch = line.match(
      /^(\d+)\.\s+(.+)$/
    );

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

    if (
      index === 0 ||
      index === array.length - 1
    ) {
      return false;
    }

    return true;
  });
}

function renderMessageContent(content: string) {
  const lines = parseContent(content);

  return lines.map((line, index) => {
    if (line.type === "space") {
      return (
        <div
          key={index}
          style={{
            height: 4,
          }}
        />
      );
    }

    const previous = lines[index - 1];
    const isAfterSpace =
      previous?.type === "space";
    const isFirst = index === 0;

    if (line.type === "number") {
      return (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            marginTop:
              isFirst || isAfterSpace ? 0 : 8,
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
            marginTop:
              isFirst || isAfterSpace ? 0 : 8,
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
          margin:
            isFirst || isAfterSpace
              ? 0
              : "10px 0 0",
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
  const [deviceId, setDeviceId] =
    useState("");

  const [messages, setMessages] =
    useState<ChatMessage[]>([]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] =
    useState(false);

  const [
    isLoadingWelcome,
    setIsLoadingWelcome,
  ] = useState(true);

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

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
        const response = await fetch(
          "/api/chat2/welcome",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              deviceId,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            safeReadText(data?.error) ||
              "Error al cargar bienvenida"
          );
        }

        if (cancelled) return;

        setMessages([
          {
            role: "assistant",
            content:
              safeReadText(data.welcome) ||
              FALLBACK_WELCOME,
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

    void loadWelcome();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages,
    isSending,
    isLoadingWelcome,
  ]);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  const canSend = useMemo(() => {
    return (
      input.trim().length > 0 &&
      !isSending &&
      !isLoadingWelcome &&
      Boolean(deviceId)
    );
  }, [
    input,
    isSending,
    isLoadingWelcome,
    deviceId,
  ]);

  async function handleSend() {
    const text = input.trim();

    if (
      !text ||
      isSending ||
      isLoadingWelcome ||
      !deviceId
    ) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: text,
      },
    ];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(
        "/api/chat2",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            deviceId,
            messages: nextMessages,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          safeReadText(data?.error) ||
            "Error al llamar /api/chat2"
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            safeReadText(data.reply) ||
            "No pude responder ahora.",
        },
      ]);
    } catch (error: unknown) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Tuve un problema técnico al responder. Inténtalo de nuevo.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void handleSend();
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
        background: "#ffffff",
      }}
    >
      <header
        style={{
          borderBottom:
            "1px solid #e5e7eb",
          paddingBottom: 12,
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-start",
          gap: 14,
          position: "relative",
          zIndex: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              margin: 0,
              color: "#111827",
            }}
          >
            AIDA2
          </h1>

          <p
            style={{
              fontSize: 13,
              opacity: 0.7,
              margin: "4px 0 0",
              color: "#111827",
            }}
          >
            Chat limpio de desarrollo ·
            Cerebro nuevo
          </p>
        </div>

        <div
          ref={menuRef}
          style={{
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setIsMenuOpen(
                (current) => !current
              )
            }
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              border:
                "1px solid #d1d5db",
              borderRadius: 999,
              padding: "8px 13px",
              background: "#ffffff",
              color: "#111827",
              fontSize: 13,
              fontWeight: 850,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Menú

            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                fontSize: 11,
                transform: isMenuOpen
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
                transition:
                  "transform 0.15s ease",
              }}
            >
              ▼
            </span>
          </button>

          {isMenuOpen ? (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 220,
                border:
                  "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#ffffff",
                boxShadow:
                  "0 18px 45px rgba(15, 23, 42, 0.15)",
                padding: 8,
                zIndex: 50,
              }}
            >
              <a
                href="/chat2/mi-cuenta"
                role="menuitem"
                onClick={() =>
                  setIsMenuOpen(false)
                }
                style={{
                  display: "block",
                  borderRadius: 11,
                  padding: "11px 12px",
                  color: "#111827",
                  textDecoration: "none",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  Mi cuenta
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: "#6b7280",
                  }}
                >
                  Perfil, glucosa y fase
                  actual
                </div>
              </a>

              <div
                style={{
                  height: 1,
                  background: "#e5e7eb",
                  margin: "6px 4px",
                }}
              />

              <div
                style={{
                  borderRadius: 11,
                  padding: "11px 12px",
                  color: "#9ca3af",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 850,
                  }}
                >
                  Más opciones
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  Próximamente
                </div>
              </div>
            </div>
          ) : null}
        </div>
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

        {messages.map(
          (message, index) => {
            const isUser =
              message.role === "user";

            return (
              <div
                key={index}
                style={{
                  alignSelf: isUser
                    ? "flex-end"
                    : "flex-start",
                  maxWidth: "85%",
                  borderRadius: 16,
                  padding: "12px 14px",
                  background: isUser
                    ? "#111827"
                    : "#f3f4f6",
                  color: isUser
                    ? "#ffffff"
                    : "#111827",
                  fontSize: 15,
                  lineHeight: 1.58,
                  overflowWrap:
                    "break-word",
                }}
              >
                {renderMessageContent(
                  message.content
                )}
              </div>
            );
          }
        )}

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
          borderTop:
            "1px solid #e5e7eb",
          paddingTop: 12,
          display: "flex",
          gap: 8,
          position: "sticky",
          bottom: 0,
          background: "#ffffff",
          paddingBottom: 8,
        }}
      >
        <textarea
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={onKeyDown}
          placeholder="Escribe aquí..."
          rows={1}
          disabled={
            isLoadingWelcome ||
            isSending
          }
          style={{
            flex: 1,
            resize: "none",
            border:
              "1px solid #d1d5db",
            borderRadius: 14,
            padding: "10px 12px",
            fontSize: 15,
            outline: "none",
            color: "#111827",
            background: "#ffffff",
            opacity:
              isLoadingWelcome ||
              isSending
                ? 0.7
                : 1,
          }}
        />

        <button
          type="button"
          onClick={() =>
            void handleSend()
          }
          disabled={!canSend}
          style={{
            border: "none",
            borderRadius: 14,
            padding: "0 16px",
            background: canSend
              ? "#111827"
              : "#9ca3af",
            color: "#ffffff",
            fontWeight: 700,
            cursor: canSend
              ? "pointer"
              : "not-allowed",
          }}
        >
          Enviar
        </button>
      </footer>
    </main>
  );
}