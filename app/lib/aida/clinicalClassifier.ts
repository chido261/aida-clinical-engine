// app/lib/aida/clinicalClassifier.ts

import type {
  AidaInterpretedReading,
  AidaReadingMoment,
  AidaDetectedSymptom,
} from "@/app/lib/aida/clinicalInterpreter";

export type AidaClinicalLevel = 1 | 2 | 3 | 4 | 5;

export type AidaClinicalAction =
  | "MAINTAIN_PATTERN"
  | "ASK_MOMENT_CLARIFICATION"
  | "ACTIVATE_15_15_PROTOCOL"
  | "CHECK_CONTEXT_AND_SYMPTOMS"
  | "REVIEW_DINNER_SLEEP_STRESS"
  | "PLATE_REVIEW_AND_WALK_IF_SAFE"
  | "PLATE_REVIEW_HYDRATION_AND_MEDICAL_FOLLOWUP_IF_REPEATED"
  | "SAFETY_CHECK_AND_MEDICAL_REFERRAL_IF_SYMPTOMS"
  | "MEDICAL_REVIEW_IF_REPEATED";

export type AidaClassifiedReading = AidaInterpretedReading & {
  level: AidaClinicalLevel;
  label: string;
  action: AidaClinicalAction;
  requiresFollowUp: boolean;
  requiresMedicalWarning: boolean;
  medicationNote: string;
  explanation: string;
};

export type AidaClinicalClassification = {
  readings: AidaClassifiedReading[];
  highestLevel: AidaClinicalLevel | null;
  primaryAction: AidaClinicalAction | null;
  hasMedicalWarning: boolean;
  hasFollowUp: boolean;
  summary: string;
};

const MEDICATION_BOUNDARY =
  "AIDA no ajusta medicamentos, no indica dosis y no sugiere usar medicamento para bajar glucosa si la lectura está en rango saludable.";

function hasSevereSymptom(symptoms: AidaDetectedSymptom[]) {
  return (
    symptoms.includes("CHEST_OR_BREATHING") ||
    symptoms.includes("SEVERE_WEAKNESS") ||
    symptoms.includes("CONFUSION_OR_FAINTING") ||
    symptoms.includes("VOMITING")
  );
}

function classifyHypoglycemia(
  glucose: number,
  momentLabel: string
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  return {
    level: 5,
    label: `Hipoglucemia${momentLabel ? ` ${momentLabel}` : ""}`.trim(),
    action: "ACTIVATE_15_15_PROTOCOL",
    requiresFollowUp: true,
    requiresMedicalWarning: true,
    medicationNote:
      "Una lectura menor de 70 mg/dL se considera hipoglucemia con o sin medicamentos. No se ajustan medicamentos desde AIDA.",
    explanation: `La lectura de ${glucose} mg/dL está por debajo de 70 mg/dL.`,
  };
}

function classifyVeryHigh(
  glucose: number,
  momentLabel: string
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  return {
    level: 5,
    label: `Glucosa muy alta${momentLabel ? ` ${momentLabel}` : ""}`.trim(),
    action: "SAFETY_CHECK_AND_MEDICAL_REFERRAL_IF_SYMPTOMS",
    requiresFollowUp: true,
    requiresMedicalWarning: true,
    medicationNote:
      "Si el usuario tiene tratamiento indicado, debe seguir la indicación de su médico. AIDA no ajusta dosis.",
    explanation: `La lectura de ${glucose} mg/dL es muy alta y requiere revisar síntomas de alerta.`,
  };
}

function classifyUnknownMoment(
  glucose: number
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  if (glucose < 70) {
    return classifyHypoglycemia(glucose, "");
  }

  if (glucose > 250) {
    return classifyVeryHigh(glucose, "");
  }

  return {
    level: 2,
    label: "Lectura sin momento definido",
    action: "ASK_MOMENT_CLARIFICATION",
    requiresFollowUp: false,
    requiresMedicalWarning: false,
    medicationNote: MEDICATION_BOUNDARY,
    explanation:
      "Hay una lectura numérica, pero falta saber si fue en ayunas, postcomida o antes de dormir.",
  };
}

