// app/api/analyze-file/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function jsonERR(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function jsonOK(payload: any) {
  return NextResponse.json({ ok: true, ...payload });
}

function buildPrompt(params: {
  fileName: string;
  mimeType: string;
  userText: string;
}) {
  const { fileName, mimeType, userText } = params;

  const isPdf = mimeType === "application/pdf";

  return `
Eres AIDA, asistente educativo para personas con diabetes tipo 2 o prediabetes.

Analiza el archivo enviado por el usuario.

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
4. Sugiere qué trabajar con alimentación, hábitos y seguimiento.
5. Aclara que no sustituyes consulta médica.`
    : `Si parece etiqueta de alimento o producto:
1. Identifica si es buena opción para una persona con glucosa elevada.
2. Señala ingredientes que podrían subir glucosa o afectar control metabólico.
3. Explica si conviene, si se debe limitar o evitar.
4. Da una recomendación práctica de consumo.
5. Si no se alcanza a leer algo, dilo claramente.`
}

Estilo:
- Español.
- Claro.
- Profesional.
- Directo.
- Sin alarmismo.
- No diagnostiques.
- No indiques suspender medicamentos.
`.trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file");
    const userText = String(formData.get("message") ?? "");

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
      error?.message || "Error al analizar el archivo.",
      500
    );
  }
}