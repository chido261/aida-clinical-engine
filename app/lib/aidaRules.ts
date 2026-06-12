// app/lib/aidaRules.ts

export type Moment = "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";

export type RuleResult =
  | { bypass: true; reply: string; reason: string }
  | { bypass: false; moment: Moment; glucose: number | null };

const WA_LINK = "https://wa.me/5214531030592";

export function extractLastGlucoseMgDl(text: string): number | null {
  const matches = text.match(/\b(\d{2,3})\b/g);
  if (!matches) return null;

  const nums = matches
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 30 && n <= 600);

  if (!nums.length) return null;
  return nums[nums.length - 1];
}

export type ClinicalState = "HYPO_ACTIVE" | "RECOVERING_FROM_HYPO" | null;

export type PendingFollowUpType =
  | "HYPO_RECHECK_15MIN"
  | "HYPO_STABILITY_RECHECK"
  | "POSTMEAL_WALK_RECHECK"
  | "POSTMEAL_PLATE_REVIEW"
  | null;
  
  export type ClinicalDecision =
  | {
      handled: true;
      response: string;
      nextClinicalState: ClinicalState;
      resolvedFollowUpType?: PendingFollowUpType;
    }
  | { handled: false; nextClinicalState: ClinicalState };

export function applyClinicalDecisionEngine(params: {
  glucose: number;
  moment: "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";
  previousGlucose?: number | null;
  symptoms?: string[];
  clinicalState?: ClinicalState;
  pendingFollowUpType?: PendingFollowUpType;
}): ClinicalDecision {
  const {
    glucose,
    moment,
    previousGlucose,
    clinicalState,
    pendingFollowUpType,
  } = params;

  // 1) HIPO (ACTIVA)
  if (glucose < 70) {
    return {
      handled: true,
      nextClinicalState: "HYPO_ACTIVE",
      response:
        `Ok, tranquilo(a). ${glucose} está por debajo del rango saludable. ⚠️\n` +
        `Aplicaremos Protocolo 15-15 ahora:\n` +
        `1) Toma 15 g de carbohidrato de absorción rápida (1 cda de miel **o** 150 ml de jugo).\n` +
        `2) Espera 15 min y vuelve a medir.\n` +
        `Si sigues <70, repite la dosis. Si hay síntomas fuertes o te sientes peor, urgencias. 🚑`,
    };
  }

  // 2) RECUPERACIÓN POST-HIPO
  const wasHypo =
    clinicalState === "HYPO_ACTIVE" ||
    (previousGlucose != null && previousGlucose < 70);

  if (wasHypo && glucose >= 70 && glucose < 90) {
    return {
      handled: true,
      nextClinicalState: "RECOVERING_FROM_HYPO",
      response:
        `Perfecto, ya subiste y vas saliendo de la baja. 👍\n` +
        `Ahora estabiliza con proteína + grasa (ej: huevo, queso, atún, yogurt natural).\n` +
        `Evita caminar por ahora.\n` +
        `Mide de nuevo en 30–60 min y me dices el número. Vamos paso a paso. 💪`,
    };
  }

  // 3) CIERRE DE EPISODIO POST-HIPO
  // Si venía en recuperación y la nueva re-medición ya es estable,
  // no debe tratarse como lectura normal: primero se cierra el episodio.
  const isPostHypoStabilityRecheck =
    clinicalState === "RECOVERING_FROM_HYPO" ||
    pendingFollowUpType === "HYPO_STABILITY_RECHECK";

  if (isPostHypoStabilityRecheck && glucose >= 90) {
    return {
      handled: true,
      nextClinicalState: null,
      response:
        `Perfecto, ${glucose} ya es una lectura estable después de la baja. 👍\n` +
        `Con esto cerramos el seguimiento de la hipoglucemia por ahora.\n` +
        `Mantén una comida estable y evita dejar pasar muchas horas sin comer.\n` +
        `Si vuelves a sentir temblor, sudor frío, debilidad o mareo, mídete de nuevo y me dices.`,
    };
  }

  // 4) NORMALIZACIÓN GENERAL (limpia estado si quedara alguno activo)
  if (clinicalState && glucose >= 90) {
    return { handled: false, nextClinicalState: null };
  }

  // 5) CIERRE DE SEGUIMIENTO POSTCOMIDA DESPUÉS DE CAMINAR
  const isPostMealWalkRecheck =
    pendingFollowUpType === "POSTMEAL_WALK_RECHECK";

  if (
    isPostMealWalkRecheck &&
    previousGlucose != null &&
    glucose < previousGlucose
  ) {
    return {
      handled: true,
      nextClinicalState: clinicalState ?? null,
      resolvedFollowUpType: "POSTMEAL_WALK_RECHECK",
      response:
        `Perfecto, bajar de ${previousGlucose} a ${glucose} después de caminar muestra que tu cuerpo sí respondió bien al movimiento. 👍\n` +
        `Estas experiencias ayudan a aprender qué le funciona a tu glucosa.\n` +
        `En tu próxima comida, recuerda asegurar el balance del plato para buscar una respuesta más estable desde el inicio.\n` +
        `Sabes que cuentas conmigo para cualquier duda.`,
    };
  }

  // 5) AYUNO (solo si lo dijo)
  if (moment === "AYUNO") {
    if (glucose < 90) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `En ayunas está algo bajo.\n` +
          `Desayuna proteína + grasa + fibra para estabilizar.\n` +
          `Sin ejercicio por ahora. Aquí sigo contigo.`,
      };
    }

    if (glucose <= 110) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `En ayunas está en buen rango. 👍\n` +
          `Mantén desayuno estable (proteína + grasa + fibra) y seguimos monitoreando.\n` +
          `Avísame tu siguiente lectura.`,
      };
    }

    if (glucose > 130) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `Amanecer en ${glucose} significa que hoy conviene empezar con un desayuno muy estable para no seguir empujando la glucosa hacia arriba.\n` +
          `Hazlo con proteína + grasa + vegetales, sin pan, fruta, jugos ni harinas por ahora.\n` +
          `También vale la pena revisar qué cenaste ayer, porque muchas veces el ayuno alto se empieza a construir desde la noche anterior.\n` +
          `¿Quieres que te dé 3 opciones de desayuno para hoy?`,
      };
    }
   }

  // 6) POSTCOMIDA (2h explícito)
  if (moment === "POSTCOMIDA") {
    if (glucose <= 140) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `2h postcomida está en rango. 👍\n` +
          `Solo hidrátate y mantén el mismo patrón de comida.\n` +
          `Avísame tu siguiente lectura.`,
      };
    }

    if (glucose <= 180) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `${glucose} a las 2 horas después de comer está un poco por arriba de lo que buscamos.\n` +
          `Lo más útil ahora es caminar 10–15 minutos y tomar agua para ayudar a que el músculo use parte de esa glucosa.\n` +
          `Después podemos revisar qué hubo en ese plato, porque ahí suele estar la clave para que la siguiente comida responda mejor.\n` +
          `¿Quieres decirme qué comiste y lo revisamos juntos?`,
      };
    }

    if (glucose > 180) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `Está elevado postcomida.\n` +
          `Camina 15 min + agua y evita más carbohidratos por ahora.\n` +
          `Si hay síntomas importantes, consulta médico.`,
      };
    }
  }

  // 7) NOCHE (explícito)
  if (moment === "NOCHE") {
    if (glucose < 80) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `Antes de dormir está bajo.\n` +
          `Toma un snack pequeño con proteína (yogurt natural / huevo / queso) para evitar bajadas.\n` +
          `Si te sientes raro(a), vuelve a medir en 15–30 min.`,
      };
    }

    if (glucose <= 110) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `Buen nivel para dormir. 👍\n` +
          `Cena ligera si te falta algo y descansa.\n` +
          `Mañana medimos en ayunas.`,
      };
    }

    if (glucose > 120) {
      return {
        handled: true,
        nextClinicalState: clinicalState ?? null,
        response:
          `Llegar a la noche en ${glucose} indica que conviene cerrar el día sin agregar más carga de comida.\n` +
          `Si ya cenaste, evita comer de nuevo. Si todavía necesitas cenar, por ahora omite carbohidratos y enfócate solo en proteína y grasas saludables.\n` +
          `Mañana, con tu lectura en ayunas, podremos ver si la cena de hoy te ayudó o si hay algo que ajustar.\n` +
          `Descansa, y cuando despiertes me compartes cómo amaneciste.`,
      };
    }
  }

  return { handled: false, nextClinicalState: clinicalState ?? null };
}

