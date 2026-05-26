# CONTEXTO ACTUALIZADO — AIDA
Fecha: 26 mayo 2026
Repositorio: chido261/aida-clinical-engine

## Forma de trabajo acordada

El usuario quiere trabajar en modo productivo:

1. Avanzar un objetivo a la vez.
2. Trabajar un archivo a la vez cuando sea posible.
3. Primero explicar el objetivo concreto del cambio.
4. Dar acciones claras: Acción 1, Acción 2, Acción 3.
5. No dar explicaciones largas ni innecesarias.
6. Si se modifica código, entregar el archivo completo cuando el usuario lo pida.
7. No alterar lo ya funcional.
8. Conservar lo trabajado y modificar solo lo necesario.
9. Después de cada archivo, pedir una prueba concreta.
10. Esperar confirmación del usuario antes de pasar al siguiente punto.
11. Después de cada bloque funcional, pedir commit y push.
12. Si hay duda real, preguntar; si no, avanzar.
13. El usuario prefiere que primero se revise el repo cuando esté disponible.

Frase de trabajo útil:

“Vamos un punto a la vez. Primero reviso el archivo, luego te doy el código completo y después probamos.”

---

# Estado previo antes de este bloque

Ya estaba funcional:

1. Panel admin protegido con clave.
2. Panel de activaciones protegido.
3. Panel de usuarios protegido.
4. Listado general de usuarios.
5. Extensión manual de licencia por 30, 90 o 365 días.
6. Cancelación manual de licencia.
7. Reinicio manual de trial por 7 días.
8. Cambios anteriores subidos a GitHub.

Archivos principales ya existentes:

- app/admin/activaciones/page.tsx
- app/admin/usuarios/page.tsx
- app/api/admin/activation-requests/route.ts
- app/api/admin/activation-requests/update-status/route.ts
- app/api/admin/users/route.ts
- app/api/admin/users/extend-license/route.ts
- app/api/admin/users/update-license/route.ts
- app/api/activation-request/route.ts
- app/pago/page.tsx
- app/pago/mensual/page.tsx
- app/pago/3-meses/page.tsx
- app/pago/anual/page.tsx
- app/pago/activar/page.tsx
- prisma/schema.prisma
- app/lib/aidaMemory.ts
- app/lib/runtimeConfig.ts
- app/api/chat/route.ts

---

# Bloque trabajado en este chat

## 1. Se revisó navegación admin en /admin/activaciones

Archivo revisado:

- app/admin/activaciones/page.tsx

Resultado:

Ya tenía enlace hacia:

- /admin/usuarios

No fue necesario modificarlo.

---

## 2. Se agregó registro formal del plan activo en Prisma

Archivo modificado:

- prisma/schema.prisma

Se agregaron campos en el modelo UserState:

activePlan       String? // mensual | 3-meses | anual | manual | manual-30 | manual-90 | manual-365
activePlanSource String? // activation-request | manual-extension | promo | admin

La sección quedó conceptualmente así:

// full / licencia activa
fullStartedAt DateTime?
fullEndsAt    DateTime?
activePlan       String? // mensual | 3-meses | anual | manual
activePlanSource String? // activation-request | manual-extension | promo | admin

Migración aplicada correctamente:

npx prisma migrate dev --name add-active-plan-fields

Migración creada:

prisma/migrations/20260526024220_add_active_plan_fields/migration.sql

Prisma confirmó:

Your database is now in sync with your schema.

También se ejecutó:

npx prisma generate

para regenerar Prisma Client.

---

## 3. Activación desde solicitudes ahora guarda plan activo

Archivo modificado:

- app/api/admin/activation-requests/update-status/route.ts

Cambio realizado:

Cuando una solicitud pasa a:

activated

ahora UserState guarda:

activePlan: existing.plan,
activePlanSource: "activation-request",

Se agregó tanto en create como en update del upsert.

Ejemplo de lógica actual:

create: {
  id: existing.deviceId,
  trialStartedAt: now,
  trialEndsAt: now,
  licenseStatus: "active",
  fullStartedAt: now,
  fullEndsAt: addDaysExact(now, existing.duration),
  activePlan: existing.plan,
  activePlanSource: "activation-request",
  phoneE164: existing.phone,
}

update: {
  licenseStatus: "active",
  fullStartedAt: now,
  fullEndsAt: addDaysExact(now, existing.duration),
  activePlan: existing.plan,
  activePlanSource: "activation-request",
  phoneE164: existing.phone,
}

---

## 4. Se corrigió error de build en /pago/activar

Archivo modificado:

- app/pago/activar/page.tsx

Error que apareció:

useSearchParams() should be wrapped in a suspense boundary at page "/pago/activar"

