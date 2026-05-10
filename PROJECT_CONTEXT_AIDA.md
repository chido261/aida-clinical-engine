# PROJECT_CONTEXT_AIDA.md

**Estado Actual – 03 May 2026**  
**Actualizado: AIDA funcional en producción + dominio `bajatuglucosa.com` conectado + Vercel/Neon operando + estrategia Local vs Cloud separada**

---

## 1) Visión general del proyecto

**AIDA (Artificial Intelligence Diabetes Assistant)** es un asistente conversacional educativo para personas con diabetes tipo 2 / prediabetes, estilo WhatsApp, con:

- Acompañamiento tipo coach profesional.
- Seguimiento de lecturas de glucosa.
- Estado clínico persistente post-hipoglucemia.
- Resumen diario manual.
- Trial de 7 días.
- Límite de 50 mensajes/día en trial.
- PWA instalable en celular.
- Análisis de imágenes y PDFs.
- Dictado por voz.
- Versión cloud funcional en Vercel.
- Base de datos PostgreSQL en Neon.
- Dominio propio conectado: `bajatuglucosa.com`.

---

## 2) Estado técnico actual

Stack:

- Next.js 16.1.6 con App Router.
- Prisma 7.x.
- SQLite local.
- PostgreSQL cloud con Neon.
- OpenAI SDK.
- PWA con manifest y service worker.
- GitHub repo: `https://github.com/chido261/aida-clinical-engine`
- Ramas actuales:
  - `main` = producción estable.
  - `dev` = desarrollo local/pruebas.
- Producción en Vercel.
- Dominio comprado en Namecheap y conectado a Vercel.

URLs actuales:

```txt
https://bajatuglucosa.com/chat
https://aida-clinical-engine.vercel.app/chat
```

Dominio estratégico:

```txt
https://bajatuglucosa.com
```

Uso planeado:

```txt
https://bajatuglucosa.com        → página principal / carta de venta
https://bajatuglucosa.com/app    → acceso a AIDA (pendiente crear redirect a /chat)
https://bajatuglucosa.com/chat   → AIDA actualmente funcional
```

Últimos commits relevantes:

```txt
cd230c4 - Add PostgreSQL Prisma adapter for Vercel
1dc9089 - Fix Prisma client initialization for cloud build
bdfdccc - Add PostgreSQL migration to sync cloud schema
5f90023 - Update AIDA project context before cloud setup
f82576e - Add file analysis and mobile attachment menu
b55f2ff - Add image preview and voice dictation
```

Build actual local:

```bash
npm run build
```

Resultado:

```txt
✅ Prisma generate correcto
✅ TypeScript correcto
✅ Next build correcto
✅ /api/analyze-file correcto
✅ /api/chat correcto
✅ /chat correcto
✅ Sin errores
✅ working tree clean
```

Producción actual:

```txt
✅ Vercel Production: Ready
✅ Dominio bajatuglucosa.com: Valid Configuration
✅ AIDA responde en producción
✅ Neon/PostgreSQL conectado correctamente
✅ Imagen funciona
✅ Micrófono funciona
```

---

## 3) Archivos principales actuales

### Chat principal

```txt
app/chat/page.tsx
```

Funciones actuales:

- Interfaz tipo chat.
- Barra inferior minimalista estilo ChatGPT:
  - Botón `+`
  - Campo “Pregúntale a AIDA”
  - Micrófono para dictado
  - Botón enviar `↑`
- Menú de adjuntos:
  - Cámara
  - Fotos
  - Archivos
- Vista previa de imagen antes de enviar.
- Selección de PDF.
- Auto-crecimiento del textarea conforme se dicta o escribe texto.
- Dictado por voz funcional en Chrome Android, especialmente con HTTPS.
- Envío real de imágenes/PDF a endpoint de análisis.

### Endpoint análisis de archivos

```txt
app/api/analyze-file/route.ts
```

Funciona para:

