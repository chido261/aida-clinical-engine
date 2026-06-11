// app/lib/aida/configLoader.ts

import fs from "node:fs";
import path from "node:path";

const AIDA_CONFIG_DIR = path.join(process.cwd(), "config", "aida");

export type AidaConfigName =
  | "clinical-rules"
  | "protocol-rules"
  | "notification-rules"
  | "promotions"
  | "onboarding-advisory";

export type AidaConfigFile = {
  version?: string;
  updatedAt?: string;
  name?: string;
  description?: string;
  [key: string]: unknown;
};

export type AidaConfigBundle = {
  clinicalRules: AidaConfigFile;
  protocolRules: AidaConfigFile;
  notificationRules: AidaConfigFile;
  promotions: AidaConfigFile;
  onboardingAdvisory: AidaConfigFile;
};

const CONFIG_FILE_MAP: Record<AidaConfigName, string> = {
  "clinical-rules": "clinical-rules.json",
  "protocol-rules": "protocol-rules.json",
  "notification-rules": "notification-rules.json",
  promotions: "promotions.json",
  "onboarding-advisory": "onboarding-advisory.json",
};

function getConfigPath(configName: AidaConfigName) {
  return path.join(AIDA_CONFIG_DIR, CONFIG_FILE_MAP[configName]);
}

function assertPlainObject(value: unknown, fileName: string): asserts value is AidaConfigFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`El archivo ${fileName} debe contener un objeto JSON valido.`);
  }
}

export function loadAidaConfig(configName: AidaConfigName): AidaConfigFile {
  const fileName = CONFIG_FILE_MAP[configName];
  const filePath = getConfigPath(configName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontro el archivo de configuracion AIDA: ${fileName}`);
  }

  let raw = "";

  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error: any) {
    throw new Error(
      `No se pudo leer el archivo de configuracion AIDA ${fileName}: ${
        error?.message ?? "error desconocido"
      }`
    );
  }

  try {
    const parsed = JSON.parse(raw);
    assertPlainObject(parsed, fileName);
    return parsed;
  } catch (error: any) {
    throw new Error(
      `El archivo de configuracion AIDA ${fileName} tiene JSON invalido: ${
        error?.message ?? "error desconocido"
      }`
    );
  }
}

export function loadAidaConfigBundle(): AidaConfigBundle {
  return {
    clinicalRules: loadAidaConfig("clinical-rules"),
    protocolRules: loadAidaConfig("protocol-rules"),
    notificationRules: loadAidaConfig("notification-rules"),
    promotions: loadAidaConfig("promotions"),
    onboardingAdvisory: loadAidaConfig("onboarding-advisory"),
  };
}

export function listAidaConfigFiles() {
  return Object.entries(CONFIG_FILE_MAP).map(([configName, fileName]) => ({
    configName,
    fileName,
    path: getConfigPath(configName as AidaConfigName),
    exists: fs.existsSync(getConfigPath(configName as AidaConfigName)),
  }));
}