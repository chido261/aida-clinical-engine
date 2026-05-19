export default function PagoPage() {
    const plans = [
      {
        name: "Pago mensual",
        price: "$500",
        period: "MXN / mes",
        description: "Ideal para probar la versión completa sin compromiso largo.",
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
        description: "Recomendado para trabajar el proceso completo de control glucémico.",
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
        description: "La mejor opción si quieres mantener acompañamiento todo el año.",
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
            <a
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
            </a>
  
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
                  background: "#fff7ed",
                }}
              >
                Activar versión completa
              </div>
  
              <h1
                style={{
                  fontSize: 32,
                  lineHeight: 1.1,
                  margin: "0 0 12px",
                  color: "#111827",
                }}
              >
                Elige cómo quieres continuar con AIDA
              </h1>
  
              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.5,
                  margin: 0,
                  color: "#4b5563",
                  maxWidth: 720,
                }}
              >
                Tu prueba gratuita terminó. Para seguir usando AIDA, selecciona
                una modalidad de pago. Después conectaremos esta pantalla con el
                pago automático y la generación de tu código de activación.
              </p>
            </div>
          </div>
  
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
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
  
                <a
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
                </a>
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
            <strong style={{ color: "#111827" }}>Nota:</strong> Por ahora esta
            pantalla es visual. En el siguiente paso conectaremos los botones con
            el flujo de activación, código único y número de celular.
          </div>
        </section>
      </main>
    );
  }