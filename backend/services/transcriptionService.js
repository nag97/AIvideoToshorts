const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

function parseSRT(data) {
  // Normalize all line endings first
  const normalized = data.replace(/\r/g, "");

  const blocks = normalized.split("\n\n");
  const subtitles = [];

  blocks.forEach((block) => {
    const lines = block.split("\n").filter(line => line.trim() !== "");

    if (lines.length >= 3) {
      const index = parseInt(lines[0].trim());
      const [start, end] = lines[1].split(" --> ");

      const text = lines
        .slice(2)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      subtitles.push({
        index,
        start: start.trim(),
        end: end.trim(),
        text,
      });
    }
  });

  return subtitles;
}


exports.transcribeAudio = (audioPath) => {
  return new Promise((resolve, reject) => {
    const audioFullPath = path.resolve(audioPath);
    const outputDir = path.dirname(audioFullPath);
    const outputPath = audioFullPath.replace(
      path.extname(audioFullPath),
      ".srt"
    );

    const cmd = `whisper "${audioFullPath}" --model base --output_format srt --output_dir "${outputDir}" --language en`;

    exec(cmd, (error) => {
      if (error) return reject(error);

      if (!fs.existsSync(outputPath)) {
        return reject(new Error("SRT file not created"));
      }

      fs.readFile(outputPath, "utf8", (err, data) => {
        if (err) return reject(err);

        const parsedSubtitles = parseSRT(data);
        resolve({
          subtitles: parsedSubtitles,
          srtPath: outputPath
        });

      });
    });
  });
};
