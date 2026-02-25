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

---

## 10) Texto listo para iniciar el siguiente chat (cópialo tal cual)
Estoy trabajando en AIDA (Next.js 16 + Prisma 7.4.1). Hoy restauré el modo local estable con SQLite en `prisma/dev.db` y `DATABASE_URL="file:./prisma/dev.db"` en `.env.local` y `.env`. Ya se ve en UI el rate limit (50 mensajes/día en prueba) y el paywall (“Tu prueba gratuita terminó” + botón “Pagar 1 año”). Prisma Studio muestra múltiples filas en `UserState` (multiusuario). Mañana quiero: (1) hacer respaldo formal de `prisma/dev.db` + tag/commit estable, y (2) continuar la migración a la nube con Neon Postgres (definir variables por entorno, cambiar provider, correr migraciones y validar que todo siga funcionando).
