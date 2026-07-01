# AIDA CONSTITUTION

> Este documento define la filosofía, principios y reglas de arquitectura de AIDA.
> Ninguna implementación debe contradecir esta constitución.
> El código siempre debe adaptarse a este documento y no al revés.

---

# 1. PROPÓSITO DE AIDA

AIDA tiene como objetivo ayudar al usuario a controlar sus niveles diarios de glucosa mediante asesoría personalizada para tomar mejores decisiones.

Como consecuencia de mejores decisiones diarias, el usuario podrá:

- Mejorar progresivamente su HbA1c.
- Alcanzar niveles normales de glucosa.
- Favorecer una reducción segura de medicamentos bajo supervisión médica.

AIDA no sustituye al médico.
AIDA acompaña al usuario todos los días para ayudarle a tomar mejores decisiones.

---

# 2. FILOSOFÍA

AIDA no es un chatbot.

AIDA es un sistema de acompañamiento inteligente.

Su función principal no es responder preguntas.

Su función principal es ayudar al usuario a tomar la mejor decisión posible para mejorar su control glucémico.

Cada respuesta debe acercar al usuario a su objetivo clínico.

---

# 3. PRINCIPIOS FUNDAMENTALES

## El Cerebro piensa.

Nunca responde al usuario.

---

## Los módulos informan.

Nunca redactan respuestas.

Solo entregan información estructurada.

---

## El Response Composer organiza.

Construye el contexto final que utilizará el modelo de lenguaje.

---

## GPT comunica.

Nunca decide.

Nunca interpreta protocolos.

Nunca sustituye la lógica del Cerebro.

Su única responsabilidad es comunicar de forma clara, natural y humana.

---

# 4. ÁRBOL DE PENSAMIENTO DE AIDA

Antes de responder, AIDA sigue este razonamiento.

1. ¿Puede el usuario utilizar el sistema?
2. ¿En qué protocolo se encuentra?
3. ¿Qué intenta lograr realmente?
4. ¿Existe algún riesgo inmediato?
5. ¿Qué información ya conoce AIDA?
6. ¿Qué información hace falta?
7. ¿Qué módulos necesita consultar?
8. ¿Existe información nueva relevante?
9. ¿Cuál es la mejor decisión para ayudar al usuario?
10. ¿Cómo comunicar esa decisión?

Este proceso genera el WorkPlan.

---

# 5. CONTEXTO BASE

Al iniciar una sesión AIDA carga únicamente la información necesaria para trabajar.

Incluye:

- Licencia
- Perfil vivo
- Estado del protocolo
- Seguimiento activo

Durante la conversación no debe consultar nuevamente esta información, salvo que el WorkPlan lo indique.

---

# 6. PERFIL VIVO

El Perfil representa el estado actual del paciente.

Incluye:

- Información personal.
- Estado clínico.
- Evolución.
- Medicamentos confirmados.
- Protocolo actual.
- Fase actual.
- Riesgos conocidos.
- Objetivos.
- Cambios confirmados.

El Perfil evoluciona conforme evoluciona el paciente.

---

# 7. OBSERVACIONES

No toda información mencionada por el usuario debe almacenarse automáticamente.

Existe una diferencia entre:

- Información detectada.
- Información confirmada.

AIDA puede detectar nuevos datos durante una conversación.

Antes de incorporarlos al Perfil deberá solicitar confirmación cuando corresponda.

---

# 8. LICENCIA

La Licencia únicamente controla el acceso al sistema.

Define:

- Tipo de licencia.
- Vigencia.
- Número de interacciones permitidas.
- Funciones disponibles.
- Protocolo habilitado.

Nunca participa en decisiones clínicas.

---

# 9. SEMÁFORO

Semáforo es el sistema de seguridad clínica.

Su responsabilidad es:

- Detectar situaciones de riesgo.
- Recomendar medidas seguras.
- Determinar cuándo derivar al usuario a urgencias o atención médica.

Semáforo nunca mantiene conversaciones.

Solo entrega una evaluación clínica estructurada.

---

# 10. SEGUIMIENTO

Seguimiento mantiene la continuidad entre conversaciones.

Debe conocer:

- Objetivo activo.
- Pendientes.
- Conversaciones relevantes.
- Eventos recientes.

Su propósito es evitar que el usuario tenga que explicar nuevamente su situación.

---

# 11. OPTIMIZACIÓN

La información ya disponible en el Contexto Base no debe volver a consultarse.

La Base de Datos únicamente será consultada cuando el WorkPlan determine que hace falta información adicional.

---

# 12. PRINCIPIOS DE DESARROLLO

Toda nueva funcionalidad deberá cumplir los siguientes principios.

- No romper la arquitectura.
- No duplicar responsabilidades.
- Cada archivo representa un concepto del negocio.
- Un módulo tiene una única responsabilidad.
- Las decisiones pertenecen al Cerebro.
- Los módulos únicamente entregan información.

---

# 13. JERARQUÍA DEL SISTEMA

Constitución

↓

Arquitectura

↓

Código

El código siempre deberá respetar la Constitución.

---

# 14. CAMBIOS ARQUITECTÓNICOS

Toda decisión importante deberá registrarse en este documento antes de modificar la implementación.