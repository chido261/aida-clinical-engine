---

## 16) Actualización – Personalización, seguimiento y respuestas contextuales

**Actualizado: 10 May 2026**

Se avanzó en personalización, seguimiento persistente y calidad de respuesta conversacional en modo local, sobre la rama `dev`.

### Archivos trabajados

```txt
app/api/chat/route.ts
app/api/chat-welcome/route.ts
app/lib/aidaRules.ts
```

### Commit realizado

```txt
0c13cf8 - Improve contextual follow-ups and glucose responses
```

### Mejoras implementadas

#### 1. Saludo de reingreso con prioridad clínica

Se mejoró `/api/chat-welcome` para que al abrir la app no dependa solo de la última lectura, sino que priorice seguimientos pendientes cuando existan.

Ahora puede recordar y saludar según:

```txt
HYPO_RECHECK_15MIN
HYPO_STABILITY_RECHECK
POSTMEAL_WALK_RECHECK
```

Ejemplos de reingreso:

```txt
Hace un rato registraste una glucosa baja y quedamos en volver a medir después del protocolo 15-15.
Antes de seguir, dime cuánto marca tu glucosa ahora.
```

```txt
Hace un rato subiste después de una glucosa baja. Quiero confirmar que sigas estable.
Dime cómo te sientes y cuánto marca tu glucosa ahora.
```

```txt
Hace un rato tu lectura postcomida quedó un poco alta y te recomendé caminar 10–15 minutos para ayudar a bajarla.
¿Ya caminaste? Si ya te mediste de nuevo, dime cuánto marca ahora.
```

---

#### 2. Memoria persistente ampliada en `UserState`

Ya se está usando seguimiento persistente con los campos:

```txt
lastEventType
lastEventAt
pendingFollowUpType
pendingFollowUpAt
lastRecommendation
```

Esto permite que AIDA conserve contexto entre aperturas de la app.

---

#### 3. Seguimiento completo de hipoglucemia

Flujo ya probado:

```txt
58 mg/dL  → HYPO_ACTIVE
78 mg/dL  → RECOVERING_FROM_HYPO
95 mg/dL  → cierre correcto del episodio
```

Mejoras logradas:

* Si el usuario presenta hipo, se guarda:

  * `lastEventType: HYPOGLYCEMIA`
  * `pendingFollowUpType: HYPO_RECHECK_15MIN`

* Si el usuario sube pero aún no está estable:

  * `lastEventType: HYPOGLYCEMIA_RECOVERY`
  * `pendingFollowUpType: HYPO_STABILITY_RECHECK`

* Si confirma nueva lectura estable `>=90 mg/dL` después de recuperación:

  * se cierra correctamente el episodio;
  * se limpia `pendingFollowUpType`;
  * ya no reaparece el seguimiento al recargar.

Respuesta implementada al cierre:

```txt
Perfecto, 95 ya es una lectura estable después de la baja.
Con esto cerramos el seguimiento de la hipoglucemia por ahora.
Mantén una comida estable y evita dejar pasar muchas horas sin comer.
Si vuelves a sentir temblor, sudor frío, debilidad o mareo, mídete de nuevo y me dices.
```

---

#### 4. Mejor respuesta ante recuperación de hipo sin glucómetro

Si el usuario está en recuperación y dice que:

* no trae glucómetro;
* se siente bien;
* ya comió para estabilizarse;

AIDA ya responde con contexto y no insiste de forma rígida.

---

#### 5. Mejora de respuestas normales

Se mejoraron respuestas determinísticas para:

### Ayuno alto

Ejemplo:

```txt
Amanecer en 165 significa que hoy conviene empezar con un desayuno muy estable para no seguir empujando la glucosa hacia arriba.
Hazlo con proteína + grasa + vegetales, sin pan, fruta, jugos ni harinas por ahora.
También vale la pena revisar qué cenaste ayer, porque muchas veces el ayuno alto se empieza a construir desde la noche anterior.
¿Quieres que te dé 3 opciones de desayuno para hoy?
```

