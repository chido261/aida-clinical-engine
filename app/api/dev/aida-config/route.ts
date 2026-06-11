// app/api/dev/aida-config/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  listAidaConfigFiles,
  loadAidaConfig,
  type AidaConfigName,
} from "@/app/lib/aida/configLoader";

function isAuthorized(req: Request) {
  const expectedKey = process.env.AIDA_ADMIN_KEY;

  if (!expectedKey) {
    return false;
  }

  const providedKey = req.headers.get("x-aida-admin-key");

  return providedKey === expectedKey;
}

function summarizeConfig(configName: AidaConfigName) {
  const config = loadAidaConfig(configName);

  return {
    version: typeof config.version === "string" ? config.version : null,
    updatedAt: typeof config.updatedAt === "string" ? config.updatedAt : null,
    name: typeof config.name === "string" ? config.name : null,
    description:
      typeof config.description === "string" ? config.description : null,
    topLevelKeys: Object.keys(config),
  };
}

export async function GET(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autorizado",
        },
        { status: 401 }
      );
    }

    const files = listAidaConfigFiles();

    const missingFiles = files.filter((file) => !file.exists);

    if (missingFiles.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan archivos de configuracion AIDA",
          files,
          missingFiles: missingFiles.map((file) => file.fileName),
        },
        { status: 500 }
      );
    }

    const summaries = {
      clinicalRules: summarizeConfig("clinical-rules"),
      protocolRules: summarizeConfig("protocol-rules"),
      notificationRules: summarizeConfig("notification-rules"),
      promotions: summarizeConfig("promotions"),
      onboardingAdvisory: summarizeConfig("onboarding-advisory"),
    };

    return NextResponse.json({
      ok: true,
      message: "Configuracion AIDA cargada correctamente.",
      files,
      summaries,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ??
          "Error desconocido al leer configuracion AIDA.",
      },
      { status: 500 }
    );
  }
}