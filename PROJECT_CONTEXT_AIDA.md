CONTEXTO ACTUALIZADO — AIDA
Fecha: 26 mayo 2026
Proyecto: AIDA / aida-clinical-engine
Dominio producción: bajatuglucosa.com
Repositorio: chido261/aida-clinical-engine

FORMA DE TRABAJO ACORDADA

1. Avanzar un objetivo a la vez.
2. Trabajar un archivo a la vez cuando sea posible.
3. Pedir o revisar el archivo real antes de modificar.
4. Si el archivo ya cambió localmente, actualizar GitHub o pegar el archivo actual antes de pedir código final.
5. Cuando se modifique código, entregar preferentemente el archivo completo para copiar y pegar.
6. No alterar lo ya funcional; solo modificar lo necesario.
7. Después de cada cambio, ejecutar build y hacer una prueba concreta.
8. Después de cada bloque funcional, hacer commit y push.
9. No dar explicaciones largas ni redundantes.
10. Mantener modo productivo: acciones claras y pruebas específicas.

ESTADO ACTUAL FUNCIONAL

1. La app ya está desplegada en producción en Vercel.
2. El deployment quedó en estado Ready / Production / Current.
3. El dominio bajatuglucosa.com ya abre la app.
4. El chat en producción ya consulta el estado real de licencia.
5. Cuando el usuario está expirado, el badge muestra: Plan cancelado o prueba finalizada.
6. Cuando el usuario está en prueba, el badge muestra: Prueba (7 día(s) restantes).
7. Cuando el usuario tiene licencia completa, debe mostrar: Versión completa (X día(s) restantes).
8. El bloqueo del chat por plan cancelado funciona correctamente.
9. El campo de texto cambia a: Tu prueba terminó.
10. El panel /admin/usuarios ya permite acceso en producción después de configurar AIDA_ADMIN_KEY en Vercel.

BLOQUE TRABAJADO Y CERRADO

1. Limpieza de plan al cancelar o reiniciar trial

Archivo modificado:
- app/api/admin/users/update-license/route.ts

Cambio aplicado:
Cuando se cancela licencia:
- licenseStatus = expired
- fullEndsAt = now
- activePlan = null
- activePlanSource = null

Cuando se reinicia trial:
- licenseStatus = trial
- trialStartedAt = now
- trialEndsAt = now + 7 días
- fullStartedAt = null
- fullEndsAt = null
- activePlan = null
- activePlanSource = null
- dailyMsgDate = null
- dailyMsgCount = 0

Resultado:
El usuario ya no conserva un plan viejo como 30 días / Extensión manual cuando se reinicia trial o se cancela licencia.

2. Creación de API para estado de usuario

Archivo creado:
- app/api/user-status/route.ts

Función:
Recibe deviceId y devuelve ui con:
- mode
- modeLabel
- daysLeft
- daysRemaining
- blocked
- ctaText
- ctaUrl
- disclaimer

Esta API permite que el chat conozca el estado del plan desde que se abre, sin esperar a que el usuario mande un mensaje.

3. Chat muestra estado real del plan desde el inicio

Archivo modificado:
- app/chat/page.tsx

Cambio aplicado:
Se agregó carga inicial de /api/user-status cuando existe deviceId.

Resultado visual:
Antes decía: Modo: Desarrollo (Local).
Ahora muestra solo el estado real del plan, por ejemplo:
- Prueba (7 día(s) restantes)
- Versión completa (30 día(s) restantes)
- Plan cancelado o prueba finalizada

4. Log temporal eliminado

Archivo modificado:
- app/chat/page.tsx

Se eliminó:
console.log("AIDA USER STATUS UI:", data.ui);

5. Corrección de deploy en Vercel

Problema detectado:
Vercel fallaba con:
Property 'activationRequest' does not exist on type PrismaClient

Causa:
Vercel usa prisma/schema.postgres.prisma, y ese archivo estaba desactualizado.

Archivo corregido:
- prisma/schema.postgres.prisma

Se sincronizó con schema.prisma agregando:
- UserState.activePlan
- UserState.activePlanSource
- model ActivationRequest

Commit realizado:
Sync postgres Prisma schema with local schema

6. Sincronización de Neon/Postgres

Problema detectado en producción:
The column UserState.activePlan does not exist in the current database.

Solución aplicada desde PowerShell:
$env:PRISMA_ENV="production"; npx prisma db push --schema=prisma/schema.postgres.prisma

Resultado:
Your database is now in sync with your Prisma schema.

Esto actualizó la base real de producción en Neon/Postgres.

7. Variable de entorno admin en Vercel

Problema:
/admin/usuarios rechazaba la clave.

Causa probable:
AIDA_ADMIN_KEY no estaba configurada o no estaba disponible en Production.

Solución:
Configurar en Vercel:
- Environment Variable: AIDA_ADMIN_KEY
- Environment: Production
- Valor: misma clave admin usada en local

Después se hizo redeploy.

Resultado:
El acceso a /admin/usuarios ya funciona en producción.

ESTADO DEL PANEL ADMIN EN PRODUCCIÓN

Ruta:
https://bajatuglucosa.com/admin/usuarios

Estado actual observado:
El panel carga correctamente y muestra usuarios.

Problema funcional detectado:
En la tabla aparecen muchos usuarios identificados solo por deviceId corto, por ejemplo:
- d31c1e34...
- df6e2c51...
- dbb7dc31...

No es claro cuál dispositivo pertenece a qué persona.

