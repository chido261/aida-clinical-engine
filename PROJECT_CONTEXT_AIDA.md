# AIDA – Clinical Engine (Estado Actual Real)

## Arquitectura actual
- Next.js (App Router)
- API principal: /api/chat/route.ts
- Prisma + SQLite (dev.db)
- Cliente Prisma centralizado (app/lib/prisma.ts)
- Prompt central: app/lib/aidaPrompt.ts
- Motor cuantitativo: app/lib/aidaProgress.ts
- Persistencia onboarding en localStorage
- UserId actual: "demo-user"

---

## Sistema conversacional actual

AIDA actualmente:

- Detecta glucosa (regex 40–600 mg/dL)
- Guarda lecturas en base de datos
- Guarda baseline (HbA1c o promedio inicial)
- Calcula:
  - Promedio 7 días
  - Promedio 14 días
  - Tendencia 7 vs 7
  - Cambio desde punto de inicio
- Muestra tendencia con verbo en pasado:
  - Bajó X mg/dL
  - Subió X mg/dL
  - Estable
- No muestra números negativos visibles
- No usa la palabra "baseline"
- Usa formato obligatorio cuando existe progreso

---

## Formato clínico obligatorio actual

Cuando hay datos suficientes AIDA responde con:

- Lectura actual
- Promedio 7d
- Tendencia (verbo en pasado)
- Cambio desde que empezamos
- Acción concreta para hoy

---

## Lo que aún NO está implementado

- Motor real de banderas clínicas (hiper/hipo automatizado)
- Sistema automático por wakeTime
- Notificaciones reales (push / cron)
- Fases progresivas dinámicas
- Multiusuario real
- Panel estadístico
- Integración con especialista humano con lógica automatizada

---

## Prioridad actual

Convertir AIDA en aplicación funcional en celular con:

1. PWA instalable
2. Notificaciones push reales
3. Recordatorios automáticos
4. Seguimiento diario estructurado

---

## Estado estratégico

AIDA ya no es MVP básico.
Es un motor conversacional cuantitativo funcional.

El siguiente salto es:
👉 Convertirlo en asistente activo (no solo reactivo).