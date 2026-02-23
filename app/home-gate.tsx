"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "glucosa_onboarding_v1";

export default function HomeGate() {
  const router = useRouter();

  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) router.replace("/chat");
      else router.replace("/onboarding");
    } catch {
      router.replace("/onboarding");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
      <div className="text-sm opacity-80">Cargando AIDA…</div>
    </div>
  );
}