PROJECT_CONTEXT_AIDA.md
Estado Actual – 22 Feb 2026
1️⃣ Arquitectura General

Framework: Next.js 16 (App Router, Turbopack)

Backend API routes

Prisma + SQLite (dev.db)

Cliente Prisma centralizado

Prompt central: app/lib/aidaPrompt.ts

Motor cuantitativo: app/lib/aidaProgress.ts

Baseline clínico: app/lib/aidaBaseline.ts

Onboarding persistido en localStorage

UserId actual: "demo-user"

2️⃣ Sistema Conversacional (AIDA)

AIDA actualmente:

Detecta glucosa vía regex (40–600 mg/dL)

Guarda lecturas en DB

Guarda baseline (A1c o promedio inicial)

Calcula:

Promedio 7 días

Promedio 14 días

Tendencia 7 vs 7

Cambio desde baseline

Muestra tendencia con verbo en pasado:

Bajó X mg/dL

Subió X mg/dL

Estable

Backend detecta contexto:

AYUNO

POSTCOMIDA

NOCHE

Modo seguimiento cuando usuario confirma acción

3️⃣ Sistema Push Notifications (YA FUNCIONAL ✅)
Implementado

Service Worker (public/sw.js)

Subscribe endpoint:

/api/push/subscribe

Send endpoint:

/api/push/send

Web-push con VAPID

Variables .env.local configuradas:

NEXT_PUBLIC_VAPID_PUBLIC_KEY

VAPID_PRIVATE_KEY

VAPID_SUBJECT

Soporte multi-device por userId

Limpieza automática de subscriptions 404 / 410

Funciona en:

Laptop (Chrome)

Android (Chrome)

Vía túnel Cloudflare HTTPS

4️⃣ Estado Técnico Confirmado

tsconfig corregido

.next excluido correctamente

Errores de validator eliminados

Dev server estable

Push real probado y validado

5️⃣ Pendientes Estratégicos

Opciones siguientes:

Notificaciones automáticas programadas

Push conectado a eventos clínicos (glucosa alta)

Persistir subscriptions en Prisma

Migrar a dominio fijo

Preparar entorno producción

6️⃣ Objetivo General

AIDA debe convertirse en:

Asistente clínico educativo

Motor de acompañamiento 3 meses

Sistema con:

Seguimiento cuantitativo

Notificaciones inteligentes

Intervención contextual automática

Escalable a producción

7️⃣ Repositorio Oficial

Repositorio público activo:

https://github.com/chido261/aida-clinical-engine

El código en producción local puede tener cambios no subidos.
Confirmar al inciar un nuevo chat que se actualice

Código local actual a github