### Postcomida ligeramente alta

Ejemplo:

```txt
168 a las 2 horas después de comer está un poco por arriba de lo que buscamos.
Lo más útil ahora es caminar 10–15 minutos y tomar agua para ayudar a que el músculo use parte de esa glucosa.
Después podemos revisar qué hubo en ese plato, porque ahí suele estar la clave para que la siguiente comida responda mejor.
¿Quieres decirme qué comiste y lo revisamos juntos?
```

### Noche alta

Ejemplo:

```txt
Llegar a la noche en 135 indica que conviene cerrar el día sin agregar más carga de comida.
Si ya cenaste, evita comer de nuevo. Si todavía necesitas cenar, por ahora omite carbohidratos y enfócate solo en proteína y grasas saludables.
Mañana, con tu lectura en ayunas, podremos ver si la cena de hoy te ayudó o si hay algo que ajustar.
Descansa, y cuando despiertes me compartes cómo amaneciste.
```

---

#### 6. Seguimiento de postcomida alta con caminata

Nuevo flujo probado:

```txt
168 mg/dL 2h postcomida
→ AIDA recomienda caminar 10–15 min
→ al reingresar recuerda el seguimiento
→ usuario reporta 135 después de caminar
→ AIDA cierra el seguimiento
```

Respuesta implementada al cierre:

```txt
Perfecto, bajar de 168 a 135 después de caminar muestra que tu cuerpo sí respondió bien al movimiento.
Estas experiencias ayudan a aprender qué le funciona a tu glucosa.
En tu próxima comida, recuerda asegurar el balance del plato para buscar una respuesta más estable desde el inicio.
Sabes que cuentas conmigo para cualquier duda.
```

También se corrigió que la re-medición posterior a una caminata postcomida ya se guarde como:

```txt
POSTCOMIDA
```

y no como:

```txt
DESCONOCIDO
```

---

#### 7. Revisión contextual de plato después de postcomida alta

Se agregó contexto activo:

```txt
POSTMEAL_PLATE_REVIEW
```

Cuando AIDA pregunta qué comió el usuario después de una postcomida elevada y el usuario responde con alimentos, el prompt ahora entiende que debe:

* revisar esa comida específica;
* identificar qué parte pudo elevar más la glucosa;
* reconocer lo que sí estuvo bien;
* explicar cómo ajustar la siguiente comida;
* no saltar de forma genérica a hablar del ayuno del día siguiente.

Ejemplo probado:

```txt
Comí pechuga de pollo, medio aguacate y una papa cocida.
```

AIDA ya respondió centrada en el plato y no se desvió al ayuno.

---

#### 8. Saludo de reingreso mejorado para noche anterior

Si la última lectura fue de noche y el usuario abre AIDA a la mañana siguiente, queda preparado el saludo:

```txt
Ayer cerraste el día en 135 mg/dL antes de dormir.
Cuando tengas tu lectura en ayunas de hoy, compártemela y vemos cómo respondió tu cuerpo durante la noche.
```

---

### Pendientes acordados

No se implementarán todavía las consultas de historial/progreso como:

```txt
¿Cuántos episodios de hipoglucemia has registrado en los últimos 10 días?
¿Cuándo fue la última vez que registré una hipoglucemia?
¿Qué días he estado por debajo de 100 en ayunas?
¿Cuántos días llevo en niveles estables?
```

Razón:

Estas consultas ya se relacionan con:

* progresión clínica;
* criterios de estabilidad;
* cambio de fase;
* protocolos de alimentos;
* posible necesidad de tabla adicional de episodios/progreso.

Se acordó posponerlas hasta definir formalmente:

```txt
protocolos por fase
reglas para brincar al siguiente nivel
criterios de estabilidad
estructura de historial clínico
```

---

### Próximo objetivo recomendado

Al continuar:

