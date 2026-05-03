"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

type PushState =
  | "booting"
  | "unavailable"
  | "needs_permission"
  | "needs_subscribe"
  | "ready";

type PushInitProps = {
  userId?: string;
};

export default function PushInit({ userId }: PushInitProps) {
  const [state, setState] = useState<PushState>("booting");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) {
      setState("unavailable");
      return;
    }

    (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setState("unavailable");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      console.log("🚀 SW registrado con scope:", reg.scope);

      const perm = Notification.permission;

      if (perm !== "granted") {
        setState("needs_permission");
        return;
      }

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
  }, [userId]);

  async function enablePush() {
    if (!userId) return;

    try {
      setBusy(true);

      const perm = await Notification.requestPermission();
      console.log("🔔 Notification permission:", perm);

      if (perm !== "granted") {
        setState("needs_permission");
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
          throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY");
        }

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      console.log("✅ PushSubscription creada/recuperada:", sub.endpoint);

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subscription: sub,
        }),
      });

      const data = await res.json().catch(() => null);
      console.log("📨 /api/push/subscribe response:", res.status, data);

      if (!res.ok) {
        throw new Error(data?.error || "Subscribe API failed");
      }

      console.log("🎉 Subscription guardada en backend");

      setState("ready");
    } catch (e) {
      console.error("❌ enablePush error:", e);

      if (Notification.permission === "granted") {
        setState("needs_subscribe");
      } else {
        setState("needs_permission");
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "booting" || state === "unavailable" || state === "ready") {
    return null;
  }

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
        disabled={busy || !userId}
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
        {busy ? "Activando..." : "Activar notificaciones"}
      </button>
    </div>
  );
}