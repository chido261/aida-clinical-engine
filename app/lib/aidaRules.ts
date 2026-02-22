// app/lib/aidaRules.ts

export type Moment = "AYUNO" | "POSTCOMIDA" | "NOCHE" | "DESCONOCIDO";

export type RuleResult =
  | { bypass: true; reply: string; reason: string }
  | { bypass: false; moment: Moment; glucose: number | null };

const WA_LINK = "https://wa.me/5214531030592";

// Extrae el primer número tipo glucosa (ej: "120", "165 mg/dL", "70 de glucosa")
export function extractGlucoseMgDl(text: string): number | null {
  const m = text.match(/(?:\bglucosa\b|\bmg\/?dl\b)?\s*[:=]?\s*(\d{2,3})\b/i) || text.match(/\b(\d{2,3})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  // Rango razonable para glucosa capilar
  if (n < 30 || n > 600) return null;
  return n;
}

export function detectMomentFromText(text: string): Moment {
  const lower = text.toLowerCase();

  if (/(ayuno|en ayunas|al despertar|despert|sin comer)/i.test(lower)) return "AYUNO";
  if (/(post\s*comida|despu[eé]s de comer|2h|2 horas|dos horas)/i.test(lower)) return "POSTCOMIDA";
  if (/(antes de dormir|al dormir|me voy a dormir|noche)/i.test(lower)) return "NOCHE";

  // Nota: NO usamos "cena" para NOCHE, porque aparece mucho hablando de "la cena de anoche" (contexto AYUNO).
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

function detectSevereSymptoms(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [
    /confusi[oó]n/,
    /desmayo/,
    /dolor (en )?pecho/,
    /dificultad para respirar/,
    /falta de aire/,
    /respiraci[oó]n agitada/,
    /v[oó]mito/,
  ]);
}

function detectHypoSymptoms(text: string): boolean {
  const lower = text.toLowerCase();
  return hasAny(lower, [
    /mareo/,
    /temblor/,
    /sudor(aci[oó]n)? fr[ií]a/,
    /debilidad/,
    /palpitaciones/,
    /ansiedad/,
    /confusi[oó]n/,
  ]);
}

export function applySafetyBypass(userText: string, historyText?: string): RuleResult {
  const combined = (historyText ? `${historyText}\n` : "") + userText;

  const glucose = extractGlucoseMgDl(combined);
  const moment = detectMomentFromText(combined);

  // 1) HIPO con síntomas (o muy baja aunque no diga síntomas)
  const hypoSymptoms = detectHypoSymptoms(combined);
  if (glucose !== null && (glucose <= 69 || (glucose <= 80 && hypoSymptoms))) {
    const reply =
      glucose <= 69 || hypoSymptoms
        ? `Tu glucosa está baja y eso puede explicar el mareo.\nToma AHORA 1 opción: ½ cucharada de miel o ½ manzana o guayaba.\nEspera 15 min y vuelve a medir.\nEscríbeme el número. Si empeoras o te desmayas, urgencias.`
        : `Está un poco baja.\nCome algo pequeño y seguro (½ manzana o guayaba) y re-checa en 15 min.\nEscríbeme tu nueva medición.`;
    return { bypass: true, reply, reason: "hypo_safety" };
  }

  // 2) MUY ALTA con síntomas graves -> urgencias (sin IA)
  const severe = detectSevereSymptoms(combined);
  if (glucose !== null && glucose >= 300 && severe) {
    const reply =
      `Esa glucosa es muy alta y con esos síntomas es importante atenderlo YA.\nBusca urgencias o atención médica inmediata.\nSi puedes, hidrátate con agua y evita comer más por ahora.\nSi quieres, escríbeme aquí: ${WA_LINK}`;
    return { bypass: true, reply, reason: "hyper_severe_safety" };
  }

  // 3) Muy alta sin síntomas graves -> alerta educativa + pedir dato (sin IA opcional)
  if (glucose !== null && glucose >= 350 && !severe) {
    const reply =
      `Esa lectura es alta.\nHidrátate con agua y evita carbohidratos por ahora.\nSi tienes vómito, respiración agitada, confusión o dolor en pecho: urgencias.\nDime si fue en ayuno, 2h postcomida o antes de dormir.`;
    return { bypass: true, reply, reason: "hyper_very_high" };
  }

  return { bypass: false, moment, glucose };
}