export function detectMomentFromText(text: string): Moment {
  const lower = text.toLowerCase();

  if (/(ayuno|en ayunas|al despertar|despert|sin comer)/i.test(lower)) return "AYUNO";
  if (/(post\s*comida|despu[eé]s de comer|2h|2 horas|dos horas)/i.test(lower)) return "POSTCOMIDA";
  if (/(antes de dormir|al dormir|me voy a dormir|noche)/i.test(lower)) return "NOCHE";

  return "DESCONOCIDO";
}

export function isConfirmation(text: string): boolean {
  return /(ok|va|listo|perfecto|gracias|sale|lo har[eé]|intentar[eé]|ya lo hice|hecho|de acuerdo|okey)/i.test(
    text.toLowerCase()
  );
}

function hasAny(text: string, words: RegExp[]): boolean {
  return words.some((r) => r.test(text));
}

function detectHypoSymptoms(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [
    /mareo/,
    /temblor/,
    /sudor(aci[oó]n)? fr[ií]a/,
    /debilidad/,
    /palpitaciones/,
    /taquicardia/,
    /ansiedad/,
    /confusi[oó]n/,
  ]);
}

function detectHyperSymptoms(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [
    /v[oó]mito/,
    /nausea|n[áa]usea/,
    /dolor (en )?pecho/,
    /dificultad para respirar/,
    /falta de aire/,
    /respiraci[oó]n agitada/,
    /confusi[oó]n/,
    /desmayo/,
  ]);
}

