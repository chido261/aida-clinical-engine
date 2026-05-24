# CONTEXTO ACTUALIZADO — AIDA

## Proyecto

Repositorio:

```txt
chido261/aida-clinical-engine
```

Stack principal:

```txt
Next.js App Router
Prisma
SQLite local
PostgreSQL/Neon para producción
Vercel futuro
```

---

# Forma de trabajo que funcionó muy bien

Nota importante para continuar:

```txt
El usuario quiere trabajar en modo productivo, paso a paso, sin saltar puntos.

Reglas de trabajo:
1. Avanzar un objetivo a la vez.
2. Trabajar un archivo a la vez cuando sea posible.
3. Primero explicar el objetivo concreto del cambio.
4. Dar acciones claras: Acción 1, Acción 2, Acción 3.
5. No dar explicaciones largas ni innecesarias.
6. Si se modifica código, entregar el archivo completo para copiar y pegar.
7. No alterar lo ya funcional.
8. Conservar lo trabajado y modificar solo lo necesario.
9. Después de cada archivo, pedir una prueba concreta.
10. Esperar confirmación del usuario antes de pasar al siguiente punto.
11. Después de cada bloque funcional, pedir commit y push.
12. Si hay duda real, preguntar; si no, avanzar.
13. El usuario prefiere que primero se revise el repo cuando esté disponible.
14. El usuario valora instrucciones directas, prácticas y ordenadas.
```

Frase de trabajo recomendada:

```txt
Vamos un punto a la vez. Primero reviso el archivo, luego te doy el código completo y después probamos.
```

---

# Avances recientes realizados

## 1. Protección del panel admin

Se protegió:

```txt
/admin/activaciones
```

Y las APIs:

```txt
/api/admin/activation-requests
/api/admin/activation-requests/update-status
```

Ahora usan:

```env
AIDA_ADMIN_KEY=...
```

La clave se manda desde frontend usando header:

```txt
x-aida-admin-key
```

El panel pide contraseña, la guarda temporalmente en:

```txt
localStorage: aida_admin_key_v1
```

Y permite cerrar acceso.

Archivos trabajados:

```txt
app/api/admin/activation-requests/route.ts
app/api/admin/activation-requests/update-status/route.ts
app/admin/activaciones/page.tsx
```

Commit realizado:

```txt
Protect admin activation panel
```

---

## 2. Panel de usuarios

Se creó API protegida:

```txt
app/api/admin/users/route.ts
```

Ruta:

```txt
GET /api/admin/users
```

Devuelve hasta 200 usuarios recientes desde `UserState`.

Datos principales:

```txt
id
licenseStatus
licenseLabel
phoneE164
trialStartedAt
trialEndsAt
fullStartedAt
fullEndsAt
lastMsgAt
totalMsgCount
dailyMsgDate
dailyMsgCount
createdAt
updatedAt
```

También devuelve datos clínicos, pero en la vista comercial ya no se muestran.

---

## 3. Página admin de usuarios

Se creó:

```txt
app/admin/usuarios/page.tsx
```

Ruta:

```txt
/admin/usuarios
```

Objetivo:

```txt
Ver todos los usuarios reales de AIDA, su estado de licencia, celular, vencimiento de trial, vencimiento del plan, mensajes y último uso.
```

Diferencia conceptual:

```txt
/admin/activaciones = ventas / solicitudes de acceso completo
/admin/usuarios = base general de usuarios / control de clientes y licencias
```

Flujo:

```txt
Usuario usa AIDA
↓
Se crea en /admin/usuarios como trial
↓
Se le vence la prueba
↓
Va a /pago
↓
Solicita activación
↓
Aparece en /admin/activaciones
↓
Admin marca pagado y activa
↓
Regresa a /admin/usuarios como activo
```

Se probó primero en tarjetas, pero no gustó porque con muchos usuarios sería poco práctico.

Se volvió a tabla limpia.

Columnas actuales:

```txt
Usuario
Licencia
Celular
Trial vence
Plan vence
Mensajes
Último uso
Acciones
```

Commit realizado:

```txt
Add admin users panel
Simplify admin users table
```

---

# Gestión de licencias desde `/admin/usuarios`

## 4. Extender licencia

Se creó:

```txt
app/api/admin/users/extend-license/route.ts
```

Ruta:

```txt
POST /api/admin/users/extend-license
```

Body:

```json
{
  "userId": "...",
  "days": 30
}
```

Días permitidos:

```txt
30
90
365
```

Lógica:

```txt
Si fullEndsAt está en el futuro:
  suma los días a fullEndsAt

Si fullEndsAt ya venció o no existe:
  suma los días desde ahora
```

Actualiza:

```txt
licenseStatus = active
fullStartedAt = existing.fullStartedAt ?? now
fullEndsAt = nueva fecha
```

Botones agregados en `/admin/usuarios`:

```txt
+30 días
+90 días
+365 días
```

Probado correctamente:

```txt
18 jun 2026 → +30 días → 18 jul 2026
+90 días → 16 oct 2026
+365 días → 16 oct 2027
```

Commit realizado:

```txt
Add admin license extension actions
```

---

## 5. Cancelar licencia y reiniciar trial

Se creó:

```txt
app/api/admin/users/update-license/route.ts
```

Ruta:

```txt
POST /api/admin/users/update-license
```

Acciones permitidas:

```txt
cancel-license
reset-trial
```

