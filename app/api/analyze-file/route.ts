// app/api/analyze-file/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

type ChatMessage = {
  role?: string;
  content?: string;
};

function jsonERR(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonOK(payload: any) {
  return NextResponse.json({ ok: true, ...payload });
}

function safeParseJson<T>(value: FormDataEntryValue | null): T | null {
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildRecentConversation(messages: ChatMessage[] | null) {
  if (!Array.isArray(messages) || messages.length === 0) return "Sin conversación previa disponible.";

  return messages
    .slice(-6)
    .map((m) => {
      const role = m.role === "assistant" ? "AIDA" : "Usuario";
      const content = typeof m.content === "string" ? m.content : "";
      return `${role}: ${content}`.trim();
    })
    .filter(Boolean)
    .join("\n");
}

function buildOnboardingSummary(onboarding: any) {
  if (!onboarding || typeof onboarding !== "object") {
    return "Sin datos de onboarding disponibles.";
  }

  return `
Nombre: ${onboarding.name || "No disponible"}
Edad: ${onboarding.age || "No disponible"}
Estatura: ${onboarding.heightCm || "No disponible"} cm
Peso: ${onboarding.weightKg || "No disponible"} kg
Diagnóstico: ${onboarding.diagnosis || "No disponible"}
Medicamentos: ${onboarding.meds || "No disponible"}
Pico en ayunas reportado: ${onboarding.fastingPeakMgDl || "No disponible"} mg/dL
Pico postcomida reportado: ${onboarding.postMealPeakMgDl || "No disponible"} mg/dL
Hora habitual de despertar: ${onboarding.wakeTime || "No disponible"}
`.trim();
}

function buildPrompt(params: {
  fileName: string;
  mimeType: string;
  userText: string;
  deviceId: string;
  onboarding: any;
  messages: ChatMessage[] | null;
}) {
  const { fileName, mimeType, userText, deviceId, onboarding, messages } = params;

  const isPdf = mimeType === "application/pdf";

  const onboardingSummary = buildOnboardingSummary(onboarding);
  const recentConversation = buildRecentConversation(messages);

  return `
Eres AIDA, asistente educativo para personas con diabetes tipo 2 o prediabetes.

Analiza el archivo enviado por el usuario usando el contexto clínico disponible.

Usuario:
- Device ID: ${deviceId || "No disponible"}

Datos del usuario:
${onboardingSummary}

Conversación reciente:
${recentConversation}

Archivo:
- Nombre: ${fileName}
- Tipo: ${mimeType}
- Instrucción del usuario: ${userText || "Analiza este archivo."}

Objetivo:
${
  isPdf
    ? `Si parece estudio de laboratorio:
1. Da primero las buenas noticias.
2. Luego menciona los datos que requieren atención.
3. Explica qué podría significar de forma educativa.
4. Relaciona el análisis con glucosa, resistencia a la insulina, hábitos, medicamentos reportados y seguimiento.
5. Aclara que no sustituyes consulta médica.`
    : `Si parece etiqueta de alimento, producto, comida, plato o captura:
1. Identifica qué se alcanza a observar.
2. Explica si parece buena opción para una persona con glucosa elevada, diabetes tipo 2 o prediabetes.
3. Señala ingredientes, porciones o elementos que podrían subir glucosa o afectar control metabólico.
4. Explica si conviene, si se debe limitar o evitar.
5. Da una recomendación práctica de consumo.
6. Si no se alcanza a leer algo, dilo claramente.`
}

Reglas de seguridad:
- No diagnostiques.
- No indiques suspender medicamentos.
- No prometas curas.
- Si detectas datos peligrosos o síntomas graves, recomienda atención médica.
- Si el archivo es ilegible, dilo y pide una foto más clara.

Estilo:
- Español.
- Claro.
- Profesional.
- Directo.
- Sin alarmismo.
- No uses explicaciones largas.
`.trim();
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return jsonERR("Falta configurar OPENAI_API_KEY en el servidor.", 500);
    }

    const formData = await req.formData();

    const file = formData.get("file");
    const userText = String(formData.get("message") ?? "");
    const deviceId = String(formData.get("deviceId") ?? "");

    const onboarding = safeParseJson<any>(formData.get("onboarding"));
    const messages = safeParseJson<ChatMessage[]>(formData.get("messages"));

    if (!(file instanceof File)) {
      return jsonERR("No se recibió ningún archivo.", 400);
    }

    if (file.size > MAX_FILE_BYTES) {
      return jsonERR(`El archivo es muy grande. Máximo permitido: ${MAX_FILE_MB} MB.`, 413);
    }

    const mimeType = file.type || "application/octet-stream";

    const isImage = mimeType.startsWith("image/");
    const isPdf = mimeType === "application/pdf";

    if (!isImage && !isPdf) {
      return jsonERR("Formato no permitido. Sube una imagen o PDF.", 415);
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const prompt = buildPrompt({
      fileName: file.name,
      mimeType,
      userText,
      deviceId,
      onboarding,
      messages,
    });

    if (isImage) {
      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            ],
          },
        ],
      });

      return jsonOK({
        reply: response.output_text || "No pude analizar la imagen.",
      });
    }

    if (isPdf) {
      const uploadedFile = await openai.files.create({
        file: new File([arrayBuffer], file.name, { type: mimeType }),
        purpose: "assistants",
      });

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_file",
                file_id: uploadedFile.id,
              },
            ],
          },
        ],
      });

      return jsonOK({
        reply: response.output_text || "No pude analizar el PDF.",
      });
    }

    return jsonERR("Archivo no compatible.", 415);
  } catch (error: any) {
    console.error("API /api/analyze-file ERROR:", error);

    return jsonERR(
      error?.message || "Error técnico al analizar el archivo. Intenta con otra foto o vuelve a intentarlo.",
      500
    );
  }
}