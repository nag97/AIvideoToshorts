const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function parseSRT(data) {
  const normalized = data.replace(/\r/g, "");
  const blocks = normalized.split("\n\n");
  const subtitles = [];

  blocks.forEach((block) => {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length >= 3) {
      const index = parseInt(lines[0].trim(), 10);
      const [start, end] = lines[1].split(" --> ");
      const text = lines.slice(2).join(" ").replace(/\s+/g, " ").trim();

      subtitles.push({
        index,
        start: (start || "").trim(),
        end: (end || "").trim(),
        text,
      });
    }
  });

  return subtitles;
}

// Converts seconds (float) to SRT timestamp format HH:MM:SS,mmm
function secondsToSRTTime(seconds) {
  const ms = Math.round((seconds % 1) * 1000);
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// Converts Groq verbose_json segments into SRT string
function segmentsToSRT(segments) {
  return segments
    .map((seg, i) => {
      const start = secondsToSRTTime(seg.start);
      const end = secondsToSRTTime(seg.end);
      return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}`;
    })
    .join("\n\n");
}

exports.transcribeAudio = async (audioPath) => {
  const audioFullPath = path.resolve(audioPath);
  console.log(`[Transcription] Starting transcription for: ${audioFullPath}`);

  if (!fs.existsSync(audioFullPath)) {
    throw new Error(`Audio file not found: ${audioFullPath}`);
  }

  const outputPath = audioFullPath.replace(path.extname(audioFullPath), ".srt");

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[Transcription] Removed old SRT: ${outputPath}`);
  }

  console.log(`[Transcription] Sending to Groq Whisper API...`);

  try {
    const response = await groq.audio.transcriptions.create({
      file: fs.createReadStream(audioFullPath),
      model: "whisper-large-v3",
      response_format: "verbose_json", // Groq supports this
      language: "en",
    });

    // response.segments contains [{start, end, text}, ...]
    if (!response.segments || response.segments.length === 0) {
      throw new Error("Groq returned no segments");
    }

    // Convert segments to SRT format
    const srtString = segmentsToSRT(response.segments);

    // Save SRT file so rest of pipeline works exactly as before
    fs.writeFileSync(outputPath, srtString, "utf8");
    console.log(`[Transcription] SRT saved to: ${outputPath}`);

    const subtitles = parseSRT(srtString);
    if (subtitles.length === 0) {
      throw new Error("No subtitle blocks parsed from SRT");
    }

    console.log(`[Transcription] Success: ${subtitles.length} subtitle blocks`);
    return { subtitles, srtPath: outputPath };
  } catch (error) {
    console.error(`[Transcription] Groq API failed: ${error.message}`);
    throw error;
  }
};
