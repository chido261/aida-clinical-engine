# PROJECT_CONTEXT_AIDA.md
**Estado Actual – 24 Feb 2026 (Actualizado: Multiusuario + Trial 48h + Rate limit + Paywall + PWA Push + Respaldo SQLite + Ruta a Nube/Neon)**

---

## 1) Visión general del proyecto
**AIDA (Artificial Intelligence Diabetes Assistant)** es un asistente conversacional educativo para personas con **diabetes tipo 2 / prediabetes**, estilo WhatsApp, con:

- Educación terapéutica y acompañamiento por fases (3 meses).
- Seguimiento cuantitativo real (lecturas, promedios, tendencia).
- PWA con notificaciones push reales.
- Control de acceso por **dispositivo** (multiusuario real).
- Prueba gratuita (**trial**) + modelo de licencia anual (**paywall**).
- Camino a infraestructura en la nube (BD Postgres en Neon / despliegue futuro).

**Objetivo estratégico:** convertir AIDA en un motor clínico digital escalable (tipo SaaS) con licencias por dispositivo, límites por plan y medición de uso.

---

## 2) Stack / Arquitectura actual (local)
- **Next.js 16** (App Router)
- API principal: `app/api/chat/route.ts`
- Prisma (CLI/Client **7.4.1**) + **SQLite** en local
- Prisma Client singleton: `app/lib/prisma.ts`
- Prompt central: `app/lib/aidaPrompt.ts`
- Motor cuantitativo/progreso: `app/lib/aidaProgress.ts`
- Baseline: `app/lib/aidaBaseline.ts`
- Estado por usuario: `UserState` (DB)
- UI: `/chat` (pantalla principal)

---

## 3) Persistencia / Base de datos (estado real hoy)
### 3.1 Modo Local (ACTUAL, estable)
- **SQLite** con archivo: `prisma/dev.db`
- Variable: `DATABASE_URL="file:./prisma/dev.db"`

### 3.2 Modo Nube (en preparación)
- Neon Postgres ya está creado (proyecto: `aida-production`).
- Variables (cuando migremos):
  - `DATABASE_URL="postgresql://..."` (pooler recomendado)
  - `DATABASE_URL_UNPOOLED="postgresql://..."` (direct/unpooled)

---

## 4) Incidente principal resuelto (24 Feb): Prisma 7 + “engine type client”
### Síntomas
- `PrismaClientConstructorValidationError: Using engine type "client" requires either "adapter" or "accelerateUrl"...`
- Otros síntomas secundarios: `Cannot open database because the directory does not exist`

### Causas reales (combinadas)
1) Se mezclaron **configs**: `.env/.env.local` apuntando a Neon (Postgres) mientras el `schema.prisma` estaba en SQLite.
2) Prisma 7 prioriza `prisma.config.ts` para la URL del datasource (según el modo/config actual).
3) Se ejecutó sin DB local existente o sin ruta correcta (archivo `dev.db` no estaba donde Prisma lo buscaba).
4) Node cambió (estaba en v24 y se estabilizó en v20).

### Solución aplicada (estado final)
- Se volvió a **SQLite estable**.
- Se restauró el respaldo de SQLite y se ubicó en: `prisma/dev.db`
- Se dejó `DATABASE_URL="file:./prisma/dev.db"` en `.env.local` y `.env`
- Node estable:
  - `node -v` → **v20.20.0**
  - `npm -v` → **10.8.2**

✅ Resultado: Prisma Studio muestra filas en `UserState` y la app vuelve a operar local.

---

## 4.1) Experimento de despliegue en Vercel (25-feb-2026)

**Objetivo:** validar el pipeline GitHub → Vercel (build) y el runtime en nube con Prisma.

**Logros:**
- Repo conectado a Vercel, deployments en *Production* (estado *Ready*).
- La UI carga correctamente en la URL de Vercel.

**Problemas que salieron y cómo se atacaron:**
- **Build (TypeScript/Prisma):** `PrismaClient` no disponible / no generado en build → se agregó `postinstall: prisma generate` y `build: prisma generate && next build` en `package.json`.
- **Errores TS por `any` (strict):** se ajustó tipado en `aidaProgress.ts` (map/filter) y se alineó la firma de `getProgressMetrics` con su uso en `/api/chat`.
- **Prisma runtime (local vs nube):** se dejó `app/lib/prisma.ts` con una *factory* que usa `PrismaBetterSqlite3` **solo** cuando `DATABASE_URL` inicia con `file:`; si no, crea `PrismaClient()` estándar (Postgres/Neon).

**Problema actual en nube (pendiente):**
- En producción, `/api/chat` falla con:
  - `TypeError: Cannot open database because the directory does not exist` (Prisma `clientVersion: 7.3.0`).
- Interpretación: en runtime se está intentando abrir **SQLite** (ruta `file:`) dentro de Vercel (filesystem no persistente / path inexistente).
- Hipótesis principales:
  1) `DATABASE_URL` en Vercel no está llegando al runtime (o está mal nombrada / no aplicada a Production).
  2) `DATABASE_URL` llega, pero trae `file:` o un path inválido, por eso cae en la rama SQLite.

**Conclusión:** el despliegue ya es viable; falta estandarizar un *switch* claro para alternar **modo local (SQLite)** y **modo nube (Postgres/Neon)** sin tocar el resto del código.

