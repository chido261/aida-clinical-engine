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

export type ClinicalDecision =
  | { handled: true; response: string; nextClinicalState: ClinicalState }
  | { handled: false; nextClinicalState: ClinicalState };

  export function applyClinicalDecisionEngine(params: {
    glucose: number;
    moment: "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";
    previousGlucose?: number | null;
    symptoms?: string[];
    clinicalState?: ClinicalState;
    pendingFollowUpType?: string | null;
  }): ClinicalDecision {
    const { glucose, moment, previousGlucose, clinicalState, pendingFollowUpType } = params;
  
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
  
    const wasHypo =
      clinicalState === "HYPO_ACTIVE" ||
      clinicalState === "RECOVERING_FROM_HYPO" ||
      pendingFollowUpType === "HYPO_RECHECK_15MIN" ||
      pendingFollowUpType === "HYPO_STABILITY_RECHECK" ||
      (previousGlucose != null && previousGlucose < 70);    // 2) RECUPERACIÓN POST-HIPO

    if (wasHypo && glucose >= 70 && glucose < 90) {
      return {
        handled: true,
        nextClinicalState: "RECOVERING_FROM_HYPO",
        response:
          `Perfecto, ya subiste y vas saliendo de la baja. 👍\n` +
          `Ahora estabiliza con proteína + grasa + fibra para evitar que vuelva a bajar.\n` +
          `Evita caminar por ahora.\n` +
          `Mide de nuevo en 30–60 min y me dices el número. Vamos paso a paso. 💪`,
      };
    }

    if (wasHypo && glucose >= 90) {
      return {
        handled: true,
        nextClinicalState: "RECOVERING_FROM_HYPO",
        response:
          `Perfecto, ${glucose} ya indica que saliste de la baja. 👍\n\n` +
          `Ahora conviene comer algo con proteína, grasa y fibra para ayudarte a mantenerte estable, sobre todo si falta para tu siguiente comida.\n\n` +
          `Vuelve a medirte en 30–60 minutos para confirmar que no vuelva a bajar.`,
      };
    }
    
    // 4) AYUNO (solo si lo dijo)
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
            `En ayunas está elevado.\n` +
            `Hoy enfócate en desayuno sin azúcar/harinas y revisemos la cena de ayer.\n` +
            `Si te sientes bien, movimiento suave 10 min es opcional.`,
        };
      }
    }
  
    // 5) POSTCOMIDA (2h explícito)
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
            `2h postcomida está un poco elevado.\n` +
            `Camina 10–15 min ahora y toma agua.\n` +
            `Luego me dices cuánto baja. Aquí sigo contigo.`,
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
  
    // 6) NOCHE (explícito)
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
            `Está un poco alto para la noche.\n` +
            `Evita más comida y mañana revisamos ajuste de cena.\n` +
            `Descansa y me cuentas cómo amaneces.`,
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

  // HIPO: <70 con o sin síntomas (≤54 enfatiza)
  if (glucoseNow !== null && glucoseNow < 70) {
    const intro =
      glucoseNow <= 54
        ? `Ok, tranquilo(a). ${glucoseNow} es una hipoglucemia importante. ⚠️`
        : `Ok, tranquilo(a). ${glucoseNow} está por debajo del rango saludable. ⚠️`;

    const reply =
      `${intro}\n` +
      `Así que aplicaremos rápidamente el Protocolo 15-15 ahora:\n` +
      `1) Toma 15 g de carbohidrato de absorción rápida (1 cda de miel o 150 ml de jugo de frutas).\n` +
      `2) Espera 15 min y vuelve a medir.\n` +
      `Si sigues <70, repite la dosis. Si hay síntomas fuertes o te sientes peor, ve a urgencias. 🚑`;

    return { bypass: true, reply, reason: "hypo_lt70" };
  }

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