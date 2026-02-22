import { NextResponse } from "next/server";
import { saveSubscription, type WebPushSubscription } from "@/app/lib/pushStore";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      subscription?: WebPushSubscription;
    };

    const userId = body.userId ?? "demo-user";
    const subscription = body.subscription;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: "Invalid subscription" }, { status: 400 });
    }

    saveSubscription(userId, subscription);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}