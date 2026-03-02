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

## 10) Qué se completó hoy (MÓDULO 0 + MÓDULO 1 parcial)

### MÓDULO 0 — Base técnica y switch (Local/Cloud)
- ✅ Switch APP_MODE + DATABASE_URL (local/cloud)
- ✅ Paywall apagado en local (no bloquea desarrollo)
- ✅ Migraciones Prisma formales OK (sin drift)
- ✅ Backup/Restore SQLite (1 comando cada uno)
- ✅ Fail-fast env (cloud vs local) en `app/lib/prisma.ts`
- ✅ Endpoint `/api/config` para que el frontend conozca el modo

### MÓDULO 1 — Núcleo conversacional tipo Coach (avances)
**1.1 Prompt Coach Pro**
- ✅ Prompt actualizado a **“coach empático profesional”** (WhatsApp, operativo, sin alarmismo).
- ✅ Respuesta normal: **4–6 líneas**; si requiere explicación clínica: **8–12 líneas**.
- ✅ Emojis moderados (1–2).

**Persistencia / coherencia**
- ✅ “Glicosilada/A1c” ahora se detecta y se **guarda en UserState** (`baselineA1c`, `baselineSetAt`) y se puede recordar al reabrir.

**1.4 Seguridad clínica (banderas rojas)**
- ✅ `app/lib/aidaRules.ts` mejorado:
  - Dolor en pecho / falta de aire → **urgencias** (aunque no haya glucosa).
  - **Hipoglucemia <70** → Protocolo 15-15 con tono empático.
  - 70–80 + síntomas → tratar como hipo (15-15).
  - **Hiperglucemia ≥300**:
    - Con vómitos o síntomas → urgencias.
    - Sin síntomas → tranquilizar + respiración + agua con limón (sin azúcar) + revisar si tocaba medicamento (sin ajustar dosis) + re-checar en 15 min.

**Importante (continuidad)**
- ✅ En `app/api/chat/route.ts`: si se dispara un **bypass de seguridad**, **igual se guarda** la lectura en `Reading` para mantener continuidad al reabrir.

---

## 11) Próximo trabajo (Siguiente chat): MÓDULO 1

### 1.2 Motor por contexto (ayuno / post / noche) — “sin inventar”
- Ajuste fino: **NO asumir** “AYUNO/POST/NOCHE” si el usuario no lo dijo en el mensaje actual.
- Si hay glucosa pero momento desconocido → **1 sola pregunta** (ayuno / 2h post / antes de dormir).

### 1.3 Acciones concretas + 1 pregunta máximo
- Reforzar regla: si pide “¿qué hago ahorita?” → **acción primero**, sin interrogar.
- Si falta info → **máx 1 pregunta**.

### 1.4 Seguimiento clínico real (post-hipo)
Objetivo: que al reabrir la app, AIDA recuerde que venimos de una hipo y dé seguimiento.
- Pendiente: persistir un **estado clínico** simple (ej: `HYPO_ACTIVE`, `RECOVERING_FROM_HYPO`, `null`).
- Implementar lógica: si venimos de hipo y el usuario manda “hola” sin número → pedir **re-chequeo** (no saludo genérico).

### 1.5 Resumen diario automático
- Pendiente: resumen corto del día (lecturas + micro-paso para mañana).

---

## 12) Texto listo para pegar en el siguiente chat

Estamos trabajando en **AIDA – Clinical Engine** (Next.js App Router + Prisma 7).

**Estado actual (estable):**
- Local funciona con **SQLite** en `prisma/dev.db`.
- Switch **APP_MODE local/cloud** + endpoint `/api/config`.
- **Backup/restore** SQLite:
  - `npm run db:backup`
  - `npm run db:restore backups/<archivo>.db`
- Prompt coach pro ya está afinado (4–6 líneas, empático, emojis moderados).
- “Glicosilada/A1c” ya se guarda en `UserState`.
- `aidaRules.applySafetyBypass()` ya cubre:
  - pecho/respiración → urgencias
  - hipo <70 → 15-15
  - 70–80 + síntomas → 15-15
  - hiper ≥300 (con síntomas/vómitos → urgencias; sin síntomas → respiración + agua con limón + re-checar 15 min)
- `route.ts`: si hay bypass, **se guarda Reading** para continuidad.

**Siguiente objetivo (en el nuevo chat):**
1) Implementar **estado clínico persistente** para seguimiento post-hipo (al reabrir).
2) Afinar el motor por contexto (no asumir momento; 1 pregunta máximo).
3) Preparar **resumen diario** (1.5).