"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type PushState = "booting" | "unavailable" | "needs_permission" | "needs_subscribe" | "ready";

export default function PushInit() {
  const [state, setState] = useState<PushState>("booting");
  const [busy, setBusy] = useState(false);

  // Boot + detect state
  useEffect(() => {
    (async () => {
      // 0) soporte
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unavailable");
        return;
      }

      // 1) registrar SW (idempotente)
      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("🚀 SW registrado con scope:", reg.scope);

      // 2) permiso
      const perm = Notification.permission;
      if (perm !== "granted") {
        setState("needs_permission");
        return;
      }

      // 3) ¿ya existe subscription?
      const readyReg = await navigator.serviceWorker.ready;
      const sub = await readyReg.pushManager.getSubscription();

      if (sub) {
        setState("ready");
        return;
      }

      setState("needs_subscribe");
    })().catch((e) => {
      console.error("❌ PushInit boot error:", e);
      setState("unavailable");
    });
  }, []);

  async function enablePush() {
    try {
      setBusy(true);

      // 1) permiso (user gesture ✅)
      const perm = await Notification.requestPermission();
      console.log("🔔 Notification permission:", perm);
      if (perm !== "granted") {
        setState("needs_permission");
        return;
      }

      // 2) SW ready
      const reg = await navigator.serviceWorker.ready;

      // 3) Reusar subscription si existe
      let sub = await reg.pushManager.getSubscription();

      // 4) Crear subscription si no existe
      if (!sub) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      console.log("✅ PushSubscription creada/recuperada:", sub.endpoint);

      // 5) Enviar al backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "demo-user", // luego lo conectas a onboarding real
          subscription: sub,
        }),
      });

      const data = await res.json().catch(() => null);
      console.log("📨 /api/push/subscribe response:", res.status, data);

      if (!res.ok) throw new Error(data?.error || "Subscribe API failed");

      console.log("🎉 Subscription guardada en backend");

      // ✅ ya quedó
      setState("ready");
    } catch (e) {
      console.error("❌ enablePush error:", e);

      // si falló después de conceder permiso, probablemente quedó en needs_subscribe
      if (Notification.permission === "granted") setState("needs_subscribe");
      else setState("needs_permission");
    } finally {
      setBusy(false);
    }
  }

  // ✅ si ya está listo o no aplica, no estorbes
  if (state === "booting" || state === "unavailable" || state === "ready") return null;

  const label =
    state === "needs_permission"
      ? "Activar notificaciones"
      : state === "needs_subscribe"
      ? "Activar notificaciones"
      : "Activar notificaciones";

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        display: "flex",
        justifyContent: "flex-end",
        background: "linear-gradient(transparent, rgba(0,0,0,0.35))",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <button
        onClick={enablePush}
        disabled={busy}
        style={{
          pointerEvents: "auto",
          padding: "10px 14px",
          background: "black",
          color: "white",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          opacity: busy ? 0.7 : 1,
          fontWeight: 700,
        }}
      >
        {busy ? "Activando..." : label}
      </button>
    </div>
  );
}