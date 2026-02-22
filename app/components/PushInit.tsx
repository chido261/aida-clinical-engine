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

export default function PushInit() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("🚀 SW registrado con scope:", reg.scope);
      setReady(true);
    })().catch((e) => console.error("❌ PushInit boot error:", e));
  }, []);

  async function enablePush() {
    try {
      setBusy(true);

      // 1) Permiso (user gesture ✅)
      const perm = await Notification.requestPermission();
      console.log("🔔 Notification permission:", perm);
      if (perm !== "granted") return;

      // 2) Obtener SW registration
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
          userId: "demo-user", // por ahora, luego lo conectas al onboarding real
          subscription: sub,
        }),
      });

      const data = await res.json().catch(() => null);
      console.log("📨 /api/push/subscribe response:", res.status, data);

      if (!res.ok) throw new Error(data?.error || "Subscribe API failed");

      console.log("🎉 Subscription guardada en backend");
    } catch (e) {
      console.error("❌ enablePush error:", e);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <button
      onClick={enablePush}
      disabled={busy}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "8px 12px",
        background: "black",
        color: "white",
        borderRadius: 6,
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? "Activando..." : "Activar notificaciones"}
    </button>
  );
}