"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDeviceId } from "@/app/lib/deviceId";

type PlanKey = "mensual" | "3-meses" | "anual";

const PLAN_INFO: Record<
  PlanKey,
  {
    label: string;
    price: string;
    duration: string;
    badge: string;
  }
> = {
  mensual: {
    label: "Plan mensual",
    price: "$500 MXN",
    duration: "30 días",
    badge: "Plan flexible",
  },
  "3-meses": {
    label: "Plan 3 meses",
    price: "$1,500 MXN",
    duration: "90 días",
    badge: "Plan recomendado",
  },
  anual: {
    label: "Plan anual",
    price: "$3,000 MXN",
    duration: "12 meses",
    badge: "Mayor ahorro",
  },
};

function normalizePlan(value: string | null): PlanKey {
  if (value === "mensual" || value === "3-meses" || value === "anual") {
    return value;
  }

  return "3-meses";
}

export default function PagoActivarPage() {
  return (
    <Suspense fallback={<PagoActivarFallback />}>
      <PagoActivarContent />
    </Suspense>
  );
}

function PagoActivarFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: 24,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
            color: "#4b5563",
            fontWeight: 800,
          }}
        >
          Cargando activación...
        </div>
      </section>
    </main>
  );
}

function PagoActivarContent() {
  const searchParams = useSearchParams();
  const selectedPlan = normalizePlan(searchParams.get("plan"));
  const plan = PLAN_INFO[selectedPlan];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 3 && phone.trim().length >= 10;
  }, [name, phone]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const deviceId = getDeviceId();

      const res = await fetch("/api/activation-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          name,
          phone,
          plan: selectedPlan,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar la solicitud.");
      }

      setRequestId(data?.activationRequest?.id ?? null);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        padding: 24,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section style={{ maxWidth: 760, margin: "0 auto" }}>
        <a
          href={`/pago/${selectedPlan === "3-meses" ? "3-meses" : selectedPlan}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#111827",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          ← Volver al plan
        </a>

        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 12px 35px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "#111827",
              color: "white",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            Solicitud de activación
          </div>

          <h1
            style={{
              fontSize: 30,
              lineHeight: 1.1,
              margin: "0 0 10px",
              color: "#111827",
            }}
          >
            Activa tu acceso a AIDA
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.5,
              color: "#4b5563",
              margin: "0 0 22px",
            }}
          >
            Registra tus datos para preparar tu activación. Después conectaremos
            este flujo con pago automático y código único ligado a tu número de
            celular.
          </p>

          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              borderRadius: 16,
              padding: 16,
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                padding: "5px 9px",
                fontSize: 12,
                fontWeight: 800,
                background: "white",
                marginBottom: 10,
              }}
            >
              {plan.badge}
            </div>

            <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
              {plan.label}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 4,
                color: "#4b5563",
                fontSize: 15,
              }}
            >
              <div>
                <strong style={{ color: "#111827" }}>Precio:</strong>{" "}
                {plan.price}
              </div>
              <div>
                <strong style={{ color: "#111827" }}>Duración:</strong>{" "}
                {plan.duration}
              </div>
            </div>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 14 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Nombre completo
                  </span>

                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. David Rodríguez"
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    Número de celular
                  </span>

                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 4531234567"
                    inputMode="tel"
                    style={{
                      width: "100%",
                      border: "1px solid #d1d5db",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 16,
                      outline: "none",
                    }}
                  />

                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    Más adelante este número servirá para validar tu acceso y
                    recibir tu código de activación.
                  </span>
                </label>
              </div>

              {error ? (
                <div
                  style={{
                    marginTop: 16,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    borderRadius: 12,
                    padding: 12,
                    color: "#991b1b",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                style={{
                  marginTop: 20,
                  width: "100%",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: canSubmit && !isSubmitting ? "#111827" : "#d1d5db",
                  color: "white",
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
                }}
              >
                {isSubmitting
                  ? "Guardando solicitud..."
                  : "Continuar con activación"}
              </button>
            </form>
          ) : (
            <div
              style={{
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: 16,
                padding: 18,
                color: "#14532d",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
                Solicitud preparada
              </div>

              <p style={{ margin: "0 0 10px" }}>
                Ya tenemos los datos para activar el acceso:
              </p>

              <div style={{ display: "grid", gap: 4, fontSize: 15 }}>
                <div>
                  <strong>Nombre:</strong> {name}
                </div>
                <div>
                  <strong>Celular:</strong> {phone}
                </div>
                <div>
                  <strong>Plan:</strong> {plan.label} — {plan.price}
                </div>
                {requestId ? (
                  <div>
                    <strong>Folio:</strong> #{requestId}
                  </div>
                ) : null}
              </div>

              <p style={{ margin: "14px 0 0" }}>
                En el siguiente paso conectaremos esta solicitud con el pago y
                la generación automática del código de activación.
              </p>
            </div>
          )}

          <a
            href="/pago"
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              borderRadius: 14,
              padding: "12px 16px",
              background: "white",
              color: "#111827",
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            Volver a planes
          </a>
        </div>
      </section>
    </main>
  );
}