- Imágenes de etiquetas/productos.
- PDFs de análisis de laboratorio.
- Usa OpenAI Responses API.
- Para imagen: envía `input_image` en base64.
- Para PDF: sube archivo con `openai.files.create()` y lo analiza como `input_file`.
- Límite actual: 10 MB.

Objetivo del endpoint:

- Si es etiqueta/producto:
  - Detectar ingredientes que puedan afectar glucosa.
  - Decir si conviene, limitar o evitar.
  - Dar recomendación práctica.
- Si es estudio de laboratorio:
  - Dar primero buenas noticias.
  - Luego puntos pendientes por trabajar.
  - Explicar de forma educativa.
  - Sugerir hábitos/seguimiento.
  - No diagnosticar.
  - No suspender medicamentos.

### Prisma client

```txt
app/lib/prisma.ts
```

Estado actual:

- Local SQLite usa:

```txt
@prisma/adapter-better-sqlite3
```

- Cloud PostgreSQL usa:

```txt
@prisma/adapter-pg
pg
```

Código actual esperado:

```ts
// app/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { APP_MODE, getDatabaseUrl } from "@/app/lib/runtimeConfig";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function assertEnv(url: string) {
  // Fail-fast en cloud
  if (APP_MODE === "cloud") {
    if (!url) throw new Error("DATABASE_URL missing (cloud)");
    if (url.startsWith("file:")) {
      throw new Error("DATABASE_URL cannot be sqlite in cloud");
    }
  }

  // Fail-fast local
  if (APP_MODE === "local") {
    if (!url) throw new Error("DATABASE_URL missing (local)");
    if (!url.startsWith("file:")) {
      throw new Error("DATABASE_URL must be sqlite file: in local");
    }
  }
}

function makePrismaClient() {
  const url = getDatabaseUrl();
  assertEnv(url);

  // Local sqlite
  if (url.startsWith("file:")) {
    const adapter = new PrismaBetterSqlite3({ url });
    return new PrismaClient({ adapter });
  }

  // Cloud postgres
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### Runtime config

```txt
app/lib/runtimeConfig.ts
```

Estado:

- `APP_MODE=local` para laptop.
- `APP_MODE=cloud` para Vercel.
- Protege para que cloud no use SQLite por error.

### Prisma config

```txt
prisma.config.ts
```

Estado:

- Usa `PRISMA_ENV=production` para seleccionar:

```txt
prisma/schema.postgres.prisma
prisma/migrations_pg
.env.production
```

- En local, sin `PRISMA_ENV=production`, usa:

```txt
prisma/schema.prisma
prisma/migrations
.env.local
```

### Schemas Prisma

```txt
prisma/schema.prisma              → SQLite local
prisma/schema.postgres.prisma     → PostgreSQL cloud
```

Modelos actuales:

```txt
UserState
Reading
UsageDaily
```

### Migraciones PostgreSQL

```txt
prisma/migrations_pg/20260225132933_init_pg/migration.sql
prisma/migrations_pg/20260503232059_sync_pg_schema/migration.sql
```

La migración `sync_pg_schema` agregó los campos faltantes:

```txt
clinicalState
dailySummaryCount
dailySummaryDate
fullEndsAt
fullStartedAt
```

### Device ID

```txt
app/lib/deviceId.ts
```

Ya fue corregido:

- Usa `crypto.randomUUID()` si existe.
- Si no existe, usa fallback.
- Esto resolvió error en celular: `crypto.randomUUID is not a function`.

### PWA

```txt
app/manifest.ts
public/sw.js
public/icon-192.png
public/icon-512.png
```

Estado:

- La app ya abre en celular.
- Ya se puede instalar como aplicación.
- Los íconos fueron reemplazados por una versión más profesional.
- `display: "standalone"` ya está configurado.

---

## 4) Funciones ya probadas

### Local / celular

Probado en celular vía red local:

```txt
http://192.168.50.212:3000/chat
```

También se probó con HTTPS mediante Cloudflare Tunnel para funciones como micrófono.

Estado funcional local:

```txt
✅ Abre en celular
✅ Se instala como PWA
✅ Ícono actualizado
✅ Chat funciona
✅ Botón + funciona
✅ Menú Cámara/Fotos/Archivos funciona
✅ Selección de imagen funciona
✅ Vista previa de imagen funciona
✅ AIDA lee e interpreta imágenes
✅ PDF se sube y se interpreta correctamente
✅ Micrófono dicta texto
✅ Textarea crece automáticamente
```

### Producción / dominio propio

Probado en:

```txt
https://bajatuglucosa.com/chat
```

Estado funcional producción:

```txt
✅ Abre con dominio propio
✅ Trial visible
✅ Chat responde
✅ Neon/PostgreSQL conectado
✅ AIDA responde a lecturas de glucosa
✅ Lee imágenes
✅ Micrófono funciona
✅ HTTPS activo por Vercel
```

Prueba realizada:

```txt
Hola, soy David. Hoy amanecí con glucosa de 145 en ayunas.
```

AIDA respondió correctamente:

```txt
En ayunas está elevado.
Hoy enfócate en desayuno sin azúcar/harinas y revisemos la cena de ayer.
Si te sientes bien, movimiento suave 10 min es opcional.
```

---

## 5) Estado conversacional / clínico ya implementado

Archivo principal:

```txt
app/api/chat/route.ts
```

Ya existe:

- Detección de lectura de glucosa.
- Detección de momento:
  - AYUNO
  - POSTCOMIDA
  - NOCHE
  - DESCONOCIDO
- Regla: no asumir momento si el usuario no lo dice.
- Intercept para hipoglucemia.
- Estado clínico persistente:
  - `HYPO_ACTIVE`
  - `RECOVERING_FROM_HYPO`
- Bypass de seguridad.
- Resumen diario manual.
- Reporte final de trial manual.
- Rate limit trial 50 mensajes/día.
- UI payload con:
  - disclaimer
  - mode
  - modeLabel
  - daysRemaining
  - ctaText
  - ctaUrl
  - blocked

---

## 6) Estado Trial / Local / Cloud

Archivo clave:

```txt
app/lib/aidaMemory.ts
```

Estado actual:

- `TRIAL_DAYS = 7`
- `DAILY_LIMIT_TRIAL = 50`
- `FULL_DAYS = 90`
- `MAINTENANCE_DAYS = 30`

Ya existe:

- `ensureUserState()`
- `getTrialInfo()`
- `getWindowInfo()`
- `isTrialExpired()`

Reglas:

### Local

```txt
APP_MODE=local
DATABASE_URL=file:./prisma/dev.db
```

- Siempre funciona como `active`.
- No aplica paywall.
- No bloquea desarrollo.
- Se usa para laptop/desarrollo/pruebas.
- Usa SQLite local.

### Cloud

```txt
APP_MODE=cloud
PRISMA_ENV=production
DATABASE_URL=postgresql://... Neon
```

- Aplica trial 7 días.
- Aplica 50 mensajes/día.
- Bloquea cuando trial termina.
- Muestra CTA de pago o activación full.
- Usa PostgreSQL/Neon, no SQLite.

---

## 7) Infraestructura cloud actual

### Vercel

Proyecto:

```txt
aida-clinical-engine
```

Producción:

```txt
main
```

Estado:

```txt
✅ Production Ready
```

Dominio Vercel:

```txt
https://aida-clinical-engine.vercel.app/chat
```

Dominio propio:

```txt
https://bajatuglucosa.com/chat
```

Variables configuradas en Vercel:

```txt
APP_MODE=cloud
PRISMA_ENV=production
DATABASE_URL=postgresql://... Neon
OPENAI_API_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
```

Notas:

- `APP_MODE` y `PRISMA_ENV` quedaron configuradas en Production and Preview.
- Variables críticas actualizadas tras errores iniciales.
- `DATABASE_URL` fue corregida para apuntar correctamente a Neon.

### Neon

Proyecto:

```txt
aida-production
```

Base:

```txt
neondb
```

Estado:

```txt
✅ Conexión validada
✅ Migraciones aplicadas
✅ Schema sincronizado
```

Problemas resueltos:

1. Error inicial:

```txt
P1000 Authentication failed
```

Causa: credenciales viejas o inválidas en `.env.production`.

Solución: copiar connection string nueva desde Neon.

2. Drift detectado:

```txt
Your database schema is not in sync with your migration history
```

Solución:

```powershell
$env:PRISMA_ENV="production"; npx prisma migrate reset
$env:PRISMA_ENV="production"; npx prisma migrate dev --name sync_pg_schema
```

3. Error Vercel/Prisma:

```txt
Using engine type "client" requires either "adapter" or "accelerateUrl"
```

Solución:

```powershell
npm install @prisma/adapter-pg pg
npm install -D @types/pg
```

Y actualizar `app/lib/prisma.ts` para usar `PrismaPg` en cloud.

---

## 8) Dominio y estrategia comercial

Dominio comprado:

```txt
bajatuglucosa.com
```

Registrador:

```txt
Namecheap
```

Configuración DNS actual en Namecheap:

```txt
Type: A Record
Host: @
Value: 216.198.79.1
TTL: Automatic
```

Registros eliminados en Namecheap:

```txt
CNAME Record    www    parkingpage.namecheap.com
URL Redirect    @      http://www.bajatuglucosa...
```

Estado en Vercel:

```txt
bajatuglucosa.com → Valid Configuration
```

Estrategia comercial:

```txt
https://bajatuglucosa.com
```

Se usará como página principal o carta de venta.

```txt
https://bajatuglucosa.com/app
```

Se quiere usar como acceso directo a AIDA.

Estado pendiente:

```txt
Crear redirect /app → /chat
```

Recomendación técnica para próximo paso:

Modificar `next.config.ts` para agregar redirect:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/chat",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

---

## 9) Estrategia Local vs Cloud

La nube y la laptop quedaron separadas así:

### Laptop / desarrollo

```txt
Rama: dev
APP_MODE=local
DATABASE_URL=file:./prisma/dev.db
```

Uso:

- Desarrollar funciones nuevas.
- Probar cambios.
- Romper/corregir sin afectar usuarios reales.
- Usar `npm run dev`.
- Usar SQLite local.

### Nube / producción

```txt
Rama: main
APP_MODE=cloud
PRISMA_ENV=production
DATABASE_URL=Neon PostgreSQL
```

Uso:

- Versión estable.
- Usuarios reales prueban por 7 días.
- Dominio propio.
- No se actualiza automáticamente con cambios locales en `dev`.

Flujo recomendado:

```txt
1. Trabajar cambios en rama dev.
2. Probar en laptop.
3. Hacer build local.
4. Si todo está bien, commit en dev.
5. Push a dev.
6. Merge dev → main.
7. Push a main.
8. Vercel actualiza producción desde main.
```

Esto evita que cambios en laptop se publiquen automáticamente en nube.

---

## 10) Comandos importantes usados

### Crear rama dev

```powershell
git checkout -b dev
git push -u origin dev
```

### Probar build local

```powershell
npm run build
```

### Migraciones cloud

```powershell
$env:PRISMA_ENV="production"; npx prisma migrate reset
$env:PRISMA_ENV="production"; npx prisma migrate dev --name sync_pg_schema
```

### Regresar terminal a local después de usar producción

```powershell
Remove-Item Env:\PRISMA_ENV
$env:APP_MODE="local"
```

### Instalar adapter PostgreSQL

```powershell
npm install @prisma/adapter-pg pg
npm install -D @types/pg
```

### Flujo dev → main

```powershell
git checkout dev
npm run build
git add .
git commit -m "mensaje"
git push origin dev

