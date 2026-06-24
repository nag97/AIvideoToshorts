const DEFAULT_OPTIONS = {
  minWindowSeconds: 10,
  maxWindowSeconds: 15,
  stepSeconds: 4,
  minWindowLengths: [10, 12, 15],
};

const STOPWORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "aren't",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "could",
  "couldn't",
  "did",
  "didn't",
  "do",
  "does",
  "doesn't",
  "doing",
  "don't",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "hadn't",
  "has",
  "hasn't",
  "have",
  "haven't",
  "having",
  "he",
  "he'd",
  "he'll",
  "he's",
  "her",
  "here",
  "here's",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "how's",
  "i",
  "i'd",
  "i'll",
  "i'm",
  "i've",
  "if",
  "in",
  "into",
  "is",
  "isn't",
  "it",
  "it's",
  "its",
  "itself",
  "let's",
  "me",
  "more",
  "most",
  "mustn't",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "ought",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "shan't",
  "she",
  "she'd",
  "she'll",
  "she's",
  "should",
  "shouldn't",
  "so",
  "some",
  "such",
  "than",
  "that",
  "that's",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "there's",
  "these",
  "they",
  "they'd",
  "they'll",
  "they're",
  "they've",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "wasn't",
  "we",
  "we'd",
  "we'll",
  "we're",
  "we've",
  "were",
  "weren't",
  "what",
  "what's",
  "when",
  "when's",
  "where",
  "where's",
  "which",
  "while",
  "who",
  "who's",
  "whom",
  "why",
  "why's",
  "with",
  "won't",
  "would",
  "wouldn't",
  "you",
  "you'd",
  "you'll",
  "you're",
  "you've",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

const SENTIMENT_TERMS = new Set([
  "amazing",
  "awesome",
  "brilliant",
  "captivating",
  "excited",
  "exciting",
  "epic",
  "fantastic",
  "fierce",
  "furious",
  "game-changing",
  "genius",
  "heartbreaking",
  "heartfelt",
  "hyped",
  "inspiring",
  "intense",
  "legendary",
  "love",
  "loved",
  "powerful",
  "shocking",
  "stunning",
  "surprising",
  "terrifying",
  "thrilling",
  "toxic",
  "unbelievable",
  "unstoppable",
  "urgent",
  "wild",
  "wow",
  "wowza",
  "yes",
  "no",
  "never",
  "always",
  "amazed",
  "angry",
  "astonishing",
  "crazy",
  "dangerous",
  "deep",
  "dramatic",
  "emotional",
  "epic",
  "explode",
  "explosive",
  "fierce",
  "fear",
  "great",
  "hyped",
  "obsessed",
  "outrageous",
  "ridiculous",
  "scary",
  "shocking",
  "sick",
  "strong",
  "terrible",
  "thrill",
  "urgent",
  "wow",
  "yikes",
]);

function srtTimeToSeconds(timestamp) {
  if (!timestamp || typeof timestamp !== "string") return 0;

  const [timePart, msPart = "000"] = timestamp.split(",");
  const [hours = "0", minutes = "0", seconds = "0"] = (timePart || "").split(
    ":",
  );

  const h = Number(hours);
  const m = Number(minutes);
  const s = Number(seconds);
  const ms = Number(msPart.padEnd(3, "0"));

  return Math.max(0, h * 3600 + m * 60 + s + ms / 1000);
}

function secondsToSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean);
}

function getTranscriptText(subtitles) {
  return subtitles.map((item) => item.text || "").join(" ");
}

function getWordCount(text) {
  return tokenize(text).length;
}

function collectWindowText(subtitles, windowStart, windowEnd) {
  const windowTexts = [];

  for (const subtitle of subtitles) {
    const subtitleStart = srtTimeToSeconds(subtitle.start);
    const subtitleEnd = srtTimeToSeconds(subtitle.end);

    if (subtitleEnd <= windowStart || subtitleStart >= windowEnd) continue;
    if (subtitle.text && subtitle.text.trim()) {
      windowTexts.push(subtitle.text.trim());
    }
  }

  return windowTexts.join(" ").replace(/\s+/g, " ").trim();
}

