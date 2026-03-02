# PROJECT_CONTEXT_AIDA.md
**Estado Actual – 02 Mar 2026 (Actualizado: Switch Local/Cloud + Prisma 7 config + Migraciones OK + Backup/Restore SQLite + Fail-fast env + API config + Chat paywall control)**

---

## 1) Visión general del proyecto
**AIDA (Artificial Intelligence Diabetes Assistant)** es un asistente conversacional educativo para personas con **diabetes tipo 2 / prediabetes**, estilo WhatsApp, con:

- Educación terapéutica y acompañamiento por fases (meta 3 meses).
- Seguimiento cuantitativo real (lecturas, promedios, tendencia).
- PWA con notificaciones push (ya existe base técnica en el proyecto).
- Control por **dispositivo** (multiusuario real).
- Modelo **trial + full** (paywall en cloud; en local se ignora para desarrollo).
- Camino a infraestructura en la nube (Postgres en Neon / deploy Vercel).

---

## 2) Stack / Arquitectura actual
- **Next.js 16** (App Router)
- API principal: `app/api/chat/route.ts`
- Prisma **7.x** + SQLite local (dev.db) / Postgres cloud (Neon)
- Prisma Client singleton: `app/lib/prisma.ts`
- Config Prisma 7: `prisma.config.ts` (elige schema y migrations por entorno)
- UI principal: `/chat` (`app/chat/page.tsx`)
- Endpoint config: `/api/config` (`app/api/config/route.ts`)

---

## 3) Switch Local vs Cloud (objetivo: cambiar sin tocar muchos archivos)
### 3.1 Variables (idea base)
- `APP_MODE`: `local` | `cloud`
- `DATABASE_URL`:
  - Local: `file:./prisma/dev.db`
  - Cloud: `postgresql://...` (Neon)

### 3.2 runtimeConfig (fuente de verdad)
Existe `app/lib/runtimeConfig.ts` (o equivalente) que expone:
- `APP_MODE`
- `getDatabaseUrl()`

### 3.3 Endpoint para frontend
- `app/api/config/route.ts` devuelve `{ appMode: APP_MODE }`
- `app/chat/page.tsx` consulta `/api/config` y decide:
  - **Local:** ignora 402/paywall (no bloquea chat para desarrollo)
  - **Cloud:** si 402, muestra modal de pago y bloquea chat

---

## 4) Prisma 7: reglas y estado actual (IMPORTANTE)
### 4.1 Prisma config manda la URL (no schema)
En Prisma 7 con `prisma.config.ts`, **NO** se usa `url = env("DATABASE_URL")` dentro de `schema.prisma`.
La URL se define aquí:
- `prisma.config.ts` → `datasource: { url: databaseUrl }`

### 4.2 Config por entorno (actual)
`prisma.config.ts` (actual):
- Local:
  - env: `.env.local`
  - schema: `prisma/schema.prisma` (sqlite)
  - migrations: `prisma/migrations`
- “Production/Cloud” (vía `PRISMA_ENV=production`):
  - env: `.env.production`
  - schema: `prisma/schema.postgres.prisma` (postgres)
  - migrations: `prisma/migrations_pg`

### 4.3 Migraciones (local) ya existentes y consistentes
- Carpeta: `prisma/migrations/` ya tiene historial real (varias migraciones).
- Verificación ejecutada:
  - `npm run db:migrate` → “Already in sync, no schema change or pending migration”.

---

## 5) Fail-fast env (0.5 completado)
Archivo: `app/lib/prisma.ts`

- Obtiene URL con `getDatabaseUrl()`
- Aplica validación estricta:
  - Si `APP_MODE=cloud` → **prohíbe** `DATABASE_URL` que empiece con `file:`
  - Si `APP_MODE=local` → **exige** `DATABASE_URL` tipo `file:...`
- Resultado: evita deploy roto o confusiones (sqlite en Vercel / postgres en local).

---

## 6) Base de datos y modelos (estado real)
### 6.1 Local (modo actual de trabajo)
- SQLite: `prisma/dev.db`
- DB usada por Prisma: `file:./prisma/dev.db`

### 6.2 Cloud (preparado)
- Postgres Neon listo (cuando se active `APP_MODE=cloud` y `DATABASE_URL` Postgres).
- Schema Postgres: `prisma/schema.postgres.prisma` (alineado al schema sqlite).