Esto se resolverá en el próximo bloque vinculando usuarios con número celular.

PENDIENTES PRINCIPALES PARA LA PRÓXIMA SESIÓN

PENDIENTE 1 — Configurar pagos reales

Objetivo:
Que los planes se activen automáticamente sin intervención manual.

Métodos de pago deseados:
- Tarjeta de crédito
- Tarjeta de débito
- Transferencia
- Depósito

Posibles integraciones a revisar:
- Mercado Pago
- Stripe
- PayPal
- Transferencia/deposito con validación automática o semiautomática

Requisito funcional:
Al confirmarse el pago, la licencia debe activarse automáticamente según el plan:
- mensual
- 3 meses
- anual

El sistema debe generar o guardar un código de activación asociado al usuario, al teléfono, al dispositivo y al plan.

PENDIENTE 2 — Vincular registros con número de celular

Objetivo:
Que cada usuario de AIDA quede identificado por un número de celular real y no solo por deviceId.

Flujo deseado:
1. El usuario llena el formulario inicial.
2. Para usar el chat de AIDA, introduce un número de celular real.
3. Recibe un código de activación o verificación.
4. El código queda vinculado a:
   - número de celular
   - deviceId actual
   - usuario
   - estado de licencia
5. El chat solo se habilita si el número/código está validado.

PENDIENTE 3 — Control de dispositivo por número/código

Regla deseada:
Si una persona comparte su código y se introduce en otro dispositivo:

1. AIDA debe detectar que el código ya está vinculado a otro deviceId.
2. Debe mostrar un mensaje similar a:
   “Este código ya está activo en otro dispositivo. Si continúas, AIDA se desactivará en el dispositivo anterior. ¿Deseas continuar?”
3. Si acepta:
   - Se activa AIDA en el nuevo dispositivo.
   - Se desactiva el acceso en el dispositivo anterior.
   - Se actualiza el deviceId asociado al número/código.

PENDIENTE 4 — Código de activación visible para administrador

Objetivo:
El administrador debe poder ver el código asociado a cada usuario para aclaraciones futuras.

El panel /admin/usuarios deberá mostrar o permitir ver:
- nombre
- celular
- deviceId actual
- plan activo
- estado de licencia
- fecha de inicio
- fecha de vencimiento
- código de activación/verificación
- origen de activación: pago automático, extensión manual, promo, solicitud manual

PENDIENTE 5 — Mejorar identificación de usuarios en /admin/usuarios

Problema actual:
No se sabe claramente qué usuario corresponde a qué persona o dispositivo.

Solución futura:
Agregar columnas como:
- Nombre
- Celular
- Código
- Último dispositivo activo
- Estado de verificación

Esto debe hacerse después de definir el flujo de celular/código.

IDEA DE MODELOS FUTUROS

Posibles campos nuevos en UserState:
- name
- phoneE164
- phoneVerifiedAt
- activeDeviceId
- activationCode
- activationCodeCreatedAt
- activationCodeUsedAt
- lastDeviceChangeAt
- previousDeviceId

Posibles modelos nuevos:

model PhoneVerificationCode
- id
- phoneE164
- code
- purpose // onboarding | login | device-change | payment-activation
- expiresAt
- usedAt
- createdAt

model LicenseEvent
- id
- userId
- action
- previousStatus
- newStatus
- previousPlan
- newPlan
- previousFullEndsAt
- newFullEndsAt
- source
- activationCode
- paymentProvider
- paymentReference
- createdAt
- adminNote

model Payment
- id
- userId
- phoneE164
- provider // mercado-pago | stripe | paypal | manual
- providerPaymentId
- method // credit_card | debit_card | transfer | cash_deposit
- plan
- amount
- currency
- status // pending | paid | failed | refunded
- activationCode
- createdAt
- paidAt

NOTAS IMPORTANTES

1. No mezclar pagos reales con verificación celular hasta definir bien el flujo.
2. El siguiente bloque debe iniciar diseñando primero el flujo, luego los modelos, luego endpoints, luego UI.
3. No iniciar código sin decidir si el proveedor principal será Mercado Pago, Stripe u otro.
4. Para México, Mercado Pago puede ser una opción fuerte porque permite tarjeta, transferencia y pagos en efectivo/deposito según configuración.
5. Se debe verificar documentación actual del proveedor de pagos antes de implementar.
6. Se debe mantener la activación manual actual como respaldo administrativo.

COMANDOS IMPORTANTES USADOS

Build local:
npm run build

Desarrollo local:
npm run dev

Git:
git status
git add .
git commit -m "mensaje"
git push

Sincronizar DB producción Neon/Postgres:
$env:PRISMA_ENV="production"; npx prisma db push --schema=prisma/schema.postgres.prisma

Generar Prisma Client producción si se necesita:
$env:PRISMA_ENV="production"; npx prisma generate --schema=prisma/schema.postgres.prisma

RECOMENDACIÓN PARA INICIAR PRÓXIMA SESIÓN

Texto sugerido:

“Continuamos con AIDA. Ya quedó desplegada la app en producción, el chat muestra el estado real del plan, el bloqueo por plan cancelado funciona, Neon/Postgres ya está sincronizado y el panel admin ya permite entrar. El problema actual es que en /admin/usuarios no sé identificar qué dispositivo pertenece a qué persona. En esta sesión vamos a diseñar el nuevo flujo de registro con número celular, código de activación y preparación para pagos reales automáticos.”
