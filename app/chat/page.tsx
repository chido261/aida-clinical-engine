"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceId } from "@/app/lib/deviceId";
import PushInit from "@/app/components/PushInit";

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

type LatestPayment = {
  id: number;
  status: string;
  plan: string;
  amount: number;
  currency: string;
  createdAt: string;
  approvedAt: string | null;
  activationCodeId: number | null;
};

type LatestPaymentResponse =
  | {
      ok: true;
      found: boolean;
      payment: LatestPayment | null;
      redirectUrl?: string;
    }
  | {
      ok: false;
      error?: string;
      message?: string;
    };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type UpgradeOffer = {
  eligible: boolean;
  title: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
  currentPlan: string | null;
  targetPlans: string[];
  discountPercent?: number | null;
  daysLeftToUseOffer?: number | null;
};

type UiPayload = {
  disclaimer?: string;
  mode?: string;
  modeLabel?: string;
  daysLeft?: number | null;
  daysRemaining?: number | null;
  blocked?: boolean;
  ctaText?: string | null;
  ctaUrl?: string | null;
  upgradeOffer?: UpgradeOffer | null;
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

function getFileKind(file: File | null) {
  if (!file) return "";
  if (file.type.startsWith("image/")) return "Imagen";
  if (file.type === "application/pdf") return "PDF";
  return "Archivo";
}

function formatPaymentPlan(plan: string) {
  if (plan === "mensual") return "mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "anual";
  return plan || "AIDA";
}

function formatMoneyCents(value: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

async function normalizeImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo cargar la imagen."));
      image.src = imageUrl;
    });

    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return file;
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.86);
    });

    if (!blob) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "imagen";

    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function ChatPage() {
  const [onboarding, setOnboarding] = useState<OnboardingData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [paywall, setPaywall] = useState<Paywall | null>(null);
  const [appMode, setAppMode] = useState<"local" | "cloud">("local");
  const [ui, setUi] = useState<UiPayload | null>(null);
  const [isLoadingUserStatus, setIsLoadingUserStatus] = useState(true);
  const [latestPayment, setLatestPayment] = useState<LatestPayment | null>(null);
  const [latestPaymentRedirectUrl, setLatestPaymentRedirectUrl] = useState("");
  const [isLoadingLatestPayment, setIsLoadingLatestPayment] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        const mode = data?.appMode === "cloud" ? "cloud" : "local";
        setAppMode(mode);
      } catch {
        setAppMode("local");
      }
    })();
  }, []);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;

    async function loadUserStatus() {
      setIsLoadingUserStatus(true);

      try {
        const res = await fetch("/api/user-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
          }),
        });

        const data = await safeReadJson(res);

        if (!res.ok) {
          throw new Error(
            (typeof data?.error === "string" && data.error) ||
              "No pude cargar el estado del usuario."
          );
        }

        if (cancelled) return;

        if (data?.ui) {
          setUi(data.ui as UiPayload);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setIsLoadingUserStatus(false);
        }
      }
    }

    loadUserStatus();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;

    async function loadLatestPayment() {
      setIsLoadingLatestPayment(true);

      try {
        const res = await fetch("/api/payments/latest-for-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
          }),
        });

        const data = (await safeReadJson(res)) as LatestPaymentResponse | null;

        if (!res.ok || !data?.ok) {
          throw new Error(
            (data as any)?.message ||
              (data as any)?.error ||
              "No se pudo consultar el último pago."
          );
        }

        if (cancelled) return;

        if (data.found && data.payment && data.redirectUrl) {
          setLatestPayment(data.payment);
          setLatestPaymentRedirectUrl(data.redirectUrl);
        } else {
          setLatestPayment(null);
          setLatestPaymentRedirectUrl("");
        }
      } catch (e) {
        console.error(e);

        if (!cancelled) {
          setLatestPayment(null);
          setLatestPaymentRedirectUrl("");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatestPayment(false);
        }
      }
    }

    loadLatestPayment();

    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    const data = safeParse<OnboardingData>(localStorage.getItem(LS_KEY));
    setOnboarding(data);
  }, []);

  useEffect(() => {
    if (!onboarding || !deviceId) return;

    const currentOnboarding = onboarding;
    let cancelled = false;

    async function loadWelcomeMessage() {
      try {
        const res = await fetch("/api/chat-welcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            onboarding: currentOnboarding,
          }),
        });

        const data = await safeReadJson(res);

        if (!res.ok) {
          throw new Error(
            (typeof data?.error === "string" && data.error) ||
              "No pude cargar el mensaje de bienvenida."
          );
        }

        if (cancelled) return;

        setMessages((prev) =>
          prev.length
            ? prev
            : [
                {
                  role: "assistant",
                  content: data?.reply || `Hola ${currentOnboarding.name} 👋`,
                },
              ]
        );
      } catch (e) {
        console.error(e);

        if (cancelled) return;

        setMessages((prev) =>
          prev.length
            ? prev
            : [
                {
                  role: "assistant",
                  content: `Hola ${currentOnboarding.name} 👋`,
                },
              ]
        );
      }
    }

    loadWelcomeMessage();

    return () => {
      cancelled = true;
    };
  }, [onboarding, deviceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, paywall, selectedFile]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  const licenseModeActive = ui?.mode !== "LOCAL";
  const chatLocked = licenseModeActive && (ui?.blocked === true || !!paywall);

  const shouldShowLatestPaymentBanner =
    licenseModeActive &&
    !!latestPayment &&
    !!latestPaymentRedirectUrl &&
    latestPayment.status !== "approved";

  const canSend = useMemo(() => {
    return (
      (input.trim().length > 0 || !!selectedFile) &&
      !isSending &&
      !!deviceId &&
      !!onboarding &&
      !chatLocked
    );
  }, [input, selectedFile, isSending, deviceId, onboarding, chatLocked]);

  function autoResizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const maxHeight = 120;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function handleFileSelected(file: File | null) {
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";

    if (!isImage && !isPdf) {
      alert("Solo puedes subir imágenes o PDF.");
      return;
    }

    const maxMb = 10;
    const maxBytes = maxMb * 1024 * 1024;

    if (file.size > maxBytes) {
      alert(`El archivo es muy grande. Máximo permitido: ${maxMb} MB.`);
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
  }

  async function handleSend() {
    const text = input.trim();

    if (
      (!text && !selectedFile) ||
      isSending ||
      !deviceId ||
      !onboarding ||
      chatLocked
    ) {
      return;
    }

    const fileToSend = selectedFile
      ? await normalizeImageFile(selectedFile)
      : null;

    const userContent = fileToSend
      ? `${text || "Analiza este archivo."}\n\n[${getFileKind(fileToSend)}: ${
          fileToSend.name
        }]`
      : text;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userContent },
    ];

    setMessages(nextMessages);
    setInput("");
    setSelectedFile(null);
    setShowAttachMenu(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsSending(true);

    try {
      if (fileToSend) {
        const formData = new FormData();
        formData.append("file", fileToSend);
        formData.append("message", text || "Analiza este archivo.");
        formData.append("deviceId", deviceId);
        formData.append("onboarding", JSON.stringify(onboarding));
        formData.append("messages", JSON.stringify(nextMessages));

        const res = await fetch("/api/analyze-file", {
          method: "POST",
          body: formData,
        });

        const data = await safeReadJson(res);

        if (!res.ok) {
          throw new Error(
            (typeof data?.error === "string" && data.error) ||
              "Error al analizar el archivo."
          );
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data?.reply || "No pude analizar el archivo.",
          },
        ]);

        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          messages: nextMessages,
          onboarding,
        }),
      });

      if (res.status === 402) {
        const data = await safeReadJson(res);

        if (data?.ui) setUi(data.ui as UiPayload);

        const pw: Paywall = data?.paywall
          ? {
              title: String(data.paywall.title ?? "Tu prueba gratuita terminó"),
              message: String(
                data.paywall.message ??
                  "Gracias por usar la versión de prueba de AIDA. Para continuar, activa la versión completa y elige la modalidad de pago que mejor se adapte a ti."
              ),
              ctaText: String(data.paywall.ctaText ?? "Pagar 1 año"),
              ctaUrl: String(data.paywall.ctaUrl ?? "/pago"),
            }
          : {
              title: "Tu prueba gratuita terminó",
              message:
                "Gracias por usar nuestra versión de prueba de AIDA. Para continuar usando activa la versión completa, realiza tu pago en el siguiente botón.",
              ctaText: "Activar versión completa",
              ctaUrl: "/pago",
            };

        setPaywall(pw);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Tu prueba gratuita terminó. Para continuar, activa la versión completa y elige una modalidad de pago.",
          },
        ]);

        return;
      }

      if (res.status === 429) {
        const data = await safeReadJson(res);
        if (data?.ui) setUi(data.ui as UiPayload);

        const msg =
          (typeof data?.error === "string" && data.error) ||
          "Límite diario alcanzado. Intenta mañana.";

        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
        return;
      }

      if (!res.ok) {
        const data = await safeReadJson(res);
        if (data?.ui) setUi(data.ui as UiPayload);

        const msg =
          (typeof data?.error === "string" && data.error) ||
          "Error al llamar /api/chat";

        throw new Error(msg);
      }

      const data = (await res.json()) as { reply: string; ui?: UiPayload };

      if (data?.ui) setUi(data.ui);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            e?.message ||
            "Tuve un problema técnico al responder 😕. Inténtalo de nuevo en unos segundos.",
        },
      ]);

      console.error(e);
    } finally {
      setIsSending(false);
    }
  }

  function toggleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no permite dictado por voz. Prueba con Chrome en Android.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "es-MX";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";

      if (transcript) {
        setInput((prev) => {
          const separator = prev.trim().length ? " " : "";
          return `${prev}${separator}${transcript}`;
        });
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const planLabel =
    ui?.modeLabel && ui.modeLabel.trim().length > 0
      ? ui.modeLabel.replace(/^Modo:\s*/i, "")
      : deviceId
        ? "Cargando plan..."
        : "Estado del plan";

  const disclaimer =
    ui?.disclaimer ??
    "AIDA es un asistente educativo. No sustituye la valoración de un profesional de la salud. En caso de urgencias o síntomas severos: acude a atención médica.";

  const uiMode = (ui?.mode ?? "").toUpperCase();
  const isTrialBanner = licenseModeActive && uiMode === "TRIAL" && !chatLocked;
  const trialCtaText = ui?.ctaText ?? "Activa versión FULL";
  const trialCtaUrl = ui?.ctaUrl ?? "/pago";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>AIDA</h1>

        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "white",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {planLabel}
        </div>
      </div>

      {shouldShowLatestPaymentBanner ? (
        <div
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 900, color: "#1e3a8a" }}>
              ¿Ya realizaste tu pago?
            </div>

            <div style={{ color: "#1e40af", opacity: 0.95 }}>
              Detectamos un pago reciente de{" "}
              {latestPayment
                ? `${formatMoneyCents(
                    latestPayment.amount,
                    latestPayment.currency
                  )} para plan ${formatPaymentPlan(latestPayment.plan)}.`
                : "AIDA."}
            </div>

            <div style={{ color: "#1e40af", opacity: 0.85, marginTop: 3 }}>
              Confirma tu acceso para activar o extender tu cuenta.
            </div>
          </div>

          <a
            href={latestPaymentRedirectUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #93c5fd",
              background: "#1d4ed8",
              color: "white",
              fontWeight: 900,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Confirmar acceso
          </a>
        </div>
      ) : null}

      {isTrialBanner && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff7ed",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800 }}>Estás en versión de prueba</div>
            <div style={{ opacity: 0.85 }}>
              Te acompaño 7 días para demostrar control con alimentación. Si quieres acceso completo por 3 meses:
            </div>
          </div>

          <a
            href={trialCtaUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "black",
              color: "white",
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {trialCtaText}
          </a>
        </div>
      )}

      {licenseModeActive && ui?.upgradeOffer?.eligible && !chatLocked ? (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 900, color: "#14532d" }}>
              {ui.upgradeOffer.title}
            </div>

            <div style={{ color: "#166534", opacity: 0.95 }}>
              {ui.upgradeOffer.message}
            </div>

            {typeof ui.upgradeOffer.daysLeftToUseOffer === "number" ? (
              <div style={{ color: "#166534", opacity: 0.85, marginTop: 3 }}>
                Disponible por {ui.upgradeOffer.daysLeftToUseOffer} día(s).
              </div>
            ) : null}
          </div>

          <a
            href={ui.upgradeOffer.ctaUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #86efac",
              background: "#14532d",
              color: "white",
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {ui.upgradeOffer.ctaText}
          </a>
        </div>
      ) : null}

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
          <div style={{ opacity: 0.7, marginTop: 6 }}>AIDA está analizando…</div>
        )}

        <div ref={bottomRef} />
      </div>

      {selectedFile && (
        <div
          style={{
            marginTop: 8,
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "8px 10px",
            background: "#f9fafb",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="Vista previa"
              style={{
                width: 48,
                height: 48,
                objectFit: "cover",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
              }}
            />
          )}

          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📎 {getFileKind(selectedFile)}: {selectedFile.name}
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setImagePreviewUrl(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 16,
              cursor: "pointer",
            }}
            title="Quitar archivo"
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setShowAttachMenu((prev) => !prev)}
          disabled={!onboarding || isSending || !deviceId || chatLocked}
          style={{
            width: 44,
            minWidth: 44,
            height: 44,
            borderRadius: 999,
            border: "1px solid #e5e7eb",
            background: "white",
            fontSize: 28,
            lineHeight: "28px",
            fontWeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor:
              !onboarding || isSending || !deviceId || chatLocked
                ? "not-allowed"
                : "pointer",
          }}
          title="Adjuntar foto o archivo"
        >
          +
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            handleFileSelected(file);
          }}
        />

        {showAttachMenu && (
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 96,
              width: 230,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 22,
              boxShadow: "0 18px 45px rgba(0,0,0,0.16)",
              padding: 10,
              zIndex: 40,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.setAttribute("accept", "image/*");
                fileInputRef.current?.setAttribute("capture", "environment");
                fileInputRef.current?.click();
              }}
              style={{
                width: "100%",
                border: "none",
                background: "white",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 10px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>📷</span>
              Cámara
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.removeAttribute("capture");
                fileInputRef.current?.setAttribute("accept", "image/*");
                fileInputRef.current?.click();
              }}
              style={{
                width: "100%",
                border: "none",
                background: "white",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 10px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>🖼️</span>
              Fotos
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.removeAttribute("capture");
                fileInputRef.current?.setAttribute(
                  "accept",
                  ".pdf,application/pdf,image/*"
                );
                fileInputRef.current?.click();
              }}
              style={{
                width: "100%",
                border: "none",
                background: "white",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 10px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 22 }}>📎</span>
              Archivos
            </button>
          </div>
        )}

        <div
          style={{
            flex: 1,
            minHeight: 44,
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            background: "white",
            display: "flex",
            alignItems: "center",
            padding: "0 8px 0 14px",
            gap: 8,
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={chatLocked ? "Tu prueba terminó" : "Pregúntale a AIDA"}
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              minHeight: 24,
              maxHeight: 120,
              overflowY: "hidden",
              fontSize: 16,
              lineHeight: "22px",
              padding: "10px 0",
              background: "transparent",
              fontFamily: "inherit",
            }}
            disabled={!onboarding || isSending || !deviceId || chatLocked}
          />

          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={!onboarding || isSending || !deviceId || chatLocked}
            style={{
              width: 34,
              minWidth: 34,
              height: 34,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor:
                !onboarding || isSending || !deviceId || chatLocked
                  ? "not-allowed"
                  : "pointer",
              opacity: !onboarding || isSending || !deviceId || chatLocked ? 0.45 : 1,
            }}
            title="Dictar por voz"
          >
            {isListening ? "🔴" : "🎙️"}
          </button>
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 44,
            minWidth: 44,
            height: 44,
            borderRadius: 999,
            border: "none",
            background: canSend ? "black" : "#d1d5db",
            color: "white",
            fontWeight: 800,
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
          title="Enviar"
        >
          ↑
        </button>
      </div>

      {!onboarding && (
        <p style={{ marginTop: 10, opacity: 0.75 }}>
          No encontré tu onboarding. Ve a <b>/onboarding</b> y completa tus datos.
        </p>
      )}

      {chatLocked && ui?.ctaUrl && ui?.ctaText ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #e5e7eb",
            background: "#fff7ed",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 800 }}>Tu prueba gratuita terminó</div>
            <div style={{ opacity: 0.85 }}>
              Activa la versión completa para continuar usando AIDA.
            </div>
          </div>

          <a
            href={ui.ctaUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "black",
              color: "white",
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {ui.ctaText}
          </a>
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        {disclaimer}

        {licenseModeActive && ui?.ctaUrl && ui?.ctaText && !chatLocked ? (
          <>
            {" "}
            <a href={ui.ctaUrl} style={{ fontWeight: 700, textDecoration: "underline" }}>
              {ui.ctaText}
            </a>
          </>
        ) : null}
      </div>

      <PushInit userId={deviceId} />

      {licenseModeActive && paywall && (
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
                <div style={{ marginTop: 8, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {paywall.message}
                </div>
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
              Tu licencia se activará en el dispositivo y número de celular que registres.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}