// app/lib/aida/welcomeContextBuilder.ts

import { DateTime } from "luxon";

const MX_TZ = "America/Mexico_City";

type WelcomeUserState = {
  clinicalState: string | null;
  lastEventType: string | null;
  lastEventAt: Date | null;
  pendingFollowUpType: string | null;
  pendingFollowUpAt: Date | null;
  lastRecommendation: string | null;
  currentNutritionGoal?: string | null;
  activeProtocol?: string | null;
  activePhase?: string | null;
};

type WelcomeReading = {
  glucose: number;
  moment: string;
  createdAt: Date;
};

function getNowMx() {
  return DateTime.now().setZone(MX_TZ);
}

function getPartOfDay(now: DateTime) {
  const hour = now.hour;

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

function getDayRelation(date: Date, now: DateTime) {
  const value = DateTime.fromJSDate(date).setZone(MX_TZ);
  const diffDays = Math.floor(now.startOf("day").diff(value.startOf("day"), "days").days);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "older";
}

function getElapsedMinutes(date: Date, now: DateTime) {
  const value = DateTime.fromJSDate(date).setZone(MX_TZ);
  return Math.max(0, Math.floor(now.diff(value, "minutes").minutes));
}

function buildTimePhrase(date: Date, now: DateTime) {
  const minutes = getElapsedMinutes(date, now);

  if (minutes < 60) return "Hace un rato";

  return getDayRelation(date, now) === "today" ? "Hoy" : "La última vez";
}

function buildReadingMomentLabel(moment: string) {
  if (moment === "AYUNO") return "en ayunas";
  if (moment === "ANTES_COMER") return "antes de comer";
  if (moment === "POSTCOMIDA") return "postcomida";
  if (moment === "NOCHE") return "antes de dormir";
  if (moment === "RECUPERACION_HIPO") return "después de recuperarte de una hipoglucemia";
  if (moment === "POSTMEAL_RECOVERY") return "después de caminar";
  return "";
}

export function buildPendingFollowUpWelcome(params: {
  name: string;
  userState: WelcomeUserState;
}) {
  const { name, userState } = params;
  const now = getNowMx();

  if (
    userState.pendingFollowUpType === "HYPO_RECHECK_15MIN" &&
    userState.pendingFollowUpAt
  ) {
    const timePhrase = buildTimePhrase(userState.pendingFollowUpAt, now);

    return `Hola ${name} 👋

${timePhrase} registraste una glucosa baja y quedamos en volver a medir después del protocolo 15-15.

Antes de seguir, dime cuánto marca tu glucosa ahora.`;
  }

  if (
    userState.pendingFollowUpType === "HYPO_STABILITY_RECHECK" &&
    userState.pendingFollowUpAt
  ) {
    const timePhrase = buildTimePhrase(userState.pendingFollowUpAt, now);

    return `Hola ${name} 👋

${timePhrase} subiste después de una glucosa baja. Quiero confirmar que sigas estable.

Dime cómo te sientes y cuánto marca tu glucosa ahora.`;
  }

  if (
    userState.pendingFollowUpType === "POSTMEAL_PLATE_REVIEW" &&
    userState.pendingFollowUpAt
  ) {
    const timePhrase = buildTimePhrase(userState.pendingFollowUpAt, now);

    return `Hola ${name} 👋

${timePhrase} registraste una lectura postcomida elevada y quedó pendiente revisar qué comiste.

Antes de seguir, dime qué comiste en esa comida.`;
  }

  if (
    userState.pendingFollowUpType === "POSTMEAL_WALK_RECHECK" &&
    userState.pendingFollowUpAt
  ) {
    const timePhrase = buildTimePhrase(userState.pendingFollowUpAt, now);

    const recommendation = (
      userState.lastRecommendation?.trim() ||
      "Te sugerí hidratarte con agua natural y caminar ligero 10–15 minutos si te sentías bien"
    ).replace(/[.。]+$/, "");

    return `Hola ${name} 👋

${timePhrase} registraste una lectura postcomida elevada y dejamos un seguimiento pendiente.

${recommendation}.

Antes de seguir, dime: ¿ya caminaste o te volviste a medir?`;
  }

  return null;
}

export function buildResolvedEventWelcome(params: {
  name: string;
  userState: WelcomeUserState;
  lastReading: WelcomeReading | null;
}) {
  const { name, userState, lastReading } = params;

  if (!lastReading) return null;

  const now = getNowMx();
  const relation = getDayRelation(lastReading.createdAt, now);
  const reading = `${lastReading.glucose} mg/dL`;

  if (lastReading.moment === "POSTMEAL_RECOVERY") {
    if (relation === "today") {
      return `Hola ${name} 👋

Hoy tu última lectura registrada fue ${reading} después de caminar.

Ese seguimiento postcomida ya quedó cerrado. Ahora retomamos el protocolo en tu siguiente comida por horario o hambre real.`;
    }

    return `Hola ${name} 👋

La última vez cerramos un seguimiento postcomida con ${reading} después de caminar.

Hoy podemos continuar con tu protocolo según cómo vayan tus lecturas.`;
  }

  if (
    userState.lastEventType === "HYPOGLYCEMIA_RESOLVED" ||
    lastReading.moment === "RECUPERACION_HIPO"
  ) {
    if (relation === "today") {
      return `Hola ${name} 👋

Hoy cerramos un seguimiento por glucosa baja con ${reading}.

Antes de avanzar, dime cómo te sientes ahora.`;
    }

    return `Hola ${name} 👋

La última vez cerramos un seguimiento por glucosa baja con ${reading}.

Hoy podemos continuar cuidando estabilidad.`;
  }

  return null;
}

export function buildReturnWelcome(params: {
  name: string;
  lastReading: WelcomeReading;
  clinicalState: string | null;
}) {
  const { name, lastReading, clinicalState } = params;

  const now = getNowMx();
  const partOfDay = getPartOfDay(now);
  const relation = getDayRelation(lastReading.createdAt, now);
  const reading = `${lastReading.glucose} mg/dL`;

  const moment = buildReadingMomentLabel(lastReading.moment);
  const readingWithMoment = moment ? `${reading} ${moment}` : reading;

  if (clinicalState === "HYPO_ACTIVE" || lastReading.glucose < 70) {
    if (relation === "today") {
      return `Hola ${name} 👋

Hoy registraste una glucosa baja de ${readingWithMoment}. Antes de seguir, dime cómo te sientes en este momento.`;
    }

    return `Hola ${name} 👋

La última lectura que tengo registrada fue una glucosa baja de ${readingWithMoment}. Antes de avanzar, conviene confirmar cómo te encuentras ahora.`;
  }

  if (relation === "today") {
    if (!moment) {
      return `Hola ${name} 👋

Hoy registraste ${reading}. Podemos revisar esta lectura y darle contexto según cómo te sientes o en qué momento la tomaste.`;
    }

    if (partOfDay === "morning") {
      return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar qué sigue según cómo vaya tu mañana.`;
    }

    if (partOfDay === "afternoon") {
      if (lastReading.moment === "AYUNO") {
        return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Si ya comiste, podemos revisar cómo respondió tu glucosa después de los alimentos.`;
      }

      if (lastReading.moment === "POSTCOMIDA") {
        return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo va el resto de tu día y qué conviene hacer después.`;
      }

      return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo vas ahora.`;
    }

    return `Hola ${name} 👋

Hoy registraste ${readingWithMoment}. Podemos revisar cómo va cerrando tu día.`;
  }

  if (relation === "yesterday") {
    if (partOfDay === "morning" && lastReading.moment === "NOCHE") {
      return `Hola ${name} 👋

Ayer cerraste el día en ${readingWithMoment}.

Cuando tengas tu lectura en ayunas de hoy, compártemela y vemos cómo respondió tu cuerpo durante la noche.`;
    }

    if (partOfDay === "morning") {
      return `Hola ${name} 👋

Ayer registraste ${readingWithMoment}. Cuando tengas tu lectura de hoy, compártemela y la comparamos.`;
    }

    return `Hola ${name} 👋

Ayer registraste ${readingWithMoment}. Podemos revisar cómo vas hoy y ver si el patrón se mantiene.`;
  }

  if (partOfDay === "morning") {
    return `Hola ${name} 👋

La última lectura que tengo registrada fue de ${readingWithMoment}. Cuando tengas tu lectura en ayunas de hoy, compártemela y vemos cómo inicia tu día.`;
  }

  return `Hola ${name} 👋

La última lectura que tengo registrada fue de ${readingWithMoment}. ¿Qué te gustaría revisar ahora?`;
}