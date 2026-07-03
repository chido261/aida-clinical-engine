// app/lib/aida2/specialists/mealTemplates.ts

import type { MealType } from "./mealSpecialist";

export type MealTemplate = {

  name: string;

  mealType: MealType;

  allowedProteins: string[];

  preferredVegetables: string[];

  preferredFats: string[];

  allowsLegumes: boolean;

  notes?: string;

};

export const MEAL_TEMPLATES: MealTemplate[] = [

  /* ======================================================
     DESAYUNOS
  ====================================================== */

  {
    name: "Huevos con vegetales",

    mealType: "desayuno",

    allowedProteins: [
      "Huevo entero",
      "Clara de huevo"
    ],

    preferredVegetables: [
      "Espinaca",
      "Champiñones",
      "Jitomate",
      "Cebolla",
      "Chile poblano",
      "Pimiento verde",
      "Calabaza"
    ],

    preferredFats: [
      "Aguacate",
      "Aceite de oliva extra virgen"
    ],

    allowsLegumes: false
  },

  {
    name: "Carne asada",

    mealType: "desayuno",

    allowedProteins: [
      "Bistec de res",
      "Arrachera",
      "Lomo de res"
    ],

    preferredVegetables: [
      "Nopal",
      "Jitomate",
      "Pepino",
      "Brócoli",
      "Champiñones"
    ],

    preferredFats: [
      "Aguacate"
    ],

    allowsLegumes: false
  },

  {
    name: "Pollo a la plancha",

    mealType: "desayuno",

    allowedProteins: [
      "Pechuga de pollo",
      "Muslo de pollo"
    ],

    preferredVegetables: [
      "Espinaca",
      "Calabaza",
      "Brócoli",
      "Ejotes"
    ],

    preferredFats: [
      "Aguacate"
    ],

    allowsLegumes: false
  },

  /* ======================================================
     COMIDA
  ====================================================== */

  {
    name: "Proteína asada",

    mealType: "comida",

    allowedProteins: [
      "Bistec de res",
      "Arrachera",
      "Lomo de res",
      "Pechuga de pollo",
      "Muslo de pollo",
      "Lomo de cerdo"
    ],

    preferredVegetables: [
      "Brócoli",
      "Coliflor",
      "Calabaza",
      "Ejotes",
      "Champiñones",
      "Nopal"
    ],

    preferredFats: [
      "Aguacate",
      "Aceite de oliva extra virgen"
    ],

    allowsLegumes: true
  },

  {
    name: "Pescado con vegetales",

    mealType: "comida",

    allowedProteins: [
      "Salmón",
      "Tilapia",
      "Mojarra",
      "Atún",
      "Filete de pescado blanco"
    ],

    preferredVegetables: [
      "Espárragos",
      "Brócoli",
      "Calabaza",
      "Ejotes"
    ],

    preferredFats: [
      "Aceite de oliva extra virgen",
      "Aguacate"
    ],

    allowsLegumes: true
  },

  /* ======================================================
     CENA
  ====================================================== */

  {
    name: "Cena ligera",

    mealType: "cena",

    allowedProteins: [
      "Pechuga de pollo",
      "Huevo entero",
      "Clara de huevo",
      "Atún"
    ],

    preferredVegetables: [
      "Lechuga romana",
      "Espinaca",
      "Pepino",
      "Jitomate",
      "Champiñones"
    ],

    preferredFats: [
      "Aguacate",
      "Aceite de oliva extra virgen"
    ],

    allowsLegumes: false
  },

  {
    name: "Ensalada con proteína",

    mealType: "cena",

    allowedProteins: [
      "Pechuga de pollo",
      "Atún",
      "Huevo entero"
    ],

    preferredVegetables: [
      "Lechuga romana",
      "Espinaca",
      "Pepino",
      "Jitomate",
      "Pimiento verde"
    ],

    preferredFats: [
      "Aguacate"
    ],

    allowsLegumes: false
  },

  /* ======================================================
     SNACK
  ====================================================== */

  {
    name: "Snack",

    mealType: "snack",

    allowedProteins: [
      "Queso panela",
      "Queso cottage",
      "Huevo entero",
      "Yogur griego natural sin azúcar"
    ],

    preferredVegetables: [],

    preferredFats: [
      "Almendras",
      "Nueces",
      "Pistaches",
      "Cacahuate natural"
    ],

    allowsLegumes: false
  }

];