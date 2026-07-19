"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";
import styles from "./page.module.css";

type ChatMessage = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "aida3-chat3-visible-messages";
const WELCOME: ChatMessage = {
  role: "assistant",
  content: "Hola. Soy AIDA3. Esta conversación usa la nueva arquitectura modular.",
};

function loadMessages() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [WELCOME];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [WELCOME];
    const messages = parsed.filter((item): item is ChatMessage => Boolean(item && typeof item === "object" &&
      ((item as ChatMessage).role === "user" || (item as ChatMessage).role === "assistant") &&
      typeof (item as ChatMessage).content === "string"));
    return messages.length ? messages : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

export default function Chat3Page() {
  const [deviceId, setDeviceId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottom = useRef<HTMLDivElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
    setMessages(loadMessages());
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);
  useEffect(() => {
    if (!sending) {
      setWaitingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setWaitingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [sending]);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = "auto";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 120)}px`;
  }, [input]);

  const canSend = useMemo(() => Boolean(deviceId && input.trim() && !sending), [deviceId, input, sending]);

  async function send() {
    const content = input.trim();
    if (!canSend || !content) return;
    const nextMessages = [...messages, { role: "user", content } satisfies ChatMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setElapsedMs(null);
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 70_000);

    try {
      const response = await fetch("/api/chat3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, messages: nextMessages.slice(-12) }),
        signal: controller.signal,
      });
      const data = await response.json() as {
        ok?: boolean;
        reply?: string;
        error?: string;
        diagnostics?: Array<{ taskId: string; expertId: string; errorCode: string | null;
          data?: { violations?: string[] } }>;
      };
      if (!response.ok || !data.ok || !data.reply) {
        const details = data.diagnostics?.map(item => `${item.taskId}/${item.expertId}: ${item.errorCode}${
          item.data?.violations?.length ? ` [${item.data.violations.join(", ")}]` : ""}`).join("; ");
        throw new Error([data.error || "Chat3 no pudo responder.", details].filter(Boolean).join(" "));
      }
      setMessages(current => [...current, { role: "assistant", content: data.reply! }]);
    } catch (error) {
      setMessages(current => [...current, {
        role: "assistant",
        content: error instanceof Error ? `Error de Chat3: ${error.message}` : "Error de Chat3.",
      }]);
    } finally {
      window.clearTimeout(timeout);
      setElapsedMs(Math.round(performance.now() - startedAt));
      setSending(false);
    }
  }

  function clearVisibleConversation() {
    setMessages([WELCOME]);
    setElapsedMs(null);
    setMenuOpen(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.title}>AIDA3</h1>
          <div className={styles.headerActions}>
            <span className={styles.mode}>Chat modular</span>
            <button className={styles.menuButton} onClick={() => setMenuOpen(value => !value)}
              aria-expanded={menuOpen}>Menú</button>
            {menuOpen && (
              <div className={styles.menu}>
                <button onClick={clearVisibleConversation} disabled={sending}>Limpiar conversación</button>
              </div>
            )}
          </div>
        </header>

        <div className={styles.messages} aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={styles.messageRow}>
              <div className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}>
                {message.content}
              </div>
            </div>
          ))}
          {sending && <div className={styles.thinking}>AIDA está analizando… {waitingSeconds > 0 ? `${waitingSeconds} s` : ""}</div>}
          <div ref={bottom} />
        </div>

        <div className={styles.composer}>
          <p className={styles.status}>{sending ? `Procesando… ${waitingSeconds} s` :
            elapsedMs === null ? "" : `Última respuesta: ${(elapsedMs / 1000).toFixed(1)} s`}</p>
          <div className={styles.composerRow}>
            <button className={styles.utilityButton} disabled title="Archivos: disponible próximamente">+</button>
            <div className={styles.inputShell}>
              <textarea ref={textarea} className={styles.input} value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Pregúntale a AIDA" rows={1} disabled={sending} aria-label="Mensaje para AIDA3" />
              <button className={styles.voiceButton} disabled title="Dictado: disponible próximamente"
                aria-label="Dictado por voz">🎙️</button>
            </div>
            <button className={styles.send} disabled={!canSend} onClick={() => void send()}
              aria-label="Enviar mensaje">↑</button>
          </div>
          <p className={styles.note}>Enter envía · Shift + Enter agrega una línea</p>
        </div>

        <p className={styles.disclaimer}>
          AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud.
          En caso de urgencias o síntomas severos, acude a atención médica.
        </p>
      </section>
    </main>
  );
}
