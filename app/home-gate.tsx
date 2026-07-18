"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/app/lib/deviceId";

const STORAGE_KEY = "glucosa_onboarding_v1";

export default function HomeGate() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      try {
        const deviceId = getDeviceId();

        const res = await fetch("/api/onboarding/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            deviceId,
          }),
        });

        const data = await res.json().catch(() => null);

        if (cancelled) return;

        if (res.ok && data?.hasOnboarding) {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                deviceId,
                name: data?.user?.name ?? "",
                age: data?.user?.age ? String(data.user.age) : "",
                heightCm: data?.user?.heightCm
                  ? String(data.user.heightCm)
                  : "",
                weightKg: data?.user?.weightKg
                  ? String(data.user.weightKg)
                  : "",
                diagnosis: data?.user?.diagnosis ?? "",
                meds: data?.user?.meds ?? "",
                fastingPeakMgDl: data?.user?.fastingPeakMgDl
                  ? String(data.user.fastingPeakMgDl)
                  : "",
                postMealPeakMgDl: data?.user?.postMealPeakMgDl
                  ? String(data.user.postMealPeakMgDl)
                  : "",
                wakeTime: data?.user?.wakeTime ?? "06:00",
                restoredFromDatabase: true,
              })
            );
          } catch {
            // ignore localStorage errors
          }

          router.replace("/chat2");
          return;
        }

        router.replace("/onboarding");
      } catch {
        if (!cancelled) {
          router.replace("/onboarding");
        }
      }
    }

    checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
      <div className="text-sm opacity-80">Cargando AIDA…</div>
    </div>
  );
}
