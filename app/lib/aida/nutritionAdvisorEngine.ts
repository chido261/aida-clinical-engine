// app/lib/aida/nutritionAdvisorEngine.ts

export type NutritionAdvisorResult = {
    detectedFoods: string[];
    protocolAllowedFoods: string[];
    protocolExcludedFoods: string[];
    protocolCompliant: boolean | null;
    mealMoment: "DESAYUNO" | "COMIDA" | "CENA" | "SNACK" | "DESCONOCIDO";
    guidance: string;
  };
  
  const PROTOCOL_1_ALLOWED = [
    "pollo",
    "huevo",
    "carne",
    "pescado",
    "atún",
    "queso",
    "aguacate",
    "ensalada",
    "verduras",
    "nopal",
    "brócoli",
    "calabacita",
    "pepino",
    "lechuga",
    "espinaca",
  ];
  
  const PROTOCOL_1_EXCLUDED = [
    "tortilla",
    "tortillas",
    "pan",
    "arroz",
    "pasta",
    "avena",
    "maíz",
    "papa",
    "camote",
    "jugo",
    "azúcar",
    "refresco",
    "cereal",
    "cereales",
    "granos",
    "frijol",
    "frijoles",
  ];
  
  const PROTOCOL_2_ALLOWED_EXTRA = [
    "tortilla",
    "frijol",
    "frijoles",
    "lentejas",
    "garbanzos",
  ];
  
  function normalizeText(text: string) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
  
  function unique(values: string[]) {
    return Array.from(new Set(values));
  }
  
  function detectFoods(text: string) {
    const normalized = normalizeText(text);
    const knownFoods = unique([
      ...PROTOCOL_1_ALLOWED,
      ...PROTOCOL_1_EXCLUDED,
      ...PROTOCOL_2_ALLOWED_EXTRA,
      "lentejas",
      "garbanzos",
      "almendras",      
    ]);
  
    return knownFoods.filter((food) => {
      const escaped = food.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
    });
  }
  
  function detectMealMoment(text: string): NutritionAdvisorResult["mealMoment"] {
    const normalized = normalizeText(text);
  
    if (/\b(desayuno|desayune|desayunar)\b/.test(normalized)) return "DESAYUNO";
    if (/\b(comida|comi|almuerzo|almorce)\b/.test(normalized)) return "COMIDA";
    if (/\b(cena|cene|cenar)\b/.test(normalized)) return "CENA";
    if (/\b(snack|colacion|colación|tentempie|tentempié)\b/.test(normalized)) return "SNACK";
  
    return "DESCONOCIDO";
  }
  
  function getAllowedFoodsByProtocol(activeProtocol: string) {
    if (activeProtocol === "PROTOCOL_2") {
      return unique([...PROTOCOL_1_ALLOWED, ...PROTOCOL_2_ALLOWED_EXTRA]);
    }
  
    if (activeProtocol === "MAINTENANCE") {
      return unique([...PROTOCOL_1_ALLOWED, ...PROTOCOL_2_ALLOWED_EXTRA]);
    }
  
    return PROTOCOL_1_ALLOWED;
  }
  
  function getExcludedFoodsByProtocol(activeProtocol: string) {
    if (activeProtocol === "PROTOCOL_2") {
      return PROTOCOL_1_EXCLUDED.filter(
        (food) => !PROTOCOL_2_ALLOWED_EXTRA.includes(food)
      );
    }
  
    if (activeProtocol === "MAINTENANCE") {
      return [];
    }
  
    return PROTOCOL_1_EXCLUDED;
  }
  
  export function analyzeMealByProtocol(params: {
    text: string;
    activeProtocol: string;
    nutritionGoal?: string | null;
  }): NutritionAdvisorResult {
    const { text, activeProtocol, nutritionGoal } = params;
  
    const detectedFoods = detectFoods(text);
    const allowedList = getAllowedFoodsByProtocol(activeProtocol);
    const excludedList = getExcludedFoodsByProtocol(activeProtocol);
  
    const protocolAllowedFoods = detectedFoods.filter((food) =>
      allowedList.includes(food)
    );
  
    const protocolExcludedFoods = detectedFoods.filter((food) =>
      excludedList.includes(food)
    );
  
    const protocolCompliant =
      detectedFoods.length === 0
        ? null
        : protocolExcludedFoods.length === 0;
  
    const mealMoment = detectMealMoment(text);
  
    let guidance =
      "Mantén la estructura del protocolo con proteína, grasas saludables y vegetales con fibra.";
  
      if (activeProtocol === "PROTOCOL_1" && mealMoment === "DESAYUNO") {
        guidance =
          "En Protocolo 1, el desayuno debe basarse en proteína, grasas saludables y vegetales con fibra. La fruta no va como base del desayuno; se puede valorar 2 horas después y antes de las 5:00 PM.";
    
        return {
          detectedFoods,
          protocolAllowedFoods,
          protocolExcludedFoods,
          protocolCompliant,
          mealMoment,
          guidance,
        };
      }

    if (activeProtocol === "PROTOCOL_1") {
      if (nutritionGoal === "LOWER_GLUCOSE") {
        guidance =
          "Para ayudar a bajar y estabilizar glucosa en Protocolo 1, prioriza proteína, grasas saludables y vegetales con fibra. Evita cereales, granos, tortilla, papa, camote, jugos y azúcar.";
      } else if (nutritionGoal === "RAISE_GLUCOSE") {
        guidance =
          "Si la glucosa está baja, primero se atiende la baja con una acción segura. Después se estabiliza con proteína, grasa saludable y fibra.";
      } else {
        guidance =
          "En Protocolo 1, conserva 75% proteína y grasas saludables, y 25% carbohidratos principalmente de vegetales con fibra.";
      }
    }
  
    if (activeProtocol === "PROTOCOL_2") {
      guidance =
        "En Protocolo 2 se pueden valorar algunos carbohidratos controlados si la glucosa se mantiene estable, sin perder la base de proteína, grasas saludables y vegetales.";
    }
  
    if (activeProtocol === "MAINTENANCE") {
      guidance =
        "En mantenimiento se busca sostener estabilidad, variedad y respuesta glucémica adecuada.";
    }
  
    return {
      detectedFoods,
      protocolAllowedFoods,
      protocolExcludedFoods,
      protocolCompliant,
      mealMoment,
      guidance,
    };
  }