const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  generateCandidateSegments,
  scoreSegment,
  rankCandidates,
  getTopKeywords,
  srtTimeToSeconds,
  collectWindowText,
  getWordCount,
} = require("./highlightScorer");

function getModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !key.trim()) throw new Error("Missing GEMINI_API_KEY in .env");

  const genAI = new GoogleGenerativeAI(key.trim()); // <-- FIX: pass string
  return genAI.getGenerativeModel({ model: "gemini-flash-latest" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaExhaustedError(error) {
  if (!error) return false;

  const message = String(error.message || error.toString() || "");

  // Daily quota exhaustion patterns specific to Gemini
  const quotaPatterns = [
    /PerDay/i,
    /GenerateRequestsPerDayPerProjectPerModel/i,
    /quota exceeded.*metric.*requests/i,
    /daily.*quota/i,
  ];

  return quotaPatterns.some((pattern) => pattern.test(message));
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
  const maxAttempts = 5;
  let delayMs = 2000; // Start at 2 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await model.generateContent(prompt);
    } catch (error) {
      // Check for daily quota exhaustion first — this is not retryable
      if (isQuotaExhaustedError(error)) {
        const quotaMessage =
          "Daily Gemini API quota exceeded. Try again tomorrow or upgrade your plan.";
        console.error(`[Highlight] ${quotaMessage}`, error.message);
        const quotaError = new Error(quotaMessage);
        quotaError.originalError = error.message;
        throw quotaError;
      }

      const shouldRetry =
        attempt < maxAttempts && isTransientGeminiError(error);

      // Add jitter: +/- 20% of the delay
      const jitterPercent = (Math.random() - 0.5) * 0.4; // Random value between -0.2 and 0.2
      const jitteredDelayMs = delayMs * (1 + jitterPercent);
      const delaySeconds = (jitteredDelayMs / 1000).toFixed(2);

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
      await sleep(Math.round(jitteredDelayMs));
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

function buildCandidateReason(candidate, geminiSegment) {
  if (
    candidate.start_ts === geminiSegment.start_ts &&
    candidate.end_ts === geminiSegment.end_ts
  ) {
    return geminiSegment.reason;
  }

  const reasons = [];
  if (candidate.sentimentIntensity >= 70) {
    reasons.push("high emotional intensity");
  }
  if (candidate.keywordDensity >= 70) {
    reasons.push("strong keyword density");
  }
  if (candidate.speechRate >= 70) {
    reasons.push("fast speech pace");
  }
  if (candidate.geminiRank >= 70) {
    reasons.push("good Gemini alignment");
  }

  if (reasons.length === 0) {
    return "Selected by scoring across multiple engagement signals";
  }

  const topReasons = reasons.slice(0, 2);
  return `Selected for ${topReasons.join(" and ")}`;
}

async function selectBestSegmentWithScoring(subtitles, timestampedTranscript) {
  const geminiSegment = await getBestSegment(timestampedTranscript);

  try {
    const candidates = generateCandidateSegments(subtitles);
    const fullKeywords = getTopKeywords(subtitles);
    const fullTranscriptContext = {
      subtitles,
      geminiSegment,
      fullKeywords,
    };

    const geminiStartTime = srtTimeToSeconds(geminiSegment.start_ts);
    const geminiEndTime = srtTimeToSeconds(geminiSegment.end_ts);
    const geminiText = collectWindowText(
      subtitles,
      geminiStartTime,
      geminiEndTime,
    );
    const geminiCandidate = {
      startTime: geminiStartTime,
      endTime: geminiEndTime,
      start_ts: geminiSegment.start_ts,
      end_ts: geminiSegment.end_ts,
      text: geminiText,
      wordCount: getWordCount(geminiText),
      duration: geminiEndTime - geminiStartTime,
    };

    const scoredCandidates = [geminiCandidate, ...candidates].map((candidate) =>
      scoreSegment(candidate, fullTranscriptContext),
    );

    const ranked = rankCandidates(scoredCandidates);
    console.log("[Highlight] Ranked candidates:", ranked);

    const winner = ranked[0];
    const reason = buildCandidateReason(winner, geminiSegment);

    return {
      start_ts: winner.start_ts,
      end_ts: winner.end_ts,
      reason,
    };
  } catch (error) {
    console.error(
      "[Highlight] Scoring pipeline failed, falling back to Gemini raw pick:",
      error.message,
    );
    return geminiSegment;
  }
}

module.exports = { getBestSegment, selectBestSegmentWithScoring };