function classifyFasting(
  glucose: number
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  if (glucose < 70) {
    return classifyHypoglycemia(glucose, "en ayuno");
  }

  if (glucose >= 70 && glucose <= 100) {
    return {
      level: 1,
      label: "Ayuno saludable",
      action: "MAINTAIN_PATTERN",
      requiresFollowUp: false,
      requiresMedicalWarning: false,
      medicationNote:
        "Ayuno de 70 a 100 mg/dL está en rango saludable para AIDA. No sugerir medicamento para bajar más la glucosa.",
      explanation: "La lectura en ayuno está dentro del rango saludable de 70 a 100 mg/dL.",
    };
  }

  if (glucose >= 101 && glucose <= 130) {
    return {
      level: 3,
      label: "Ayuno elevado",
      action: "REVIEW_DINNER_SLEEP_STRESS",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "AIDA puede revisar hábitos y patrón. Si usa tratamiento, debe seguir indicación médica; AIDA no ajusta dosis.",
      explanation:
        "El ayuno está por arriba del rango saludable y conviene revisar cena, sueño, estrés o patrón nocturno.",
    };
  }

  if (glucose >= 131 && glucose <= 250) {
    return {
      level: 4,
      label: "Ayuno alto",
      action: "MEDICAL_REVIEW_IF_REPEATED",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "Si el ayuno alto se repite, conviene revisión médica. AIDA no indica ni ajusta medicamentos.",
      explanation:
        "El ayuno está alto. Si se repite, conviene revisar tendencia y comentarlo con un profesional de salud.",
    };
  }

  return classifyVeryHigh(glucose, "en ayuno");
}

function classifyPostMeal(
  glucose: number
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  if (glucose < 70) {
    return classifyHypoglycemia(glucose, "postcomida");
  }

  if (glucose >= 70 && glucose <= 99) {
    return {
      level: 2,
      label: "Postcomida baja o requiere contexto",
      action: "CHECK_CONTEXT_AND_SYMPTOMS",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "No sugerir medicamentos. Conviene revisar síntomas, tiempo desde comida y si usa tratamiento indicado.",
      explanation:
        "Para una lectura posterior a comida, este valor está bajo o requiere contexto adicional.",
    };
  }

  if (glucose >= 100 && glucose <= 140) {
    return {
      level: 1,
      label: "Postcomida saludable",
      action: "MAINTAIN_PATTERN",
      requiresFollowUp: false,
      requiresMedicalWarning: false,
      medicationNote:
        "Postcomida de 100 a 140 mg/dL está en rango saludable para AIDA. No sugerir medicamento para bajar más la glucosa.",
      explanation: "La lectura postcomida está dentro del rango saludable de 100 a 140 mg/dL.",
    };
  }

  if (glucose >= 141 && glucose <= 180) {
    return {
      level: 3,
      label: "Hiperglucemia postcomida",
      action: "PLATE_REVIEW_AND_WALK_IF_SAFE",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "AIDA no indica medicamentos. Si el usuario tiene tratamiento indicado, debe seguir su indicación médica.",
      explanation:
        "Después de comidas, una lectura mayor de 140 mg/dL se considera elevada. Conviene revisar el plato, horario y patrón.",
    };
  }

  if (glucose >= 181 && glucose <= 250) {
    return {
      level: 4,
      label: "Postcomida alta",
      action: "PLATE_REVIEW_HYDRATION_AND_MEDICAL_FOLLOWUP_IF_REPEATED",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "Si las elevaciones se repiten, conviene revisión médica. AIDA no ajusta dosis ni indica medicamentos.",
      explanation:
        "La lectura postcomida está alta. Conviene revisar comida, hidratación, actividad segura y tendencia.",
    };
  }

  return classifyVeryHigh(glucose, "postcomida");
}