function getTopKeywords(subtitles, limit = 12) {
  const frequencies = new Map();
  const text = getTranscriptText(subtitles);
  const words = tokenize(text);

  for (const word of words) {
    if (STOPWORDS.has(word) || word.length < 3) continue;
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  return Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function getSentimentIntensityScore(candidate) {
  const words = tokenize(candidate.text);
  const wordCount = Math.max(words.length, 1);
  let emotionalMatches = 0;

  for (const word of words) {
    if (SENTIMENT_TERMS.has(word)) {
      emotionalMatches += 1;
    }
  }

  const exclamations = (candidate.text.match(/!/g) || []).length;
  const questions = (candidate.text.match(/\?/g) || []).length;
  const intensity = emotionalMatches + exclamations * 0.8 + questions * 0.5;

  return Math.min(100, Math.round((intensity / wordCount) * 140));
}

function getKeywordDensityScore(candidate, fullKeywords) {
  const candidateWords = tokenize(candidate.text);
  const wordCount = Math.max(candidateWords.length, 1);
  let keywordMatches = 0;

  for (const word of candidateWords) {
    if (fullKeywords.includes(word)) {
      keywordMatches += 1;
    }
  }

  const emphasis = (candidate.text.match(/!/g) || []).length;
  const questions = (candidate.text.match(/\?/g) || []).length;
  const rawDensity = keywordMatches + emphasis * 0.9 + questions * 1.2;

  return Math.min(100, Math.round((rawDensity / wordCount) * 100));
}

function getSpeechRateScore(candidate) {
  const words = getWordCount(candidate.text);
  const duration = Math.max(candidate.duration, 0.1);
  const wps = words / duration;

  // Map typical energetic speech rate into 0-100.
  const minRate = 1.5;
  const maxRate = 6;
  const rawScore = ((wps - minRate) / (maxRate - minRate)) * 100;

  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

function getGeminiRank(candidate, geminiSegment) {
  if (!geminiSegment || !geminiSegment.start_ts || !geminiSegment.end_ts) {
    return 0;
  }

  const geminiStart = srtTimeToSeconds(geminiSegment.start_ts);
  const geminiEnd = srtTimeToSeconds(geminiSegment.end_ts);
  const overlapStart = Math.max(candidate.startTime, geminiStart);
  const overlapEnd = Math.min(candidate.endTime, geminiEnd);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  const unionStart = Math.min(candidate.startTime, geminiStart);
  const unionEnd = Math.max(candidate.endTime, geminiEnd);
  const union = unionEnd - unionStart;

  if (union <= 0) return 0;
  return Math.min(100, Math.round((overlap / union) * 100));
}

function generateCandidateSegments(subtitles, options = {}) {
  const { minWindowSeconds, maxWindowSeconds, stepSeconds, minWindowLengths } =
    {
      ...DEFAULT_OPTIONS,
      ...options,
    };

  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return [];
  }

  const firstStart = srtTimeToSeconds(subtitles[0].start);
  const lastEnd = Math.max(
    ...subtitles.map((item) => srtTimeToSeconds(item.end)),
  );
  const candidates = [];
  const lengthOptions =
    Array.isArray(minWindowLengths) && minWindowLengths.length > 0
      ? minWindowLengths
      : [minWindowSeconds, maxWindowSeconds];

  for (const windowLength of lengthOptions) {
    const duration = Math.min(
      Math.max(windowLength, minWindowSeconds),
      maxWindowSeconds,
    );
    for (
      let startTime = firstStart;
      startTime + duration <= lastEnd;
      startTime += stepSeconds
    ) {
      const endTime = startTime + duration;
      const text = collectWindowText(subtitles, startTime, endTime);
      const wordCount = getWordCount(text);

      if (!text || wordCount === 0) continue;

      candidates.push({
        startTime,
        endTime,
        start_ts: secondsToSrtTime(startTime),
        end_ts: secondsToSrtTime(endTime),
        text,
        wordCount,
        duration,
      });
    }
  }

  // Remove duplicates by start/end
  const unique = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.start_ts}-${candidate.end_ts}`;
    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values());
}

function scoreSegment(candidate, fullTranscriptContext = {}) {
  const {
    subtitles = [],
    geminiSegment,
    fullKeywords = [],
  } = fullTranscriptContext;
  const keywords =
    fullKeywords.length > 0 ? fullKeywords : getTopKeywords(subtitles);

  const sentimentIntensity = getSentimentIntensityScore(candidate);
  const keywordDensity = getKeywordDensityScore(candidate, keywords);
  const speechRate = getSpeechRateScore(candidate);
  const geminiRank = getGeminiRank(candidate, geminiSegment);

  return {
    ...candidate,
    sentimentIntensity,
    keywordDensity,
    speechRate,
    geminiRank,
  };
}

function rankCandidates(candidates, weights = {}) {
  const mergedWeights = {
    sentimentIntensity: 0.25,
    keywordDensity: 0.25,
    speechRate: 0.2,
    geminiRank: 0.3,
    ...weights,
  };

  const scored = candidates.map((candidate) => {
    const combinedScore =
      (candidate.sentimentIntensity || 0) * mergedWeights.sentimentIntensity +
      (candidate.keywordDensity || 0) * mergedWeights.keywordDensity +
      (candidate.speechRate || 0) * mergedWeights.speechRate +
      (candidate.geminiRank || 0) * mergedWeights.geminiRank;

    return {
      ...candidate,
      combinedScore: Math.round(combinedScore * 100) / 100,
      weights: mergedWeights,
    };
  });

  return scored.sort((a, b) => b.combinedScore - a.combinedScore);
}

module.exports = {
  srtTimeToSeconds,
  secondsToSrtTime,
  generateCandidateSegments,
  scoreSegment,
  rankCandidates,
  collectWindowText,
  getWordCount,
};
