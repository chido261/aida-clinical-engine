
# PROJECT_CONTEXT_AIDA.md
Estado Actual – 22 Feb 2026 (Actualizado Noche)

---

# 1️⃣ VISIÓN GENERAL DEL PROYECTO

AIDA (Artificial Intelligence Diabetes Assistant) es un sistema conversacional clínico enfocado en:

- Educación terapéutica para diabetes tipo 2 y prediabetes
- Seguimiento cuantitativo real
- Acompañamiento estructurado por fases (3 meses)
- Notificaciones inteligentes
- Escalabilidad futura como producto SaaS con licencia anual

Objetivo estratégico:
Convertir AIDA en un sistema clínico digital con:
- Control de acceso
- Prueba gratuita (trial)
- Modelo de licencia anual
- Infraestructura en la nube

---

# 2️⃣ ARQUITECTURA ACTUAL

Framework:
- Next.js 16 (App Router)
- Turbopack en desarrollo

Backend:
- API Routes (Node runtime)
- Prisma ORM
- SQLite (dev.db local)

Arquitectura modular:

- Prompt central → app/lib/aidaPrompt.ts
- Motor cuantitativo → app/lib/aidaProgress.ts
- Baseline clínico → app/lib/aidaBaseline.ts
- Reglas contextuales → app/lib/aidaRules.ts
- Motor nutricional → app/lib/aidaNutritionRules.ts
- Motor por fase → app/lib/aidaPhaseRules.ts
- Memoria persistente → app/lib/aidaMemory.ts

---

# 3️⃣ SISTEMA CONVERSACIONAL (ESTADO ACTUAL)

AIDA actualmente:

✅ Detecta glucosa vía regex (40–600 mg/dL)
✅ Guarda lecturas en base de datos
✅ Guarda baseline (A1c o promedio inicial)
✅ Calcula:

- Promedio 7 días
- Promedio 14 días
- Tendencia 7 vs 7
- Cambio desde baseline

✅ Genera contexto de progreso cuantitativo
✅ Detecta momento:
   - AYUNO
   - POSTCOMIDA
   - NOCHE
   - DESCONOCIDO

✅ Detecta confirmaciones (modo seguimiento)
✅ Integra memoria histórica en el prompt
✅ Aplica reglas clínicas antes de llamar al modelo

---

# 4️⃣ MEJORAS REALIZADAS HOY

## 🔹 Corrección crítica conversacional

ANTES:
- AIDA forzaba preguntas tipo “¿fue en ayuno o post?” aunque el usuario no hubiera dado lectura.
- Se usaba onboarding.lastGlucose como si fuera lectura actual.

AHORA:
- Se separó lectura del turno (glucoseNow) de datos históricos.
- Solo se guarda lectura si el usuario dio número en ese mensaje.
- Si no hay lectura numérica:
  - Respuesta breve
  - Natural
  - Sin forzar contexto clínico
  - Una sola pregunta abierta

Resultado:
Conversación más humana, estilo WhatsApp real.

---

# 5️⃣ SISTEMA PWA (YA FUNCIONAL)

Implementado:

- manifest.ts
- icon-192.png
- Service Worker (public/sw.js)
- Push subscribe endpoint
- Push send endpoint
- VAPID configurado
- Variables .env.local:
  - NEXT_PUBLIC_VAPID_PUBLIC_KEY
  - VAPID_PRIVATE_KEY
  - VAPID_SUBJECT

Dev Indicator eliminado (next.config.ts → devIndicators: false)

La PWA:
- Se instala correctamente
- Inicia desde raíz
- No salta onboarding
- Push probado en Android y Chrome

---

# 6️⃣ IDENTIDAD ACTUAL DEL SISTEMA

Estado actual:

❗ userId = "demo-user"

Esto implica:
- Sistema funcional pero no multiusuario real
- Todas las lecturas y notificaciones comparten identidad
- No listo aún para distribución pública

---

# 7️⃣ PLAN INMEDIATO (SPRINT 1)

OBJETIVO: Multiusuario por dispositivo

Diseño decidido:

Identidad por dispositivo:
- Generar deviceId único (UUID)
- Guardar en localStorage
- Usar como userId real

Ventajas:
- Separación completa entre usuarios
- Listo para compartir link
- Base para trial y licencias

Pendiente implementar:

- app/lib/deviceId.ts
- Enviar deviceId al backend
- Eliminar "demo-user"
- Asociar push subscriptions a deviceId

---

# 8️⃣ SPRINT 2 (AUTENTICACIÓN + TRIAL)

Objetivo:
- Acceso por teléfono (OTP)
- Prueba gratuita 48 horas
- Luego cambiar a 7 días / 30 días
- Bloqueo posterior con paywall

Flujo:

1. Usuario ingresa teléfono
2. Backend genera OTP
3. Envío SMS (Twilio o similar)
4. Verificación
5. Se activa trial:

   trialStartedAt
   trialEndsAt

6. En backend:
   - Si no verificado → bloquear chat
   - Si trial expirado → bloquear chat

---

# 9️⃣ SPRINT 3 (LICENCIA ANUAL)

Futuro:

- licenseActiveUntil
- Revocación de dispositivo
- Código de transferencia
- Cambio controlado a nuevo teléfono

Modelo:
Licencia vinculada a deviceId
Revocable manualmente o vía código temporal

---

# 🔟 MIGRACIÓN A NUBE (POST-IMPLEMENTACIÓN MULTIUSUARIO)

Objetivo:
Eliminar dependencia de laptop local.

Arquitectura recomendada:

Frontend + API:
- Vercel

Base de datos:
- Postgres (Neon / Supabase / Railway)

Dominio:
- Cloudflare DNS

Cambios necesarios:
- Migrar Prisma de SQLite a Postgres
- Ajustar DATABASE_URL
- Migraciones formales

Beneficios:
- URL estable
- HTTPS real
- Push más confiable
- Escalabilidad
- Sistema listo para usuarios reales

---

# 1️⃣1️⃣ ESTADO GENERAL DEL PROYECTO

Nivel actual:

🟢 Prototipo clínico avanzado funcional
🟢 Motor cuantitativo sólido
🟢 Push funcional
🟢 PWA estable
🟡 No multiusuario aún
🟡 No autenticación
🔴 No producción en nube

---

# 1️⃣2️⃣ OBJETIVO ESTRATÉGICO FINAL

Convertir AIDA en:

- Asistente clínico educativo digital
- Sistema de acompañamiento 3 meses
- Plataforma con control de acceso
- Modelo de licencia anual
- Infraestructura SaaS escalable

---

# 1️⃣3️⃣ REPOSITORIO

https://github.com/chido261/aida-clinical-engine

IMPORTANTE:
Antes de continuar en otro chat:
Confirmar que el código local esté sincronizado con GitHub.

---

# 1️⃣4️⃣ PRIORIDAD PARA MAÑANA

1️⃣ Implementar multiusuario por dispositivo (Sprint 1)
2️⃣ Probar con 2–3 dispositivos reales
3️⃣ Verificar separación de lecturas y push
4️⃣ Preparar base de datos para futura migración

---

FIN DE CONTEXTO ACTUALIZADO