function detectChestOrBreathing(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [/dolor (en )?pecho/, /falta de aire/, /dificultad para respirar/, /respiraci[oó]n agitada/]);
}

function detectVomiting(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [/v[oó]mito/, /vomit/, /arcadas/]);
}

export function applySafetyBypass(userText: string, historyText?: string): RuleResult {
  const glucoseNow = extractLastGlucoseMgDl(userText);

  const combinedForContext = (historyText ? `${historyText}\n` : "") + userText;
  const moment = detectMomentFromText(combinedForContext);

  // Dolor pecho / falta de aire -> urgencias (con o sin glucosa)
  if (detectChestOrBreathing(userText)) {
    const reply =
      `Estoy contigo. Esto sí es importante. 🚨\n` +
      `Si hay dolor en pecho o falta de aire: ve a urgencias o busca atención médica inmediata.\n` +
      `Si puedes, siéntate y respira lento.\n` +
      `Si necesitas apoyo rápido, escríbeme aquí: ${WA_LINK}`;
    return { bypass: true, reply, reason: "chest_or_breathing_urgent" };
  }

   // HIPO: <70
  // Ya lo maneja el nuevo motor clínico AIDA con respuesta determinística.
  // No responder aquí para evitar duplicidad o mensajes inconsistentes.

  // 70–80 con síntomas -> tratar como hipo
  const hypoSymptoms = detectHypoSymptoms(userText);
  if (glucoseNow !== null && glucoseNow <= 80 && hypoSymptoms) {
    const reply =
      `Te entiendo. Con esos síntomas y esa lectura, vamos a tratarlo como hipo. ⚠️\n` +
      `Protocolo 15-15:\n` +
      `Toma 15 g de carbohidrato rápido, espera 15 min y vuelve a medir.\n` +
      `Si no mejora o empeoras, urgencias. 🚑`;
    return { bypass: true, reply, reason: "hypo_70_80_with_symptoms" };
  }

  // Vómitos + glucosa alta -> urgencias
  if (glucoseNow !== null && glucoseNow >= 300 && detectVomiting(userText)) {
    const reply =
      `Ok, te entiendo. Con vómitos y esa glucosa es mejor atenderlo YA. 🚨\n` +
      `Ve a urgencias o busca atención médica inmediata.\n` +
      `Mientras vas: pequeños sorbos de agua.\n` +
      `Si necesitas apoyo rápido, escríbeme aquí: ${WA_LINK}`;
    return { bypass: true, reply, reason: "hyper_ge300_with_vomiting" };
  }

  // HIPER: ≥300
  if (glucoseNow !== null && glucoseNow >= 300) {
    const hasSymptoms = detectHyperSymptoms(userText);

    if (hasSymptoms) {
      const reply =
        `Ok, estoy contigo. Con síntomas y esa glucosa, es importante atenderlo YA. 🚨\n` +
        `Ve a urgencias o busca atención médica inmediata.\n` +
        `Mientras tanto: respira lento y toma sorbos de agua.\n` +
        `Si necesitas apoyo rápido, escríbeme aquí: ${WA_LINK}`;
      return { bypass: true, reply, reason: "hyper_ge300_with_symptoms" };
    }

    const reply =
      `Ok, tranquilo. Vamos paso a paso. 🫶\n` +
      `1) Respira 1 minuto (4s inhalas, 4s exhalas) x 6.\n` +
      `2) Toma agua con limón (sin azúcar).\n` +
      `3) Revisa si hoy te tocaba medicamento y si ya lo tomaste (sin ajustar dosis).\n` +
      `En 15 min vuelve a medir y me dices el número. 📍`;
    return { bypass: true, reply, reason: "hyper_ge300_no_symptoms" };
  }

  return { bypass: false, moment, glucose: glucoseNow };
}