## 5) Respaldo práctico (receta reproducible)
### 5.1 Encontrar commit “bueno”
```bash
git --no-pager log -20 --date=local --pretty=format:"%h | %ad | %d | %s"
```

Commit relevante visto:
- `e0d460f` → “AIDA: trial gate + paywall + rate limit + usage metrics stable”

### 5.2 Clonar el repo a una carpeta backup (sin tocar el original)
Desde `C:\Users\David\asistente-glucosa\app-glucosa`:
```bash
git clone . ..\app-glucosa-backup-2010
cd ..\app-glucosa-backup-2010
git checkout e0d460f
```

### 5.3 Ubicar el SQLite del respaldo
En ese backup se encontró `dev.db` en la **raíz** del proyecto backup.  
Para el proyecto actual lo correcto es tenerlo en `prisma/dev.db`.

---

## 6) Features confirmadas hoy en UI (ya visibles)
- ✅ **Rate limit**: “Límite diario alcanzado (50 mensajes en prueba)…”
- ✅ **Paywall**: modal “Tu prueba gratuita terminó” + botón “Pagar 1 año”
- ✅ BD con múltiples `UserState` (IDs distintos) ⇒ multiusuario real

---

## 7) Archivos clave (mapa rápido)
- `app/lib/prisma.ts` — Singleton PrismaClient
- `prisma/schema.prisma` — Modelos (UserState, Reading, UsageDaily, etc.)
- `prisma.config.ts` — Fuente de verdad del datasource URL en Prisma 7
- `.env.local` — Variables dev local (incluye VAPID + DATABASE_URL local)
- `.env` — Variables genéricas (Neon puede quedar comentado y SQLite activo)

---

## 8) Estado de “Multiusuario” (resumen técnico)
- `userId` real por dispositivo/sesión y persistido en DB en `UserState`
- Campos relevantes:
  - `id`, `dailyMsgDate`, `dailyMsgCount`, `baselineA1c`, `baselineAvgGlucose`, `baselineSetAt`, `createdAt`
- Helper existente:
  - `ensureUserState(userId: string)` (ubicado en `app/api/chat/route.ts`; puede moverse a `app/lib/aidaMemory.ts` si conviene)

---

## 9) Checklist “mañana” (plan de trabajo)
### 9.1 Respaldo formal (antes de tocar nube)
1) Copiar `prisma/dev.db` a `backups/dev_YYYY-MM-DD.db`
2) Crear tag/commit “estado estable local”
   - Tag sugerido: `stable-local-sqlite-2026-02-24`

### 9.2 Migración a la nube (Neon Postgres)
- Mantener dos modos:
  - DEV local: SQLite
  - STAGING/PROD: Neon Postgres
- Separar variables por entorno (evitar mezcla)
- Cambiar provider a `postgresql` al migrar
- Aplicar migraciones contra Neon y validar:
  - trial + rate limit + paywall + usage

- Crear un archivo único de configuración de entorno (ej. `app/lib/runtimeConfig.ts` o `app/lib/variables.ts`) para centralizar:
  - `APP_MODE` (`local` | `cloud`)
  - lectura/validación de `DATABASE_URL`
  - selección de Prisma client (SQLite adapter vs Postgres).
- Revertir temporalmente a **modo laptop (SQLite)** para completar ajustes funcionales (multiusuario, licencias, UX, reglas).
- Mantener listo el camino a nube: cuando toque, solo cambiamos `APP_MODE`/`DATABASE_URL` y volvemos a desplegar.

---

## 10) Texto listo para pegar en el siguiente chat

Estamos trabajando en **AIDA – Clinical Engine** (Next.js App Router + Prisma).

**Estado actual:**
- En laptop funciona con **SQLite** y Prisma (dev.db).
- Ya probamos el **deploy en Vercel**: el build pasa y la UI carga, pero el runtime falla en `/api/chat` con `Cannot open database because the directory does not exist`, lo que indica que en nube se está intentando abrir **SQLite (file:)** dentro de Vercel.

**Lo que hicimos hoy:**
- Conectamos repo a Vercel y configuramos env vars (DATABASE_URL, OPENAI_API_KEY, VAPID_*).
- Arreglamos errores de build (PrismaClient/generate + TypeScript strict).
- Dejamos `package.json` con `postinstall: prisma generate` y `build: prisma generate && next build`.
- Ajustamos `app/lib/prisma.ts` para usar `better-sqlite3` **solo** cuando `DATABASE_URL` inicia con `file:`; de lo contrario, usa PrismaClient estándar (Postgres/Neon).

**Siguiente objetivo (en este nuevo chat):**
1) **Regresar a modo laptop (SQLite)** para terminar ajustes funcionales sin fricción.
2) Crear un archivo único tipo `app/lib/runtimeConfig.ts` (o `variables.ts`) que centralice el modo **local vs cloud** (APP_MODE/DATABASE_URL) y exponga el prisma client correcto. La idea es que para volver a nube solo cambiemos ese archivo/variables y listo.

Para continuar, revisaremos:
- Cómo estamos leyendo `DATABASE_URL` en local y cómo forzamos `APP_MODE=local`.
- Qué cambios de funcionalidad quedan pendientes (multiusuario, trial gate, licencias por dispositivo, UX onboarding).
