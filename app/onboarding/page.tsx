"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/app/lib/deviceId";

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
};

const STORAGE_KEY = "glucosa_onboarding_v1";

export default function OnboardingPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    name: "",
    age: "",
    heightCm: "",
    weightKg: "",
    diagnosis: "",
    meds: "",
    fastingPeakMgDl: "",
    postMealPeakMgDl: "",
    wakeTime: "06:00",
  });

  useEffect(() => {
    const currentDeviceId = getDeviceId();
    setDeviceId(currentDeviceId);

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        router.replace("/chat");
        return;
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [router]);

  const canNext = useMemo(() => {
    if (step === 1) {
      return (
        data.name.trim() !== "" &&
        data.age.trim() !== "" &&
        data.wakeTime.trim() !== ""
      );
    }

    if (step === 2) {
      return (
        data.heightCm.trim() !== "" &&
        data.weightKg.trim() !== "" &&
        data.diagnosis !== ""
      );
    }

    if (step === 3) {
      return (
        data.fastingPeakMgDl.trim() !== "" &&
        data.postMealPeakMgDl.trim() !== ""
      );
    }

    return false;
  }, [step, data]);

  function next() {
    if (!canNext) return;
    setError("");
    setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  }

  function back() {
    setError("");
    setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)));
  }

  async function finish() {
    if (!canNext || isSaving) return;

    setIsSaving(true);
    setError("");

    try {
      const currentDeviceId = deviceId || getDeviceId();

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId: currentDeviceId,
          ...data,
        }),
      });

      const responseData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          responseData?.message ||
            responseData?.error ||
            "No se pudo guardar tu configuración inicial."
        );
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...data,
          deviceId: currentDeviceId,
          createdAt: new Date().toISOString(),
          savedInDatabase: true,
        })
      );

      router.push("/chat");
    } catch (err: any) {
      setError(
        err?.message ||
          "Ocurrió un error al guardar tu configuración. Intenta de nuevo."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-50">
        <div className="text-sm text-zinc-300">Cargando AIDA…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-zinc-950 text-zinc-50">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Configuración inicial</h1>
            <p className="text-sm text-zinc-300 mt-1">
              Esto nos ayuda a personalizar tu acompañamiento (toma 1 minuto).
            </p>
          </div>
          <div className="text-sm text-zinc-300">
            Paso <span className="font-semibold text-zinc-100">{step}</span>/3
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {step === 1 && (
            <>
              <Field label="Nombre">
                <input
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="Ej. David"
                />
              </Field>

              <Field label="Edad">
                <input
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.age}
                  onChange={(e) => setData({ ...data, age: e.target.value })}
                  placeholder="Ej. 42"
                  inputMode="numeric"
                />
              </Field>

              <Field label="¿A qué hora te despiertas normalmente?">
                <input
                  type="time"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.wakeTime}
                  onChange={(e) =>
                    setData({ ...data, wakeTime: e.target.value })
                  }
                />
              </Field>

              <p className="text-xs text-zinc-400 -mt-2">
                Con esto te enviaré el recordatorio de tu glucosa en ayunas.
              </p>

              <p className="text-xs text-zinc-400">
                * Esta información quedará vinculada a este dispositivo y guardada
                en la base de datos.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Estatura (cm)">
                  <input
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                    value={data.heightCm}
                    onChange={(e) =>
                      setData({ ...data, heightCm: e.target.value })
                    }
                    placeholder="Ej. 174"
                    inputMode="numeric"
                  />
                </Field>

                <Field label="Peso (kg)">
                  <input
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                    value={data.weightKg}
                    onChange={(e) =>
                      setData({ ...data, weightKg: e.target.value })
                    }
                    placeholder="Ej. 90"
                    inputMode="numeric"
                  />
                </Field>
              </div>

              <Field label="Diagnóstico principal">
                <select
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.diagnosis}
                  onChange={(e) =>
                    setData({
                      ...data,
                      diagnosis: e.target.value as OnboardingData["diagnosis"],
                    })
                  }
                >
                  <option value="">Selecciona…</option>
                  <option value="dm2">Diabetes tipo 2</option>
                  <option value="prediabetes">Prediabetes</option>
                  <option value="other">Otro / No estoy seguro</option>
                </select>
              </Field>

              <Field label="Medicamentos actuales (opcional)">
                <input
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.meds}
                  onChange={(e) => setData({ ...data, meds: e.target.value })}
                  placeholder="Ej. Metformina 850 mg / Insulina nocturna…"
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="En promedio, ¿cuál ha sido tu medición MÁS ALTA en AYUNO en los últimos 15 días? (mg/dL)">
                <input
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.fastingPeakMgDl}
                  onChange={(e) =>
                    setData({ ...data, fastingPeakMgDl: e.target.value })
                  }
                  placeholder="Ej. 160"
                  inputMode="numeric"
                />
              </Field>

              <Field label="En promedio, ¿cuál ha sido tu medición MÁS ALTA 2 horas DESPUÉS tus comidas en los últimos 15 días? (mg/dL)">
                <input
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 outline-none focus:border-zinc-600"
                  value={data.postMealPeakMgDl}
                  onChange={(e) =>
                    setData({ ...data, postMealPeakMgDl: e.target.value })
                  }
                  placeholder="Ej. 220"
                  inputMode="numeric"
                />
              </Field>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                <p className="font-semibold text-zinc-100">
                  ¿Por qué preguntamos esto?
                </p>
                <p className="mt-1">
                  Estas dos mediciones nos ayudan a entender cómo responde tu
                  cuerpo en ayuno y frente a los alimentos, para guiarte mejor
                  desde el inicio.
                </p>
              </div>
            </>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            className="rounded-xl px-4 py-2 border border-zinc-800 text-zinc-200 hover:bg-zinc-800/40 disabled:opacity-40"
            onClick={back}
            disabled={step === 1 || isSaving}
          >
            Atrás
          </button>

          {step < 3 ? (
            <button
              className="rounded-xl px-4 py-2 bg-zinc-100 text-zinc-950 font-semibold hover:bg-white disabled:opacity-40"
              onClick={next}
              disabled={!canNext || isSaving}
            >
              Siguiente
            </button>
          ) : (
            <button
              className="rounded-xl px-4 py-2 bg-emerald-400 text-zinc-950 font-semibold hover:bg-emerald-300 disabled:opacity-40"
              onClick={finish}
              disabled={!canNext || isSaving}
            >
              {isSaving ? "Guardando..." : "Entrar al asistente"}
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-zinc-400">
          AIDA es un asistente educativo. No sustituye la valoración de un
          profesional de la salud. En caso de urgencias o síntomas severos: acude
          a atención médica.
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm text-zinc-200 mb-1">{label}</div>
      {children}
    </label>
  );
}