git checkout main
git pull origin main
git merge dev
git push origin main
git status
```

---

## 11) Riesgos / puntos a cuidar

1. No dejar `PRISMA_ENV=production` activo en terminal local cuando se quiera hacer build local con SQLite.
2. En Vercel, `PRISMA_ENV=production` es obligatorio para usar `schema.postgres.prisma`.
3. En Vercel, `APP_MODE=cloud` es obligatorio para activar lógica cloud/trial.
4. `DATABASE_URL` en cloud debe ser PostgreSQL Neon, nunca `file:`.
5. `DATABASE_URL` local debe ser SQLite `file:`.
6. Si se actualiza Prisma, revisar compatibilidad de adapters.
7. No correr `npm audit fix --force` sin revisar, porque puede romper dependencias.
8. Si se cambia schema, actualizar tanto SQLite como PostgreSQL si aplica.
9. Las migraciones PostgreSQL van en `prisma/migrations_pg`.
10. No mezclar datos reales de usuarios con pruebas destructivas como `migrate reset`.

---

## 12) Próximo objetivo recomendado

### Objetivo inmediato

Crear acceso limpio:

```txt
https://bajatuglucosa.com/app
```

para que abra AIDA.

Acción:

- Modificar `next.config.ts`.
- Agregar redirect `/app` → `/chat`.
- Probar build local.
- Commit en `dev`.
- Merge a `main`.
- Deploy automático en Vercel.
- Probar:

```txt
https://bajatuglucosa.com/app
```

### Objetivo comercial posterior

Crear carta de venta en:

```txt
https://bajatuglucosa.com
```

con CTA hacia:

```txt
https://bajatuglucosa.com/app
```

Promesa sugerida:

```txt
Aprende a bajar y estabilizar tu glucosa en 7 días con ayuda de AIDA, tu asistente educativo para diabetes tipo 2.
```

Tono recomendado:

- Educativo.
- Ético.
- No prometer curación absoluta.
- Evitar “garantizado”.
- Enfocar en acompañamiento, alimentación, seguimiento y control.

---

## 13) Checklist para siguiente sesión

Al iniciar la siguiente sesión, verificar:

```powershell
git status
git branch
```

Estado esperado:

```txt
On branch main o dev
working tree clean
```

Si se va a trabajar código:

```powershell
git checkout dev
```

Primer archivo recomendado para modificar:

```txt
next.config.ts
```

Objetivo:

```txt
Agregar redirect /app → /chat
```

---

## 14) Texto listo para iniciar el próximo chat

Copiar y pegar esto al iniciar el próximo chat:

```txt
Vamos a continuar con AIDA.

