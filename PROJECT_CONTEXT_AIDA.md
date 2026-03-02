# PROJECT_CONTEXT_AIDA.md
**Estado Actual – 02 Mar 2026 (Actualizado: Daily Summary + Estado clínico persistente + Intercepts post-hipo + Rate limit 50/día por fecha local + Validaciones Prisma client + avances Módulo 2 plan)**

---

## 1) Visión general del proyecto
**AIDA (Artificial Intelligence Diabetes Assistant)** es un asistente conversacional **educativo** para personas con **diabetes tipo 2 / prediabetes**, estilo WhatsApp, con:

- Acompañamiento tipo **Coach profesional** (pasos cortos y accionables).
- Seguimiento cuantitativo real (lecturas, promedios, tendencia).
- PWA con notificaciones push (base técnica ya existe).
- Control por **dispositivo** (`deviceId`) → multiusuario real.
- Modelo **Trial → Full → Mantenimiento** (en cloud se aplicará paywall; en local se ignora para dev).
- Camino a infraestructura en la nube (Neon Postgres / deploy).

---

## 2) Stack / Arquitectura actual
- **Next.js** (App Router)
- API principal: `app/api/chat/route.ts`
- Prisma **7.x** + SQLite local / Postgres cloud (Neon)
- Prisma Client singleton + switch local/cloud: `app/lib/prisma.ts` + `app/lib/runtimeConfig.ts`
- Motor clínico: `app/lib/aidaRules.ts` (bypass + clinical engine)
- Memoria/estado usuario: `app/lib/aidaMemory.ts`
- Resumen diario: `app/lib/aidaDailySummary.ts`
- UI principal: `/chat` (`app/chat/page.tsx`)
- Config endpoint: `/api/config`

---

## 3) Switch Local vs Cloud
- `APP_MODE`: `local` | `cloud`
- `DATABASE_URL`:
  - Local: `file:./prisma/dev.db`
  - Cloud: `postgresql://...` (Neon)

**Fail-fast env (en `app/lib/prisma.ts`)**
- Si `APP_MODE=cloud` → prohíbe `DATABASE_URL` tipo `file:`
- Si `APP_MODE=local` → exige `DATABASE_URL` tipo `file:`

---

## 4) Base de datos y modelos (estado real)
Modelos principales:
- `UserState` (por deviceId): licencia/trial, rate-limit diario, timestamps, **clinicalState**, etc.
- `Reading`: lecturas glucosa (glucose, moment, createdAt, symptoms)
- `UsageDaily`: métrica diaria por usuario (dateLocal, count)

### Campos nuevos/clave trabajados
- `UserState.clinicalState`: `"HYPO_ACTIVE" | "RECOVERING_FROM_HYPO" | null`
- Daily summary (campos agregados en schema):
  - `UserState.dailySummaryDate`
  - `UserState.dailySummaryCount`
(Estos se usan para evitar repetir el resumen si el usuario insiste varias veces el mismo día.)

---

## 5) MÓDULO 1 — Núcleo conversacional tipo Coach (estado real)
### 5.1 Coach consistente (tono pro)
- Respuestas cortas y accionables, emojis moderados.
- Regla: si falta dato → **máximo 1 pregunta**.

### 5.2 “No asumir” momento (AYUNO/POST/NOCHE)
- `route.ts` detecta el momento SOLO del texto actual:
  - Si hay lectura numérica pero momento desconocido: preguntar 1 vez:
    - “¿Fue en ayunas, 2h postcomida o antes de dormir?”
- Importante: aunque en memoria haya lecturas previas, **NO etiquetar** el momento si el usuario no lo dijo.

### 5.3 Seguridad clínica (banderas rojas)
Archivo: `app/lib/aidaRules.ts`
- Dolor pecho / falta de aire → urgencias (aunque no haya glucosa).
- Hipo <70 → protocolo 15-15.
- 70–80 + síntomas → tratar como hipo.
- Hiper ≥300:
  - con vómitos/síntomas → urgencias
  - sin síntomas → respiración + agua + re-checar en 15 min (sin ajustar medicación)

### 5.4 Estado clínico persistente + intercept determinístico (✅ importante)
Objetivo logrado: si hubo hipo, AIDA **recuerda** el estado y no “saluda normal”.

Implementación (en `app/api/chat/route.ts`):
- Si bypass por hipo (<70) → se guarda lectura + `UserState.clinicalState = HYPO_ACTIVE`.
- Si venía de hipo y la glucosa sube a >=90 → limpia `clinicalState = null`.
- Intercepts:
  - Si `clinicalState === HYPO_ACTIVE` y el usuario escribe sin número (ej. “hola”) → AIDA intercepta y pide confirmación de 15-15 y re-medición.
  - Si `clinicalState === RECOVERING_FROM_HYPO` y no hay número → pide glucosa actual.

### 5.5 Motor clínico (orden correcto)
En `route.ts`:
- Se obtiene `previousGlucose` ANTES de guardar la nueva lectura:
  - `lastBeforeSave = await getLastReading(userId)` (solo si glucoseNow existe)
  - `previousGlucose = lastBeforeSave?.glucose ?? null`
