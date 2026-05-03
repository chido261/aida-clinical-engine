# PROJECT_CONTEXT_AIDA.md

**Estado Actual – 03 May 2026**  
**Actualizado: PWA funcional en celular + análisis de imágenes/PDF + menú de adjuntos + dictado por voz + build limpio + estrategia Local vs Cloud separada**

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
- Preparación para deploy en nube con dominio propio.

---

## 2) Estado técnico actual

Stack:

- Next.js 16.1.6 con App Router.
- Prisma 7.x.
- SQLite local.
- PostgreSQL cloud proyectado con Neon.
- OpenAI SDK.
- PWA con manifest y service worker.
- GitHub repo: `https://github.com/chido261/aida-clinical-engine`
- Rama actual: `main`

Últimos commits relevantes:

```txt
f82576e - Add file analysis and mobile attachment menu
b55f2ff - Add image preview and voice dictation
```

Build actual:

```bash
npm run build
```

Resultado:

```txt
✅ Prisma generate correcto
✅ TypeScript correcto
✅ Next build correcto
✅ /api/analyze-file correcto
✅ /chat correcto
✅ Sin errores
✅ working tree clean
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

## 4) Funciones ya probadas en celular

Probado en celular vía red local:

```txt
http://192.168.50.212:3000/chat
```

También se probó con HTTPS mediante Cloudflare Tunnel para funciones como micrófono.

Estado funcional:

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

### Cloud

```txt
APP_MODE=cloud
DATABASE_URL=postgresql://... Neon
```

- Debe aplicar trial 7 días.
- Debe aplicar 50 mensajes/día.
- Debe bloquear cuando trial termine.
- Debe mostrar CTA de pago o activación full.
- Debe usar PostgreSQL/Neon, no SQLite.

---

## 7) Objetivo del próximo chat

Ahora se trabajará en subir AIDA a la nube.

Objetivo:

```txt
Tener una versión funcional online con URL fija para que personas puedan probar AIDA durante 7 días y dar retroalimentación.
```

El usuario comprará dominio en Namecheap.

Deseo del usuario:

```txt
Quiero tener una versión funcional en la nube con dominio propio.
Quiero enviar el link a personas para que prueben la app por 7 días.
Quiero recibir retroalimentación.
Quiero mantener mi versión local/laptop aislada de la versión cloud.
No quiero que cada cambio local se actualice automáticamente en producción.
Quiero probar cambios localmente y, cuando estén listos, decidir cuándo actualizar la nube.
```

---

## 8) Estrategia recomendada Local vs Cloud

La nube y la laptop deben quedar separadas así:

### Laptop / desarrollo

```txt
Rama sugerida: dev
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
Rama sugerida: main
APP_MODE=cloud
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
3. Hacer build.
4. Si todo está bien, mergear dev → main.
5. Hacer push a main.
6. Vercel actualiza producción desde main.
```

Esto evita que cambios en laptop se publiquen automáticamente en nube.

---

## 9) Deploy recomendado

### Frontend / Backend Next.js

```txt
Vercel
```

Razón:

- Next.js funciona nativamente.
- Deploy sencillo desde GitHub.
- Permite variables de entorno.
- Permite dominio propio.
- Permite rama de producción y preview deployments.

### Base de datos cloud

```txt
Neon PostgreSQL
```

Razón:

- Compatible con Prisma.
- Ideal para Vercel.
- Tiene string `DATABASE_URL`.
- Permite separar base local y base cloud.

### Dominio

```txt
Namecheap
```

Plan:

- Comprar dominio.
- Conectarlo a Vercel.
- Configurar DNS según Vercel:
  - A record o CNAME según indique Vercel.
- Dominio sugerido puede ser:
  - `aida.tudominio.com`
  - `app.tudominio.com`
  - según disponibilidad.

---

## 10) Variables de entorno necesarias en cloud

En Vercel se deben configurar:

```txt
APP_MODE=cloud
DATABASE_URL=postgresql://...
OPENAI_API_KEY=...
AIDA_BILLING_URL=/pago
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
```

Notas:

- `DATABASE_URL` en cloud NO debe ser SQLite.
- `APP_MODE=cloud` activará validaciones fail-fast.
- Para producción, si aún no hay pagos reales, `AIDA_BILLING_URL` puede apuntar a una página provisional o WhatsApp.

---

## 11) Riesgos / puntos que revisar en deploy

Antes de producción revisar:

1. Prisma schema para cloud:
   - Confirmar si se usa `prisma/schema.postgres.prisma`.
   - Confirmar cómo `prisma.config.ts` selecciona schema local/cloud.
2. Migrations:
   - Asegurar migraciones compatibles con PostgreSQL.
3. Build en Vercel:
   - Confirmar que `npm run build` funcione con env cloud.
4. OpenAI:
   - Confirmar que `OPENAI_API_KEY` esté en Vercel.
5. PDF:
   - Confirmar que `openai.files.create()` funcione en Vercel.
6. PWA:
   - Confirmar manifest e íconos en dominio HTTPS.
7. Micrófono:
   - En producción funcionará mejor por HTTPS.
8. Trial:
   - Confirmar que usuarios nuevos en cloud realmente entren como `trial`.
9. Paywall:
   - Confirmar bloqueo al terminar trial.
10. No mezclar DB local y DB cloud.

---

## 12) Plan paso a paso para próximo chat

No saltar pasos.

### Fase 1 — Preparar ramas

1. Verificar estado actual:

```powershell
git status
git branch
```

2. Crear rama de desarrollo:

```powershell
git checkout -b dev
git push -u origin dev
```

3. Definir producción en Vercel desde `main`.
4. Trabajar cambios nuevos en `dev`, no en `main`.

---

### Fase 2 — Revisar configuración cloud

Archivos a revisar:

```txt
package.json
prisma.config.ts
app/lib/prisma.ts
app/lib/runtimeConfig.ts
prisma/schema.prisma
prisma/schema.postgres.prisma
```

Objetivo:

- Confirmar que local usa SQLite.
- Confirmar que cloud usa PostgreSQL.
- Confirmar que build de Vercel no use accidentalmente SQLite.

---

### Fase 3 — Crear Neon

1. Crear proyecto en Neon.
2. Copiar `DATABASE_URL`.
3. Configurar en Vercel:

```txt
DATABASE_URL=...
APP_MODE=cloud
```

4. Ejecutar migraciones cloud según estrategia que se defina.

---

### Fase 4 — Subir a Vercel

1. Conectar GitHub repo a Vercel.
2. Seleccionar `main` como producción.
3. Configurar variables.
4. Deploy.
5. Probar URL temporal de Vercel.

---

### Fase 5 — Conectar dominio Namecheap

1. Comprar dominio.
2. En Vercel agregar dominio.
3. En Namecheap configurar DNS.
4. Esperar propagación.
5. Probar:

```txt
https://tudominio.com/chat
```

---

### Fase 6 — Prueba de usuario real

Checklist:

```txt
✅ Usuario nuevo entra
✅ Completa onboarding
✅ Chat funciona
✅ Trial inicia 7 días
✅ Muestra modo trial
✅ Cuenta mensajes
✅ Imagen se analiza
✅ PDF se analiza
✅ PWA se instala
✅ Micrófono funciona
✅ No usa DB local
✅ No se actualiza con cambios locales en dev
```

---

## 13) Texto listo para iniciar el próximo chat

Copiar y pegar esto al iniciar el próximo chat:

```txt
Vamos a subir AIDA a la nube.