```txt
Revisar protocolos de alimentos y criterios de cambio de fase antes de construir consultas de historial/progreso.
```

---

## 17) Actualización – Fase de licencias, pagos visuales y activaciones locales

**Actualizado: 19 May 2026**

Se avanzó en la fase de licencias de AIDA para preparar el producto para venta. El trabajo se realizó en modo local, cuidando que posteriormente pueda subirse a nube y quedar funcional sin rehacer la lógica principal.

### Objetivo trabajado

Preparar el flujo comercial inicial:

```txt
Usuario nuevo → onboarding → trial 7 días → prueba vencida → paywall → página de planes → solicitud de activación → panel admin → activar acceso real
```

Se dejó pendiente la integración con pasarela de pago real y envío automático de código por celular.

---

### Decisiones tomadas

Por ahora se definieron estas modalidades:

```txt
$500 MXN  → pago mensual / 30 días
$1,500 MXN → pago por 3 meses / 90 días
$3,000 MXN → pago anual / 365 días
```

La ventana de prueba vencida no debe vender un plan específico, sino mandar a:

```txt
Activar versión completa
```

y desde ahí el usuario elige modalidad de pago.

---

### Archivos modificados

```txt
app/lib/runtimeConfig.ts
app/lib/aidaMemory.ts
app/api/chat/route.ts
app/chat/page.tsx
prisma/schema.prisma
app/pago/page.tsx
app/pago/mensual/page.tsx
app/pago/3-meses/page.tsx
app/pago/anual/page.tsx
app/pago/activar/page.tsx
app/api/activation-request/route.ts
app/api/admin/activation-requests/route.ts
app/admin/activaciones/page.tsx
app/api/admin/activation-requests/update-status/route.ts
```

---

### 1. Modo local para probar licencias

Se agregó en `app/lib/runtimeConfig.ts` una bandera para poder probar licencias en local:

```ts
export const licenseTestMode =
  process.env.AIDA_LICENSE_TEST_MODE === "true";

export const shouldBypassLicense =
  isLocal && !licenseTestMode;
```

Uso esperado en `.env.local`:

```env
APP_MODE=local
AIDA_LICENSE_TEST_MODE=true
AIDA_BILLING_URL=/pago
```

Con esto:

```txt
Local normal → sin paywall, útil para desarrollo clínico.
Local test mode → permite probar trial, expired, full y paywall.
```

---

### 2. Ajuste de memoria/licencias

En `app/lib/aidaMemory.ts` se cambió la lógica para que el bypass local dependa de:

```ts
shouldBypassLicense
```

y no directamente de `isLocal`.

Se conserva:

```txt
TRIAL_DAYS = 7
DAILY_LIMIT_TRIAL = 50
FULL_DAYS = 90
MAINTENANCE_DAYS = 30
RETENTION_DAYS_AFTER_EXPIRED = 7
```

Ahora local puede comportarse como nube cuando `AIDA_LICENSE_TEST_MODE=true`.

---

### 3. Paywall funcional en local test mode

En `app/api/chat/route.ts` se ajustó `buildUI()` para que el modo no se quede siempre en:

```txt
LOCAL
```

cuando está activo `AIDA_LICENSE_TEST_MODE=true`.

Ahora puede mostrar:

```txt
Modo: Prueba (7 día(s) restantes)
Modo: Prueba finalizada
Modo: Versión completa
Modo: Mantenimiento
```

También se ajustó:

```ts
if (!shouldBypassLicense && isTrialExpired(userState))
```

para que el paywall también pueda probarse en local test mode.

---

### 4. Frontend del chat y paywall

En `app/chat/page.tsx` se eliminó el comportamiento anterior que ignoraba el 402 en local:

```txt
(DEV) El backend respondió 402, pero en LOCAL ignoramos el paywall
```

Se agregó lógica:

```ts
const licenseModeActive = ui?.mode !== "LOCAL";
const chatLocked = licenseModeActive && (ui?.blocked === true || !!paywall);
```

