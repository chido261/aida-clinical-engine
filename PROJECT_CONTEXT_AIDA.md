PROJECT_CONTEXT_AIDA.md

Estado Actual – 23 Feb 2026 (Actualizado – Multiusuario + Rate Limit)

1️⃣ VISIÓN GENERAL DEL PROYECTO

AIDA (Artificial Intelligence Diabetes Assistant) es un sistema conversacional clínico enfocado en:

Educación terapéutica para diabetes tipo 2 y prediabetes

Seguimiento cuantitativo real

Acompañamiento estructurado por fases (3 meses)

Notificaciones inteligentes

Escalabilidad futura como producto SaaS con licencia anual

Objetivo estratégico:
Convertir AIDA en un sistema clínico digital con:

Control de acceso

Prueba gratuita (trial)

Modelo de licencia anual

Infraestructura en la nube

Multiusuario real por dispositivo

2️⃣ ARQUITECTURA ACTUAL

Framework:

Next.js 16 (App Router)

Turbopack en desarrollo

Backend:

API Routes (Node runtime)

Prisma ORM 7.3

SQLite (dev.db local)

prisma.config.ts (Datasource configurado ahí, NO en schema)

Arquitectura modular:

Prompt central → app/lib/aidaPrompt.ts

Motor cuantitativo → app/lib/aidaProgress.ts

Baseline clínico → app/lib/aidaBaseline.ts

Reglas contextuales → app/lib/aidaRules.ts

Motor nutricional → app/lib/aidaNutritionRules.ts

Motor por fase → app/lib/aidaPhaseRules.ts

Memoria persistente → app/lib/aidaMemory.ts

Identidad por dispositivo → app/lib/deviceId.ts

3️⃣ SISTEMA CONVERSACIONAL (ESTADO ACTUAL)

AIDA actualmente:

✅ Detecta glucosa vía regex (40–600 mg/dL)
✅ Guarda lecturas en base de datos
✅ Guarda baseline (A1c o promedio inicial)
✅ Calcula:

Promedio 7 días

Promedio 14 días

Tendencia 7 vs 7

Cambio desde baseline

✅ Genera contexto de progreso cuantitativo
✅ Detecta momento:

AYUNO

POSTCOMIDA

NOCHE

DESCONOCIDO

✅ Detecta confirmaciones (modo seguimiento)
✅ Integra memoria histórica en el prompt
✅ Aplica reglas clínicas antes de llamar al modelo
✅ Limita tamaño de mensaje (anti-spam > 1000 caracteres)

4️⃣ MULTIUSUARIO REAL (IMPLEMENTADO)

ANTES:

userId = "demo-user"

Todos compartían identidad

AHORA:

🔐 Identidad por dispositivo implementada

Se genera deviceId (UUID) en frontend

Se guarda en localStorage (aida_device_id_v1)

Se envía al backend en cada request

deviceId ahora es el userId real

Resultado:

Separación total entre dispositivos

Listo para compartir link público

Base sólida para trial/licencias

5️⃣ RATE LIMIT IMPLEMENTADO (PROTECCIÓN BÁSICA ANTI-SPAM)

Implementado en /api/chat:

50 mensajes por día

Por deviceId

Basado en fecha UTC

Se guarda en UserState:

dailyMsgDate
dailyMsgCount

Flujo:

ensureUserState(userId)

Lee estado actual

Si cambió el día → reinicia contador

Si ≥ 50 → responde 429

Si no → incrementa contador

Resultado:
Sistema protegido contra abuso básico.

6️⃣ AJUSTE PRISMA 7 (IMPORTANTE)

Error corregido:

Prisma 7 ya NO permite:
url = "file:./dev.db" en schema.prisma

Solución aplicada:

schema.prisma SIN url

URL configurada en prisma.config.ts

Migración ejecutada correctamente

Prisma Client regenerado

Sistema ahora compatible con Prisma 7.3

7️⃣ PWA (YA FUNCIONAL)

Implementado:

manifest.ts

icon-192.png

Service Worker (public/sw.js)

Push subscribe endpoint

Push send endpoint

VAPID configurado

Probado:

Android

Chrome

Instalación correcta

Push funcional

8️⃣ ESTADO ACTUAL DEL SISTEMA

🟢 Multiusuario por dispositivo
🟢 Motor clínico estable
🟢 Progreso cuantitativo sólido
🟢 Baseline persistente
🟢 Push funcionando
🟢 Rate limit activo
🟢 PWA estable

🟡 Sin autenticación telefónica aún
🟡 Sin sistema de trial activo
🔴 No desplegado en nube aún

9️⃣ SIGUIENTE PASO LÓGICO (SPRINT ACTUAL)

Ya que:

Tenemos multiusuario

Tenemos control básico

Tenemos separación real

El siguiente paso estructural es:

🎯 Implementar TRIAL por dispositivo (48 horas)

Diseño:

Agregar a UserState:

trialStartedAt DateTime?

trialEndsAt DateTime?

licenseStatus String ("trial" | "active" | "expired")

Lógica en backend:

Si no tiene trialStartedAt → iniciar automáticamente
Si Date.now() > trialEndsAt → bloquear chat
Si activo → permitir

Esto prepara el sistema para:

OTP por teléfono

Licencia anual

Paywall

🔟 MIGRACIÓN FUTURA A NUBE

Cuando el trial funcione:

Frontend + API:

Vercel

Base de datos:

Postgres (Neon / Supabase / Railway)

Cambios:

Migrar SQLite → Postgres

Ajustar DATABASE_URL

Ejecutar migraciones formales

1️⃣1️⃣ OBJETIVO ESTRATÉGICO

Convertir AIDA en:

Sistema clínico digital

Producto SaaS

Plataforma con licencia anual

Motor educativo estructurado 3 meses

Infraestructura escalable

1️⃣2️⃣ INSTRUCCIÓN PARA CONTINUAR EN EL SIGUIENTE CHAT

Cuando abras el siguiente chat, copia y pega esto: