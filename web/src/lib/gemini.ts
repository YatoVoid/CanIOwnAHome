import { GoogleGenAI, type Content } from "@google/genai";

const TIMEOUT_MS = 12_000;
// Used when the main model is overloaded or times out, which happens at peak hours.
const FALLBACK_MODEL = "gemini-flash-lite-latest";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GenerateOptions = {
  system: string;
  contents: string | Content[];
  temperature?: number;
  jsonSchema?: object;
};

export async function generate({ system, contents, temperature = 0.6, jsonSchema }: GenerateOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const gemini = new GoogleGenAI({ apiKey });
  const models = [process.env.GEMINI_MODEL || "gemini-3.5-flash", FALLBACK_MODEL];

  for (const [i, model] of models.entries()) {
    try {
      const res = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          temperature,
          maxOutputTokens: 4096,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
          ...(jsonSchema && { responseMimeType: "application/json", responseJsonSchema: jsonSchema }),
        },
      });
      // Thinking models spend output tokens before writing, so a MAX_TOKENS stop means cut-off output.
      const finish = res.candidates?.[0]?.finishReason;
      if (finish !== "STOP") throw new Error(`Gemini stopped early: ${finish}`);
      const text = res.text?.trim();
      if (!text) throw new Error("Gemini returned no text");
      return text;
    } catch (err) {
      if (i === models.length - 1) throw err;
    }
  }
  throw new Error("unreachable");
}