Ahora cuando el backend responde 402:

* se muestra modal de paywall;
* el chat queda bloqueado;
* el input muestra que la prueba terminó;
* aparece un botón persistente para activar versión completa aunque se cierre el modal.

Texto del paywall definido:

```txt
Tu prueba gratuita terminó
Gracias por usar la versión de prueba de AIDA. Para continuar, activa la versión completa y elige la modalidad de pago que mejor se adapte a ti.
Botón: Activar versión completa
```

Leyenda final para usuario:

```txt
Tu acceso se activará en el dispositivo y número de celular que registres.
```

---

### 5. Página visual de pagos

Se creó:

```txt
app/pago/page.tsx
```

Ruta:

```txt
/pago
```

Muestra las tres modalidades:

```txt
Pago mensual       $500 MXN / mes
Pago por 3 meses   $1,500 MXN / 90 días
Pago anual         $3,000 MXN / año
```

El plan de 3 meses aparece como recomendado.

---

### 6. Páginas por plan

Se crearon:

```txt
app/pago/mensual/page.tsx
app/pago/3-meses/page.tsx
app/pago/anual/page.tsx
```

Rutas:

```txt
/pago/mensual
/pago/3-meses
/pago/anual
```

Cada una muestra:

* plan seleccionado;
* precio;
* duración;
* qué incluye;
* botón `Solicitar activación`;
* botón `Volver a planes`.

Los botones de activación apuntan a ruta única:

```txt
/pago/activar?plan=mensual
/pago/activar?plan=3-meses
/pago/activar?plan=anual
```

---

### 7. Página única de solicitud de activación

Se creó:

```txt
app/pago/activar/page.tsx
```

Ruta:

```txt
/pago/activar?plan=3-meses
```

Función actual:

* lee el plan desde query param;
* muestra precio y duración;
* captura nombre completo;
* captura celular;
* usa `getDeviceId()`;
* envía solicitud a `/api/activation-request`;
* muestra confirmación con folio.

Ejemplo probado:

```txt
Nombre: David Rodriguez
Celular: 4531234567
Plan: 3 meses — $1,500 MXN
Folio: #1
```

---

### 8. Base de datos: ActivationRequest

Se modificó:

```txt
prisma/schema.prisma
```

Se agregó modelo:

```prisma
model ActivationRequest {
  id        Int      @id @default(autoincrement())
  deviceId  String
  name      String
  phone     String
  plan      String   // mensual | 3-meses | anual
  price     Int      // 500 | 1500 | 3000
  duration  Int      // días: 30 | 90 | 365
  status    String   @default("pending") // pending | paid | activated | cancelled

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([deviceId])
  @@index([phone])
  @@index([status])
}
```

Comando ejecutado:

```bash
npx prisma migrate dev --name add_activation_request
```

Después hubo un error de TypeScript:

```txt
Property 'activationRequest' does not exist on type PrismaClient
```

Se resolvió con:

```bash
npx prisma generate
```

y reiniciando el TS Server en Cursor.

---

### 9. API para guardar solicitudes

Se creó:

```txt
app/api/activation-request/route.ts
```

Método:

```txt
POST /api/activation-request
```

Recibe:

```json
{
  "deviceId": "...",
  "name": "David Rodriguez",
  "phone": "4531234567",
  "plan": "3-meses"
}
```

Guarda:

```txt
status = pending
price según plan
duration según plan
```

Configuración:

```txt
mensual  → price 500, duration 30
3-meses  → price 1500, duration 90
anual    → price 3000, duration 365
```

---

### 10. Panel admin de activaciones

Se creó API de listado:

```txt
app/api/admin/activation-requests/route.ts
```

Ruta:

```txt
GET /api/admin/activation-requests
```

Devuelve las últimas 100 solicitudes.

Se creó pantalla admin:

```txt
app/admin/activaciones/page.tsx
```

Ruta:

