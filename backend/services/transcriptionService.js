const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

function runWhisper(audioFullPath) {
  return new Promise((resolve, reject) => {
    const args = [
      audioFullPath,
      "--output_format",
      "srt",
      "--language",
      "en",
      "--output_dir",
      path.dirname(audioFullPath),
    ];

    console.log(`[Whisper] Starting: whisper ${args.join(" ")}`);
    const whisperProcess = spawn("whisper", args);

    let stderr = "";
    let stdout = "";

    whisperProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.log(`[Whisper stderr] ${data.toString().trim()}`);
    });

    whisperProcess.stdout.on("data", (data) => {
      stdout += data.toString();
      console.log(`[Whisper stdout] ${data.toString().trim()}`);
    });

    whisperProcess.on("error", (err) => {
      console.error(`[Whisper] spawn error: ${err.message}`);
      reject(new Error(`Failed to spawn whisper: ${err.message}`));
    });

    whisperProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`[Whisper] exited with code ${code}`);
        reject(
          new Error(`Whisper exited with code ${code}: ${stderr || stdout}`),
        );
      } else {
        console.log(`[Whisper] completed successfully`);
        resolve(stdout);
      }
    });
  });
}

exports.transcribeAudio = async (audioPath) => {
  const audioFullPath = path.resolve(audioPath);
  console.log(`[Transcription] Starting transcription for: ${audioFullPath}`);

  if (!fs.existsSync(audioFullPath)) {
    throw new Error(`Audio file not found: ${audioFullPath}`);
  }

  const outputPath = audioFullPath.replace(path.extname(audioFullPath), ".srt");

  // Remove old SRT if exists
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[Transcription] Removed old SRT: ${outputPath}`);
  }

  try {
    await runWhisper(audioFullPath);
  } catch (error) {
    console.error(`[Transcription] Whisper failed: ${error.message}`);
    throw error;
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Whisper did not produce SRT at: ${outputPath}`);
  }

  const srtString = fs.readFileSync(outputPath, "utf8");
  if (!srtString.trim()) {
    throw new Error("Generated SRT file is empty");
  }

  const subtitles = parseSRT(srtString);
  if (subtitles.length === 0) {
    throw new Error("No subtitle blocks parsed from SRT");
  }

  console.log(`[Transcription] Success: ${subtitles.length} subtitle blocks`);
  return { subtitles, srtPath: outputPath };
};