- Se guarda la lectura.
- Luego corre `applyClinicalDecisionEngine({... previousGlucose, clinicalState ...})`
- Si decide algo, actualiza `UserState.clinicalState`.

### 5.6 Resumen diario (parcial: manual + anti-duplicado)
- `buildDailySummary(userId)` genera:
  - lecturas del día
  - promedio / min / max
  - señal clínica (ej. hipo)
  - micro-paso mañana
- `route.ts` ya intercepta `wantsSummary` cuando el usuario pide “resumen”.
- Anti-spam: si ya se entregó resumen hoy → “Ya te entregué tu resumen hoy...”

⚠️ Pendiente Módulo 1.5: hacerlo automático (sin que el usuario lo pida) con reglas de “1 vez al día” y/o al cerrar el día.

---

## 6) Trial / Paywall / Rate-limit (estado actual)
**Rate limit**
- 50 mensajes/día SOLO en `licenseStatus === "trial"`.
- Reset del contador por **fecha local** `America/Mexico_City`:
  - `dailyMsgDate === todayLocal ? dailyMsgCount + 1 : 1`
- `UsageDaily` upsert por `{ userId, dateLocal }`.

**Trial**
- Actualmente implementado como trial por horas (48h) en `ensureUserState()` (MÓDULO 2 lo cambia a 7 días exactos).

---

## 7) Archivos clave (lo que NO tocar sin motivo)
- `app/api/chat/route.ts` → orquestación completa
- `app/lib/aidaRules.ts` → bypass + clinical engine
- `app/lib/aidaMemory.ts` → ensureUserState + isTrialExpired + lecturas
- `app/lib/aidaDailySummary.ts` → resumen diario
- `prisma/schema.prisma` (sqlite) + `prisma/schema.postgres.prisma` (cloud)
- `prisma/migrations/...` (incluye migración daily summary fields)

---

## 8) Estado GitHub (para push)
Cambios detectados:
- modified: `app/api/chat/route.ts`
- modified: `prisma/schema.prisma`
- modified: `prisma/schema.postgres.prisma`
- untracked:
  - `app/lib/aidaDailySummary.ts`
  - `prisma/migrations/20260302113746_add_daily_summary_fields/`

Comandos recomendados:
- `git status`
- `git add .`
- `git commit -m "Add daily summary + clinical state intercept + trial daily limit"`
- `git push`

(Advertencia normal LF/CRLF en Windows, no es bloqueo.)

---

## 9) PLAN — MÓDULO 2 (lo que sigue)
### TRIAL 7D (nuevo objetivo)
Requerimientos:
- Duración exacta **7 días** (no 48h).
- Límite: **50 mensajes por día** (se mantiene).
- Solo “Fase Trial”: NO desescalamiento de fármacos.
- Objetivo: estabilizar lecturas (ayuno y 2h post) de forma segura.
- Día 7: reporte final:
  - promedio 7 días
  - tendencia
  - hábitos que funcionaron
  - invitación a Full

Cambios técnicos pendientes:
- Cambiar `ensureUserState()`:
  - `trialEndsAt = now + 7 días`
  - lógica de expiración por fecha
- Agregar “TrialDayIndex” (opcional):
  - day 1..7 calculado por diferencia entre `trialStartedAt` y `now` (tz MX).
- Reporte día 7: función nueva `buildTrialFinalReport(userId)`.

### FULL 12 semanas / 90 días
- Fase 1: estabilización glucosa + horarios
- Fase 2: optimización nutricional + sensibilidad a insulina
- Fase 3: mantenimiento + prevención recaída
- Objetivo: “control real” + glicosilada < 5.6 (medible).
- Medicación: NO quitar meds automático.
  - Pendiente: módulo de conversación guiada para hablar con médico.

### Mantenimiento (post 3 meses)
- Pago mensual recurrente cancelable.
- CTA de pago solo cuando termine Full.

---

## 10) Requerimientos UI (pendiente de implementar)
El asistente debe mostrar:
1) Leyenda fija abajo: “Asistente educativo, no sustituye consulta médica.”
2) Estado del modo:
   - Trial (días restantes) + link/botón de pago siempre visible en trial
   - Full (semanas restantes) sin botón, hasta que termine
   - Mantenimiento (suscripción mensual) con opción de cancelar

Recomendación técnica:
- `/api/config` o nuevo `/api/status` que devuelva:
  - `licenseStatus`
  - `daysRemaining` (trial/full)
  - `modeLabel`
  - `ctaUrl` (si aplica)

---

## 11) Texto listo para iniciar el siguiente chat
Estamos trabajando en AIDA (Next.js App Router + Prisma 7). Ya quedó:
- Estado clínico persistente post-hipo con intercepts (HYPO_ACTIVE/RECOVERING).
- Resumen diario manual (cuando el usuario lo pide) + anti-duplicado.
- Rate limit trial 50/día con reset por fecha local MX.
- Bypass clínico guarda lecturas y setea clinicalState.

Siguiente paso: arrancamos MÓDULO 2:
1) Cambiar trial de 48h a 7 días exactos.
2) Reporte final día 7.
3) API/Frontend para mostrar “modo actual” + disclaimer educativo + CTAs.