Modelos principales:
- `UserState` (por deviceId): baseline, rate limit, trial, status de licencia, etc.
- `Reading` (lecturas glucosa)
- `UsageDaily` (métrica diaria por usuario)

---

## 7) Trial / Paywall / Rate-limit (estado actual)
**Backend (`app/api/chat/route.ts`)**
- `ensureUserState()` crea/asegura trial (actualmente 48 horas).
- Si trial expiró:
  - responde 402 con paywall (title/message/cta).
- Rate limit:
  - 50 mensajes/día SOLO en `licenseStatus === "trial"`
  - `active` es ilimitado.
- Se registran métricas:
  - `UserState.dailyMsgCount/dailyMsgDate/totalMsgCount/lastMsgAt`
  - `UsageDaily` por fecha local (America/Mexico_City)

**Frontend (`app/chat/page.tsx`)**
- Cloud: muestra paywall modal y bloquea input al recibir 402.
- Local: si recibe 402, muestra aviso DEV y NO bloquea (para seguir desarrollando).

---

## 8) Backup/Restore SQLite (0.4 completado)
Objetivo: poder experimentar sin miedo y revertir en segundos.

Carpetas/archivos:
- `backups/` (en raíz)
- `scripts/dbBackup.mjs`
- `scripts/dbRestore.mjs`

Scripts NPM:
- `npm run db:backup` → copia `prisma/dev.db` a `backups/dev-<timestamp>.db`
- `npm run db:restore backups/<archivo>.db` → restaura a `prisma/dev.db`

✅ Restore probado y funcionando.

---

## 9) Scripts de Prisma (estado)
`package.json` incluye scripts para:
- `db:migrate` (migrate dev)
- `db:deploy` (migrate deploy)
- `db:push`
- `db:reset`
- `db:studio`
- `db:backup` / `db:restore`

(Nota: en Prisma 7, migraciones Cloud deben correr con `PRISMA_ENV=production` y `.env.production` correcto, cuando toque.)

---

## 10) Qué se completó hoy (MÓDULO 0)
MÓDULO 0 — Base técnica y switch (Local/Cloud)
- ✅ 0.1 Switch APP_MODE + DATABASE_URL (local/cloud)
- ✅ 0.2 Paywall apagado en local (front ignora 402; chat no se bloquea)
- ✅ 0.3 Migraciones Prisma formales OK (sin drift)
- ✅ 0.4 Backup/Restore SQLite (1 comando cada uno)
- ✅ 0.5 Fail-fast env (cloud vs local) en `app/lib/prisma.ts`
- ✅ Endpoint `/api/config` para que el frontend conozca el modo (sin depender de `localhost`)

---

## 11) Próximo trabajo (Siguiente chat): MÓDULO 1
MÓDULO 1 — Núcleo conversacional tipo Coach (calidad “pro”)
- 1.1 Ajustar prompt base (coach profesional, respuestas cortas y accionables)
- 1.2 Mantener “1 pregunta máximo” cuando falte información
- 1.3 Reglas clínicas / banderas rojas (respuesta segura)
- 1.4 Resumen diario automático (micro-pasos + continuidad)
- 1.5 Preparar motor para protocolos (Trial 7D vs Full)

⚠️ Nota: El plan “Trial” será de **7 días** (no 48h) cuando entremos a módulos de protocolos/licencia. Aún NO se aplicó el cambio; hoy solo se estabilizó la base técnica para avanzar sin romper nada.

---

## 12) Texto listo para pegar en el siguiente chat
Estamos trabajando en **AIDA – Clinical Engine** (Next.js App Router + Prisma 7).

**Estado actual (estable):**
- Local funciona con **SQLite** en `prisma/dev.db`.
- Prisma 7 usa `prisma.config.ts` como fuente de verdad para `DATABASE_URL`, schema y migraciones por entorno.
- Tenemos switch **APP_MODE local/cloud** y endpoint `/api/config` para que el frontend sepa el modo.
- Frontend en local **ignora paywall** (no bloquea) para desarrollo; en cloud sí bloquea y muestra modal.
- Ya tenemos **backup/restore** de SQLite con comandos:
  - `npm run db:backup`
  - `npm run db:restore backups/<archivo>.db`
- Ya tenemos **fail-fast** de env en `app/lib/prisma.ts` (evita sqlite en cloud y postgres en local).

**Siguiente objetivo (en el nuevo chat):**
- Iniciar **MÓDULO 1**: elevar el núcleo conversacional tipo coach profesional (prompt y reglas).
