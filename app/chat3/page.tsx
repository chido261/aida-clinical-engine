"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";
import styles from "./page.module.css";

type Source = { title: string; url: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
const WELCOME: ChatMessage = {
  role: "assistant",
  content: "¡Hola! Soy AIDA y quiero ayudarte a comprender mejor tu glucosa y tomar buenas decisiones. ¿Cómo te gustaría que te llame? 💬",
};

export default function Chat3Page() {
  const [deviceId, setDeviceId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const bottom = useRef<HTMLDivElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);
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
  useEffect(() => {
    if (sending) return;
    const frame = window.requestAnimationFrame(() => textarea.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [sending]);

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
        body: JSON.stringify({ messages: nextMessages.slice(-20) }),
        signal: controller.signal,
      });
      const data = await response.json() as {
        ok?: boolean;
        reply?: string;
        error?: string;
        sources?: Source[];
      };
      if (!response.ok || !data.ok || !data.reply) {
        throw new Error(data.error || "AIDA no pudo responder.");
      }
      setMessages(current => [...current, {
        role: "assistant",
        content: data.reply!,
        sources: data.sources,
      }]);
    } catch (error) {
      setMessages(current => [...current, {
        role: "assistant",
        content: error instanceof Error ? `No pude responder: ${error.message}` : "No pude responder en este momento.",
      }]);
    } finally {
      window.clearTimeout(timeout);
      setElapsedMs(Math.round(performance.now() - startedAt));
      setSending(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.title}>AIDA</h1>
        </header>

        <div className={styles.messages} aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={styles.messageRow}>
              <div className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}>
                <div>{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                  <div className={styles.sources}>
                    <span>Fuentes oficiales:</span>
                    {message.sources.map(source => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ))}
                  </div>
                )}
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
        </div>

        <p className={styles.disclaimer}>
          AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud.
          En caso de urgencias o síntomas severos, acude a atención médica.
        </p>
      </section>
    </main>
  );
}
