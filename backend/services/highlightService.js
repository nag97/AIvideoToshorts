const { GoogleGenerativeAI } = require("@google/generative-ai");

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) throw new Error("Missing GEMINI_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(key.trim()); // <-- FIX: pass string
  return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(error) {
  if (!error) return false;

  const status = error.statusCode || error.status || error.code;
  const message = String(error.message || error.toString() || "");

  const transientStatusCodes = [429, 503, 504];
  const transientPatterns = [
    /high demand/i,
    /rate limit/i,
    /service unavailable/i,
    /temporar(?:y|ily)/i,
    /timeout/i,
    /internal server error/i,
  ];

  if (transientStatusCodes.includes(Number(status))) {
    return true;
  }

  return transientPatterns.some((pattern) => pattern.test(message));
}

async function callGenerateContentWithRetry(model, prompt) {
  const maxAttempts = 3;
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      const shouldRetry =
        attempt < maxAttempts && isTransientGeminiError(error);
      const delaySeconds = delayMs / 1000;

      if (!shouldRetry) {
        if (attempt > 1) {
          console.error(
            `[Highlight] Gemini retry exhausted after ${attempt} attempts: ${error.message}`,
          );
        }
        throw error;
      }

      console.warn(
        `[Highlight] Gemini transient error, retrying in ${delaySeconds}s, attempt ${attempt}/${maxAttempts}: ${error.message}`,
      );
      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  throw new Error("Gemini generateContent retry loop exited unexpectedly.");
}

async function getBestSegment(timestampedTranscript) {
  console.log("[Gemini] Starting segment selection...");

  const model = getModel();

  const prompt = `
You are an expert viral YouTube Shorts editor.

From the timestamped transcript below, choose the single most engaging segment for a short.
Target length: 30–45 seconds (hard max 60 seconds).

Return STRICT JSON ONLY (no markdown, no extra text):
{
  "start_ts": "HH:MM:SS,mmm",
  "end_ts": "HH:MM:SS,mmm",
  "reason": "short reason"
}

Timestamped transcript:
${timestampedTranscript}
`.trim();

  try {
    console.log("[Gemini] Calling generateContent...");
    const result = await callGenerateContentWithRetry(model, prompt);
    console.log("[Gemini] Response received");

    const text = result.response.text().trim();
    console.log("[Gemini] Response text:", text.substring(0, 200) + "...");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Gemini did not return valid JSON. Response: " + text);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.start_ts || !parsed.end_ts) {
      throw new Error("Missing start_ts/end_ts in Gemini output.");
    }

    console.log("[Gemini] Success:", parsed);
    return parsed;
  } catch (error) {
    console.error("[Gemini] Error:", error.message);
    throw error;
  }
}

module.exports = { getBestSegment };
