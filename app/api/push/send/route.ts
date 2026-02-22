import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSubscriptions, removeSubscription } from "@/app/lib/pushStore";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      title?: string;
      body?: string;
      url?: string;
    };

    const userId = body.userId ?? "demo-user";
    const subs = getSubscriptions(userId);

    if (!subs.length) {
      return NextResponse.json(
        { ok: false, error: `No subscriptions for userId=${userId}` },
        { status: 404 }
      );
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      return NextResponse.json(
        { ok: false, error: "Missing VAPID env vars" },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title: body.title ?? "AIDA",
      body: body.body ?? "Notificación de prueba ✅",
      url: body.url ?? "/chat",
    });

    const results = await Promise.allSettled(
      subs.map((sub) => webpush.sendNotification(sub as any, payload))
    );

    // Limpia subscriptions muertas (típico: 404/410)
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        const status = (r.reason as any)?.statusCode;
        if (status === 404 || status === 410) {
          removeSubscription(userId, subs[idx].endpoint);
        }
      }
    });

    return NextResponse.json({
      ok: true,
      sent: results.filter((r) => r.status === "fulfilled").length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "send failed" },
      { status: 500 }
    );
  }
}