Estado actual:
AIDA ya funciona en producción con Vercel + Neon PostgreSQL + dominio propio.

URL actual funcional:
https://bajatuglucosa.com/chat

Dominio comprado en Namecheap:
bajatuglucosa.com

DNS configurado:
A Record @ → 216.198.79.1

Vercel:
Production Ready
Dominio bajatuglucosa.com Valid Configuration

GitHub:
Repo: chido261/aida-clinical-engine
main = producción
dev = desarrollo

Último estado:
Chat responde, imagen funciona y micrófono funciona en producción.

Siguiente objetivo:
Crear la ruta https://bajatuglucosa.com/app para abrir AIDA.
Para eso quiero modificar next.config.ts y agregar redirect /app → /chat.

Trabajemos paso a paso, un punto a la vez, sin saltarnos pruebas.
```

---

## 15) Nota de actualización

El contexto anterior decía que la nube era el objetivo próximo. Eso ya quedó completado.

Estado real actual:

```txt
✅ AIDA ya está en la nube
✅ Vercel funciona
✅ Neon funciona
✅ Dominio propio funciona
✅ bajatuglucosa.com conectado
✅ /chat funciona en producción
✅ imagen y micrófono probados
```

Pendiente inmediato:

```txt
Crear /app → /chat
Crear página principal / carta de venta en bajatuglucosa.com
```