```txt
/admin/activaciones
```

Muestra:

```txt
Total solicitudes
Pendientes
Activadas
Folio
Nombre
Celular
Plan
Precio
Duración
Estado
Fecha
Acciones
```

---

### 11. Cambio de estado desde panel admin

Se creó:

```txt
app/api/admin/activation-requests/update-status/route.ts
```

Ruta:

```txt
POST /api/admin/activation-requests/update-status
```

Estados permitidos:

```txt
pending
paid
activated
cancelled
```

El panel permite:

```txt
Pendiente → Marcar pagado / Cancelar
Pagado → Activar acceso / Cancelar
Activado → muestra Activo
Cancelado → muestra Cancelado
```

Flujo probado:

```txt
Pendiente → Pagado → Activado
```

---

### 12. Activación real de acceso

Se ajustó `update-status/route.ts` para que al pasar una solicitud a:

```txt
activated
```

no solo cambie el estado de `ActivationRequest`, sino que también active el acceso en `UserState`.

Acciones realizadas al activar:

```txt
UserState.licenseStatus = active
UserState.fullStartedAt = fecha actual
UserState.fullEndsAt = fecha actual + duration del plan
UserState.phoneE164 = teléfono registrado
```

Implementado con transacción Prisma:

```ts
await prisma.$transaction(async (tx) => {
  // actualizar ActivationRequest
  // upsert UserState con licenseStatus active
});
```

Prueba confirmada:

Después de activar desde admin, AIDA pasó de prueba vencida a:

```txt
Modo: Versión completa
```

---

### 13. Días restantes en versión completa

Se solicitó que AIDA no solo diga:

```txt
Modo: Versión completa
```

sino también los días restantes del plan.

Ajuste recomendado/realizado en `app/api/chat/route.ts`:

Importar:

```ts
getWindowInfo
```

Desde:

```ts
@app/lib/aidaMemory
```

Y en `buildUI()` para estado `active` usar:

```ts
const info = getWindowInfo(userState);
const daysRemaining = info.daysRemaining ?? null;

modeLabel:
  daysRemaining != null
    ? `Modo: Versión completa (${daysRemaining} día(s) restantes)`
    : "Modo: Versión completa"
```

También se recomendó aplicar lógica similar a `maintenance`:

```txt
Modo: Mantenimiento (X día(s) restantes)
```

---

### Estado final probado

Funcionan correctamente en local test mode:

```txt
Trial de 7 días
Prueba vencida
Paywall modal
Botón persistente de activación
/pago con tres planes
/pago/mensual
/pago/3-meses
/pago/anual
/pago/activar?plan=...
Solicitud guardada con folio
/admin/activaciones
Marcar pagado
Activar acceso
Activación real de UserState
```

---

### Pendientes siguientes

1. Confirmar visualmente que `Modo: Versión completa (X día(s) restantes)` ya aparece después del ajuste.
2. Crear protección básica para rutas admin, porque actualmente `/admin/activaciones` queda abierta.
3. Agregar opción para limpiar/cancelar solicitudes viejas.
4. Agregar generación de código único de activación.
5. Ligar código de activación con número de celular.
6. Preparar flujo futuro de pago real.
7. Crear panel más completo de usuarios:

```txt
Lista de usuarios
Estado de licencia
Plan activo
Fecha inicio
Fecha fin
Celular
Último uso
Botones: extender, cancelar, eliminar, limpiar prueba
```

8. Definir lógica futura para cambio de dispositivo/revocación de licencia.

---

### Comandos útiles

```bash
npx prisma migrate dev --name add_activation_request
npx prisma generate
npm run dev
```

Para probar licencias localmente:

```env
APP_MODE=local
AIDA_LICENSE_TEST_MODE=true
AIDA_BILLING_URL=/pago
```

Para crear usuario nuevo en local:

```txt
Borrar localStorage:
aida_device_id_v1
glucosa_onboarding_v1
```

