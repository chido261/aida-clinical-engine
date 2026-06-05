import Link from "next/link";

type PagoPageProps = {
  searchParams?: Promise<{
    upgrade?: string;
    target?: string;
    renew?: string;
    discount?: string;
  }>;
};

export default async function PagoPage({ searchParams }: PagoPageProps) {
  const params = await searchParams;

  const isUpgradeMode = params?.upgrade === "1";
  const isAnnualRenewal = params?.renew === "anual";

  const pageMode = isAnnualRenewal
    ? "renewal"
    : isUpgradeMode
      ? "upgrade"
      : "normal";

  const plans =
    pageMode === "upgrade"
      ? [
          {
            name: "Cambiar a 3 meses",
            price: "$1,000",
            period: "MXN pagas hoy",
            regularPrice: "$1,500",
            discountLabel: "Crédito por tu pago anterior: -$500",
            description:
            "El plan trimestral cuesta $1,500 MXN. Como tu pago anterior se toma como crédito, hoy solo pagas la diferencia.",            features: [
              "Conservas tus días actuales",
              "Se suma la vigencia de 3 meses",
              "Ideal para completar el proceso de control glucémico",
              "Disponible solo dentro de la ventana de extensión",
            ],
            cta: "Extender a 3 meses",
            href: "/pago/3-meses?upgrade=1",
            highlighted: true,
          },
          {
            name: "Cambiar a anual",
            price: "$2,500",
period: "MXN pagas hoy",
regularPrice: "$3,000",
discountLabel: "Crédito por tu pago mensual: -$500",
description:
  "El plan anual cuesta $3,000 MXN. Como tu pago anterior se toma como crédito, hoy solo pagas la diferencia.",
            features: [
              "Conservas tus días actuales",
              "Mayor ahorro a largo plazo",
              "Acompañamiento durante todo el año",
              "Mejor opción para mantenimiento continuo",
            ],
            cta: "Extender a anual",
            href: "/pago/anual?upgrade=1",
          },
        ]
      : pageMode === "renewal"
        ? [
            {
              name: "Renovación anual",
              price: "$2,100",
              period: "MXN / año",
              description:
                "Renueva tu plan anual con 30% de descuento antes de que finalice tu vigencia.",
              features: [
                "30% de descuento aplicado",
                "Extiende tu acceso por 12 meses más",
                "Mantén tu acompañamiento continuo",
                "Disponible 30 días antes del vencimiento",
              ],
              cta: "Renovar anual",
              href: "/pago/anual?renew=1&discount=30",
              highlighted: true,
            },
          ]
        : [
            {
              name: "Pago mensual",
              price: "$500",
              period: "MXN / mes",
              description:
                "Ideal para probar la versión completa sin compromiso largo.",
              features: [
                "Acceso completo a AIDA",
                "Seguimiento de glucosa",
                "Acompañamiento educativo",
                "Activación por 30 días",
              ],
              cta: "Elegir mensual",
              href: "/pago/mensual",
            },
            {
              name: "Pago por 3 meses",
              price: "$1,500",
              period: "MXN / 90 días",
              description:
                "Recomendado para trabajar el proceso completo de control glucémico.",
              features: [
                "Acceso completo a AIDA",
                "Seguimiento durante 90 días",
                "Ideal para acompañar el cambio de hábitos",
                "Mejor opción para el programa completo",
              ],
              cta: "Elegir 3 meses",
              href: "/pago/3-meses",
              highlighted: true,
            },
            {
              name: "Pago anual",
              price: "$3,000",
              period: "MXN / año",
              description:
                "La mejor opción si quieres mantener acompañamiento todo el año.",
              features: [
                "Acceso completo a AIDA",
                "Activación por 12 meses",
                "Mayor ahorro a largo plazo",
                "Ideal para mantenimiento y seguimiento continuo",
              ],
              cta: "Elegir anual",
              href: "/pago/anual",
            },
          ];

  const header =
    pageMode === "upgrade"
      ? {
          badge: "Extensión disponible",
          title: "Extiende tu cuenta y ahorra",
          description:
            "Estás dentro de la ventana para mejorar tu plan. Puedes cambiar a un plan mayor pagando solo la diferencia. Tus días actuales se conservan y la nueva vigencia se suma.",
        }
      : pageMode === "renewal"
        ? {
            badge: "Renovación anual",
            title: "Renueva tu plan anual con descuento",
            description:
              "Tu plan anual está por finalizar. Puedes renovar por un año más con 30% de descuento y mantener tu acceso activo.",
          }
        : {
            badge: "Activar versión completa",
            title: "Elige cómo quieres continuar con AIDA",
            description:
              "Selecciona una modalidad de pago. Después del pago, AIDA activará tu acceso automáticamente en este dispositivo.",
          };

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
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/chat"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#111827",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 18,
            }}
          >
            ← Volver a AIDA
          </Link>

          <div
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                border: "1px solid #e5e7eb",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 14,
                background:
                  pageMode === "upgrade"
                    ? "#f0fdf4"
                    : pageMode === "renewal"
                      ? "#eff6ff"
                      : "#fff7ed",
                color:
                  pageMode === "upgrade"
                    ? "#14532d"
                    : pageMode === "renewal"
                      ? "#1e3a8a"
                      : "#111827",
              }}
            >
              {header.badge}
            </div>

            <h1
              style={{
                fontSize: 32,
                lineHeight: 1.1,
                margin: "0 0 12px",
                color: "#111827",
              }}
            >
              {header.title}
            </h1>

            <p
              style={{
                fontSize: 17,
                lineHeight: 1.5,
                margin: 0,
                color: "#4b5563",
                maxWidth: 760,
              }}
            >
              {header.description}
            </p>
          </div>
        </div>

        {pageMode === "upgrade" ? (
          <div
            style={{
              marginBottom: 18,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 16,
              padding: 16,
              color: "#14532d",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <strong>Importante:</strong> El pago que ya realizaste se toma como crédito
            para mejorar tu plan. Así no pierdes lo que ya pagaste y solo cubres la diferencia.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              plans.length === 1
                ? "minmax(260px, 420px)"
                : "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            justifyContent: plans.length === 1 ? "center" : "stretch",
          }}
        >
          {plans.map((plan) => (
            <article
              key={plan.name}
              style={{
                position: "relative",
                background: "white",
                border: plan.highlighted
                  ? "2px solid #111827"
                  : "1px solid #e5e7eb",
                borderRadius: 18,
                padding: 22,
                boxShadow: plan.highlighted
                  ? "0 18px 45px rgba(0,0,0,0.12)"
                  : "0 10px 30px rgba(0,0,0,0.04)",
              }}
            >
              {plan.highlighted ? (
                <div
                  style={{
                    position: "absolute",
                    top: -13,
                    left: 22,
                    background: "#111827",
                    color: "white",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  Recomendado
                </div>
              ) : null}

              <h2
                style={{
                  fontSize: 20,
                  margin: "8px 0 10px",
                  color: "#111827",
                }}
              >
                {plan.name}
              </h2>

              <div style={{ marginBottom: 12 }}>
  {"regularPrice" in plan && plan.regularPrice ? (
    <div
      style={{
        display: "grid",
        gap: 5,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Precio del paquete:{" "}
        <span
          style={{
            textDecoration: "line-through",
            fontWeight: 900,
          }}
        >
          {plan.regularPrice}
        </span>
      </div>

      <div
        style={{
          color: "#166534",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {"discountLabel" in plan ? plan.discountLabel : null}
      </div>
    </div>
  ) : null}

  <span
    style={{
      fontSize: 34,
      fontWeight: 900,
      color: "#111827",
    }}
  >
    {plan.price}
  </span>
  <span
    style={{
      marginLeft: 6,
      color: "#6b7280",
      fontSize: 14,
      fontWeight: 600,
    }}
  >
    {plan.period}
  </span>
</div>

              <p
                style={{
                  color: "#4b5563",
                  lineHeight: 1.45,
                  minHeight: 62,
                  marginBottom: 16,
                }}
              >
                {plan.description}
              </p>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 18px",
                  display: "grid",
                  gap: 9,
                  color: "#374151",
                  fontSize: 14,
                }}
              >
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <Link
                href={plan.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: plan.highlighted ? "#111827" : "white",
                  color: plan.highlighted ? "white" : "#111827",
                  border: "1px solid #111827",
                  textDecoration: "none",
                  fontWeight: 800,
                }}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            color: "#4b5563",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#111827" }}>Nota:</strong>{" "}
          {pageMode === "upgrade"
            ? "Esta pantalla ya reconoce el modo de extensión. En el siguiente paso conectaremos los montos exactos y el checkout correspondiente."
            : pageMode === "renewal"
              ? "Esta pantalla ya reconoce la renovación anual con descuento. En el siguiente paso conectaremos el checkout correspondiente."
              : "Los botones llevan al flujo de pago del plan seleccionado."}
        </div>
      </section>
    </main>
  );
}