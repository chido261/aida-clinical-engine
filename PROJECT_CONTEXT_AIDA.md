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