Solución aplicada:

Se separó la página en:

- PagoActivarPage: componente principal con Suspense
- PagoActivarContent: contenido real que usa useSearchParams
- PagoActivarFallback: estado de carga

Resultado:

npm run build pasó correctamente.

---

## 5. API de usuarios ahora devuelve plan activo

Archivo modificado:

- app/api/admin/users/route.ts

Se agregaron los campos en el objeto que devuelve cada usuario:

activePlan: user.activePlan,
activePlanSource: user.activePlanSource,

Ahora /api/admin/users devuelve:

- id
- licenseStatus
- licenseLabel
- phoneE164
- trialStartedAt
- trialEndsAt
- fullStartedAt
- fullEndsAt
- activePlan
- activePlanSource
- lastMsgAt
- totalMsgCount
- dailyMsgDate
- dailyMsgCount
- createdAt
- updatedAt
- y otros campos clínicos/conversacionales ya existentes

Build aprobado.

---

## 6. /admin/usuarios ahora muestra columna Plan

Archivo modificado:

- app/admin/usuarios/page.tsx

Se agregó en el tipo AdminUser:

activePlan: string | null;
activePlanSource: string | null;

Se agregaron funciones:

function getPlanLabel(plan: string | null) {
  if (plan === "mensual") return "Mensual";
  if (plan === "3-meses") return "3 meses";
  if (plan === "anual") return "Anual";
  if (plan === "manual") return "Manual";
  if (plan === "manual-30") return "30 días";
  if (plan === "manual-90") return "90 días";
  if (plan === "manual-365") return "365 días";
  return "—";
}

function getPlanSourceLabel(source: string | null) {
  if (source === "activation-request") return "Solicitud";
  if (source === "manual-extension") return "Extensión manual";
  if (source === "promo") return "Promoción";
  if (source === "admin") return "Admin";
  return "—";
}

La tabla ahora queda con columnas:

Usuario
Licencia
Plan
Celular
Trial vence
Plan vence
Mensajes
Último uso
Acciones

Se corrigió una confusión visual donde inicialmente parecía que Celular y Plan estaban desalineados.

Se ajustó el diseño para mejor lectura:

- tableStyle con minWidth: 1240
- planTitleStyle
- planSourceStyle
- actionsCellStyle con minWidth: 300

Resultado visual validado:

La tabla ya muestra correctamente:

Licencia | Plan | Celular

Para usuarios antiguos sin activePlan aparece:

—
—

Eso es normal.

---

## 7. Extensión manual ahora guarda el tipo de plan manual por duración

Archivo modificado:

- app/api/admin/users/extend-license/route.ts

Primero se había agregado:

activePlan: "manual",
activePlanSource: "manual-extension",

Luego se decidió mejorar para control comercial, ya que el usuario quiere saber si la extensión manual fue de 30, 90 o 365 días.

Cambio final aplicado:

activePlan:
  days === 30 ? "manual-30" : days === 90 ? "manual-90" : "manual-365",
activePlanSource: "manual-extension",

Así, cuando se presiona desde /admin/usuarios:

+30 días => activePlan = manual-30
+90 días => activePlan = manual-90
+365 días => activePlan = manual-365

Y en la tabla se debe mostrar:

30 días
Extensión manual

90 días
Extensión manual

365 días
Extensión manual

---

# Pruebas realizadas

## Build

Se ejecutó varias veces:

npm run build

Resultados correctos:

✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization

Rutas visibles en build:

/admin/activaciones
/admin/usuarios
/api/activation-request
/api/admin/activation-requests
/api/admin/activation-requests/update-status
/api/admin/users
/api/admin/users/extend-license
/api/admin/users/update-license
/pago
/pago/3-meses
/pago/activar
/pago/anual
/pago/mensual
/chat
/onboarding

---

## Prueba visual admin usuarios

Se abrió:

http://localhost:3000/admin/usuarios

La tabla mostró correctamente:

Usuario | Licencia | Plan | Celular | Trial vence | Plan vence | Mensajes | Último uso | Acciones

Se verificó que al extender manualmente el acceso, AIDA cambia a versión completa en el chat.

---

## Prueba en chat

Se probó el estado del usuario en /chat:

Antes de reactivar:

Modo: Prueba (7 día(s) restantes)

Después de extender manualmente:

Modo: Versión completa (30 día(s) restantes)

Esto confirma que el flujo de licencia activa sigue funcionando.

---

# Incidente encontrado y resuelto

Al probar +30 días apareció un error en dev:

Unknown argument `activePlan`

Causa:

El servidor local seguía usando Prisma Client anterior.

Solución:

1. Detener servidor local con Ctrl + C.
2. Ejecutar:

npx prisma generate