function classifyBedtime(
  glucose: number
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  if (glucose < 70) {
    return classifyHypoglycemia(glucose, "antes de dormir");
  }

  if (glucose >= 70 && glucose <= 120) {
    return {
      level: 1,
      label: "Noche estable",
      action: "MAINTAIN_PATTERN",
      requiresFollowUp: false,
      requiresMedicalWarning: false,
      medicationNote:
        "La lectura nocturna está estable. No sugerir medicamento para bajar más la glucosa.",
      explanation: "La lectura antes de dormir está en rango estable para cerrar el día.",
    };
  }

  if (glucose >= 121 && glucose <= 180) {
    return {
      level: 3,
      label: "Noche elevada",
      action: "REVIEW_DINNER_SLEEP_STRESS",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "AIDA puede revisar cena y patrón. Si usa tratamiento, debe seguir indicación médica.",
      explanation:
        "La lectura nocturna está elevada. Conviene revisar cena, horarios, sueño y tendencia.",
    };
  }

  if (glucose >= 181 && glucose <= 250) {
    return {
      level: 4,
      label: "Noche alta",
      action: "REVIEW_DINNER_SLEEP_STRESS",
      requiresFollowUp: true,
      requiresMedicalWarning: false,
      medicationNote:
        "Si se repite, conviene revisión médica. AIDA no ajusta medicamentos.",
      explanation:
        "La lectura nocturna está alta. Conviene revisar cena, tendencia y comentarlo si persiste.",
    };
  }

  return classifyVeryHigh(glucose, "antes de dormir");
}

function classifyByMoment(
  glucose: number,
  moment: AidaReadingMoment
): Omit<AidaClassifiedReading, keyof AidaInterpretedReading> {
  if (moment === "FASTING") return classifyFasting(glucose);
  if (moment === "POST_MEAL") return classifyPostMeal(glucose);
  if (moment === "BEDTIME") return classifyBedtime(glucose);
  return classifyUnknownMoment(glucose);
}

function buildSummary(readings: AidaClassifiedReading[]) {
  if (!readings.length) {
    return "No se detectaron lecturas de glucosa.";
  }

  if (readings.length === 1) {
    const r = readings[0];
    return `${r.glucose} mg/dL: ${r.label} (Nivel ${r.level}).`;
  }

  return readings
    .map((r) => `${r.glucose} mg/dL ${r.moment}: ${r.label} (Nivel ${r.level})`)
    .join(" | ");
}

export function classifyAidaReadings(params: {
  readings: AidaInterpretedReading[];
  symptoms?: AidaDetectedSymptom[];
}): AidaClinicalClassification {
  const symptoms = params.symptoms ?? [];
  const severeSymptom = hasSevereSymptom(symptoms);

  const classified = params.readings.map((reading) => {
    const base = classifyByMoment(reading.glucose, reading.moment);

    if (severeSymptom && reading.glucose >= 250) {
      return {
        ...reading,
        ...base,
        level: 5 as const,
        requiresFollowUp: true,
        requiresMedicalWarning: true,
        action: "SAFETY_CHECK_AND_MEDICAL_REFERRAL_IF_SYMPTOMS" as const,
        medicationNote:
          "Hay glucosa muy alta junto con síntomas de alerta. AIDA no ajusta medicamentos; se prioriza atención médica.",
        explanation:
          "Hay glucosa muy alta junto con síntomas de alerta; se debe priorizar seguridad médica.",
      };
    }

    return {
      ...reading,
      ...base,
    };
  });

  const highestLevel =
    classified.length > 0
      ? (Math.max(...classified.map((reading) => reading.level)) as AidaClinicalLevel)
      : null;

  const highestReading =
    highestLevel != null
      ? classified.find((reading) => reading.level === highestLevel) ?? null
      : null;

  return {
    readings: classified,
    highestLevel,
    primaryAction: highestReading?.action ?? null,
    hasMedicalWarning: classified.some((reading) => reading.requiresMedicalWarning),
    hasFollowUp: classified.some((reading) => reading.requiresFollowUp),
    summary: buildSummary(classified),
  };
}