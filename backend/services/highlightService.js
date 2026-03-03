const { GoogleGenerativeAI } = require("@google/generative-ai");

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) throw new Error("Missing GEMINI_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(key.trim()); // <-- FIX: pass string
  return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
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
    const result = await model.generateContent(prompt);
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