### Acción: cancelar licencia

Body:

```json
{
  "userId": "...",
  "action": "cancel-license"
}
```

Lógica:

```txt
licenseStatus = expired
fullEndsAt = now
```

Objetivo:

```txt
Quitar acceso completo al usuario.
```

Casos de uso:

```txt
Reembolso
Error de activación
Cancelación manual
Usuario que ya no debe tener acceso
```

---

### Acción: reiniciar trial

Body:

```json
{
  "userId": "...",
  "action": "reset-trial"
}
```

Lógica:

```txt
licenseStatus = trial
trialStartedAt = now
trialEndsAt = now + 7 días
fullStartedAt = null
fullEndsAt = null
dailyMsgDate = null
dailyMsgCount = 0
```

Objetivo:

```txt
Regresar usuario a prueba gratuita de 7 días.
```

Casos de uso:

```txt
Dar nueva prueba
Reiniciar demo
Corregir usuario de prueba
Probar flujo comercial otra vez
```

Botones agregados en `/admin/usuarios`:

```txt
Reiniciar trial
Cancelar
```

Prueba confirmada por el usuario:

```txt
Cancelar funciona.
Reiniciar trial funciona.
Extender licencia funciona.
```

Commit realizado:

```txt
Add admin license management actions
```

---

# Estado actual del proyecto al cerrar este chat

Ya está funcional:

```txt
1. Panel admin protegido con clave.
2. Panel de activaciones protegido.
3. Panel de usuarios protegido.
4. Listado general de usuarios.
5. Extensión manual de licencia por 30, 90 o 365 días.
6. Cancelación manual de licencia.
7. Reinicio manual de trial por 7 días.
8. Cambios subidos a GitHub.
```

---

# Archivos relevantes actuales

```txt
app/admin/activaciones/page.tsx
app/admin/usuarios/page.tsx

app/api/admin/activation-requests/route.ts
app/api/admin/activation-requests/update-status/route.ts

app/api/admin/users/route.ts
app/api/admin/users/extend-license/route.ts
app/api/admin/users/update-license/route.ts

app/api/activation-request/route.ts
app/pago/page.tsx
app/pago/mensual/page.tsx
app/pago/3-meses/page.tsx
app/pago/anual/page.tsx
app/pago/activar/page.tsx

prisma/schema.prisma
app/lib/aidaMemory.ts
app/lib/runtimeConfig.ts
app/api/chat/route.ts
```

---

# Pendientes recomendados para el siguiente chat

## Pendiente 1 — Mejorar navegación admin

Agregar en `/admin/activaciones` un enlace hacia:

```txt
/admin/usuarios
```

Así como `/admin/usuarios` ya tiene enlace a activaciones.

---

## Pendiente 2 — Registrar tipo de plan activo

Actualmente `UserState` tiene:

```txt
licenseStatus
fullStartedAt
fullEndsAt
```

Pero no guarda formalmente:

```txt
plan activo = mensual | 3-meses | anual | manual
```

Sería útil agregar campos futuros:

```prisma
activePlan String?
activePlanSource String? // activation-request | manual-extension | promo | admin
```

Esto ayudaría para promociones comerciales:

```txt
Usuario mensual → ofrecer upgrade a 3 meses
Usuario 3 meses → ofrecer upgrade anual
Usuario expirado → ofrecer reactivación
```

---

## Pendiente 3 — Historial de movimientos de licencia

Actualmente cuando se extiende, cancela o reinicia trial, solo se modifica `UserState`.

Más adelante conviene crear tabla:

```prisma
LicenseEvent
```

Con campos:

```txt
id
userId
action
days
previousStatus
newStatus
previousFullEndsAt
newFullEndsAt
createdAt
adminNote
```

Esto servirá para auditoría.

---

## Pendiente 4 — Botones comerciales futuros

Desde `/admin/usuarios` se podrían agregar:

```txt
Ofrecer upgrade a 3 meses
Ofrecer upgrade anual
Copiar mensaje de WhatsApp
Ver usuario detalle
Ver historial de licencia
```

---

## Pendiente 5 — Página detalle por usuario

Crear ruta:

```txt
/admin/usuarios/[id]
```

Para ver:

```txt
Datos de licencia
Historial de uso
Historial de lecturas
Historial de pagos / activaciones
Historial de movimientos admin
```

---

## Pendiente 6 — Conectar con pagos reales

Después:

```txt
Mercado Pago
Stripe
PayPal
Transferencia validada manualmente
```

Por ahora el flujo es manual.

---

# Nota final importante

El usuario quedó muy satisfecho con esta forma de trabajo y pidió conservarla para el siguiente chat.

Estilo ideal:

```txt
Claro. Vamos paso a paso.
Primero este archivo.
Haz esta acción.
Prueba esto.
Cuando confirmes, avanzamos.
```

Evitar:

```txt
Explicaciones largas
Cambiar varios archivos sin control
Rehacer cosas ya funcionales
Dar parches incompletos
Saltar a arquitectura futura sin terminar el punto actual
```

Recomendación para iniciar el siguiente chat:

```txt
Continuamos desde el contexto actualizado de AIDA. Ya están funcionando los paneles admin de activaciones y usuarios, con extender/cancelar/reiniciar licencia. El siguiente pendiente recomendado es mejorar navegación admin o empezar a registrar tipo de plan activo.
```