3. Reiniciar:

npm run dev

Después de eso, la extensión manual funcionó.

---

# Commits realizados durante este bloque

Se hicieron commits parciales:

1. Track active plan on license activation
2. Show active plan in admin users

Al final del bloque se solicitó actualizar GitHub nuevamente después del ajuste de manual-30/manual-90/manual-365.

Commit sugerido para el último ajuste:

Track manual license plan duration

Comandos sugeridos:

git status
git add .
git commit -m "Track manual license plan duration"
git push

---

# Estado actual del proyecto

Funcional:

1. Panel admin protegido.
2. Panel de activaciones protegido.
3. Panel de usuarios protegido.
4. Listado general de usuarios.
5. Extender licencia manualmente por 30, 90 o 365 días.
6. Cancelar licencia.
7. Reiniciar trial.
8. Guardar activePlan y activePlanSource cuando el acceso se activa desde solicitud.
9. Guardar activePlan y activePlanSource cuando el acceso se extiende manualmente.
10. Mostrar columna Plan en /admin/usuarios.
11. /pago/activar corregido con Suspense.
12. Build aprobado.
13. Chat reconoce correctamente modo prueba y modo versión completa.

---

# Nota importante sobre interpretación del campo Plan

En /admin/usuarios:

Si el plan viene de solicitud de activación:

activePlan puede ser:

mensual
3-meses
anual

activePlanSource será:

activation-request

La tabla muestra:

Mensual / Solicitud
3 meses / Solicitud
Anual / Solicitud

Si el plan viene de extensión manual:

activePlan puede ser:

manual-30
manual-90
manual-365

activePlanSource será:

manual-extension

La tabla muestra:

30 días / Extensión manual
90 días / Extensión manual
365 días / Extensión manual

Si el usuario fue creado antes de estos campos:

activePlan = null
activePlanSource = null

La tabla muestra:

—
—

---

# Pendientes recomendados para continuar

## Pendiente 1 — Validar último ajuste visual

Después de commitear y hacer push, probar nuevamente:

1. Reiniciar trial de un usuario.
2. Confirmar que el chat muestra Modo: Prueba.
3. Extender +30 días.
4. Confirmar que /admin/usuarios muestra:

30 días
Extensión manual

5. Confirmar que /chat muestra:

Modo: Versión completa (30 día(s) restantes)

---

## Pendiente 2 — Revisar update-license para limpiar plan al cancelar o reiniciar trial

Archivo:

app/api/admin/users/update-license/route.ts

Recomendación:

Cuando se cancele licencia:

licenseStatus = expired
fullEndsAt = now
activePlan = null
activePlanSource = null

Cuando se reinicie trial:

licenseStatus = trial
trialStartedAt = now
trialEndsAt = now + 7 días
fullStartedAt = null
fullEndsAt = null
activePlan = null
activePlanSource = null
dailyMsgDate = null
dailyMsgCount = 0

Esto evitará que un usuario en trial siga mostrando un plan viejo como “Manual / Extensión manual”.

Importante:

Este pendiente se detectó porque al cancelar licencia y reiniciar trial, el chat sí volvió a modo prueba, pero en /admin/usuarios podía seguir apareciendo información de plan manual anterior hasta que se limpiaran los campos.

---

## Pendiente 3 — Historial de movimientos de licencia

Crear futura tabla:

LicenseEvent

Campos sugeridos:

id
userId
action
days
previousStatus
newStatus
previousFullEndsAt
newFullEndsAt
previousPlan
newPlan
source
createdAt
adminNote

Servirá para auditoría y control comercial.

---

## Pendiente 4 — Página detalle por usuario

Crear ruta:

/admin/usuarios/[id]

Para ver:

Datos de licencia
Historial de uso
Historial de lecturas
Historial de pagos / activaciones
Historial de movimientos admin

---

## Pendiente 5 — Botones comerciales futuros

Desde /admin/usuarios agregar:

Ofrecer upgrade a 3 meses
Ofrecer upgrade anual
Copiar mensaje de WhatsApp
Ver usuario detalle
Ver historial de licencia

---

## Pendiente 6 — Conectar pagos reales

Opciones futuras:

Mercado Pago
Stripe
PayPal
Transferencia validada manualmente

Por ahora el flujo sigue siendo manual.

---

# Recomendación para iniciar el siguiente chat

Continuamos desde el contexto actualizado de AIDA. Ya agregamos activePlan y activePlanSource al modelo UserState, a la activación desde solicitudes, a la extensión manual y a la tabla de /admin/usuarios. El siguiente pendiente recomendado es limpiar activePlan y activePlanSource cuando se cancela licencia o se reinicia trial en app/api/admin/users/update-license/route.ts.

