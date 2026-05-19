export default function PagoAnualPage() {
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
        <section style={{ maxWidth: 720, margin: "0 auto" }}>
          <a
            href="/pago"
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
            ← Volver a planes
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
                background: "#ecfdf5",
                color: "#065f46",
                border: "1px solid #a7f3d0",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              Mayor ahorro
            </div>
  
            <h1
              style={{
                fontSize: 30,
                lineHeight: 1.1,
                margin: "0 0 10px",
                color: "#111827",
              }}
            >
              Activar AIDA por 1 año
            </h1>
  
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.5,
                color: "#4b5563",
                margin: "0 0 22px",
              }}
            >
              Este plan es ideal si quieres mantener acompañamiento continuo,
              seguimiento educativo y apoyo durante todo el año.
            </p>
  
            <div
              style={{
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                borderRadius: 16,
                padding: 18,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280" }}>
                Total a pagar
              </div>
  
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  $3,000
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#6b7280",
                  }}
                >
                  MXN / 12 meses
                </span>
              </div>
            </div>
  
            <h2
              style={{
                fontSize: 18,
                margin: "0 0 10px",
                color: "#111827",
              }}
            >
              Incluye:
            </h2>
  
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 22px",
                display: "grid",
                gap: 10,
                color: "#374151",
                fontSize: 15,
              }}
            >
              <li>✓ Acceso completo a AIDA durante 12 meses</li>
              <li>✓ Seguimiento educativo de glucosa</li>
              <li>✓ Recomendaciones según tus lecturas</li>
              <li>✓ Ideal para mantenimiento y seguimiento continuo</li>
              <li>✓ Mayor ahorro frente al pago mensual</li>
              <li>✓ Activación vinculada a tu dispositivo y número de celular</li>
            </ul>
  
            <div
              style={{
                border: "1px solid #fde68a",
                background: "#fffbeb",
                borderRadius: 14,
                padding: 14,
                color: "#78350f",
                fontSize: 14,
                lineHeight: 1.45,
                marginBottom: 20,
              }}
            >
              Por ahora esta pantalla es de preparación. En el siguiente paso
              conectaremos el botón con el registro del número de celular, código
              de activación único y confirmación de pago.
            </div>
  
            <a
              href="/pago/activar?plan=anual"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                borderRadius: 14,
                padding: "14px 16px",
                background: "#111827",
                color: "white",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              Solicitar activación
            </a>
  
            <a
  href="/pago"
  style={{
    marginTop: 12,
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