Contexto:
AIDA ya funciona localmente como PWA en celular. Ya tiene chat, análisis de imágenes/PDF, vista previa de imagen, dictado por voz, textarea auto-creciente, trial 7 días, rate limit 50 mensajes/día, estado clínico persistente, resumen diario manual y endpoint /api/analyze-file.

Últimos commits:
- f82576e Add file analysis and mobile attachment menu
- b55f2ff Add image preview and voice dictation

Build actual:
npm run build → limpio, sin errores.
git status → working tree clean.

Objetivo:
Subir una versión funcional online para que personas prueben AIDA por 7 días y den retroalimentación.

Quiero comprar un dominio en Namecheap y conectarlo a Vercel.

Condición importante:
Quiero mantener mi versión local/laptop aislada de la versión cloud. No quiero que cada cambio que haga en laptop se publique automáticamente. Quiero trabajar en una rama dev/local, probar ahí, y solo cuando algo esté listo pasarlo a producción/main/nube.

Trabajemos paso a paso, un punto a la vez. Primero quiero dejar clara la estrategia de ramas y luego subir a Vercel + Neon.
```

---

## 14) Nota de actualización

El `PROJECT_CONTEXT_AIDA.md` anterior estaba desactualizado en varios puntos: todavía decía que el trial seguía en 48h y que Módulo 2 estaba pendiente.

En el código real actual:

- `app/lib/aidaMemory.ts` ya tiene `TRIAL_DAYS = 7`.
- La app ya funciona como PWA en celular.
- Ya analiza imágenes y PDF.
- Ya tiene dictado por voz.
- Ya tiene vista previa de imagen.
- Ya tiene textarea auto-creciente.
- Ya pasó `npm run build` sin errores.
