const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

function escapeForFFmpegPath(p) {
  return p.replace(/\\/g, "/").replace(":", "\\:");
}

function timestampToASS(timestamp) {
  const clean = timestamp.replace(/\r/g, "").trim();
  const [hh, mm, rest] = clean.split(":");
  const [ss, ms = "000"] = rest.split(",");
  const cs = ms.padEnd(3, "0").slice(0, 2); // centiseconds
  return `${Number(hh)}:${mm}:${ss}.${cs}`;
}

function wrapText(text, maxChars = 18, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;

    if (test.length <= maxChars) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;

      if (lines.length === maxLines - 1) {
        const remainingWords = [current, ...words.slice(words.indexOf(word) + 1)];
        current = remainingWords.join(" ");
        break;
      }
    }
  }

  if (current) lines.push(current);

  return lines.slice(0, maxLines).join("\\N");
}

function enhanceSubtitleStyling(srtPath) {
  const assPath = srtPath.replace(/\.srt$/i, "_styled.ass");

  const assHeader = `[Script Info]
Title: ShortifyAI
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,30,&H0000D7FF,&H0000D7FF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,2,1,2,80,80,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const srtContent = fs.readFileSync(srtPath, "utf8").replace(/\r/g, "");
  const blocks = srtContent.split(/\n\s*\n/).filter(Boolean);

  let assEvents = "";

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    if (!timeLine.includes(" --> ")) continue;

    const [startRaw, endRaw] = timeLine.split(" --> ");
    const start = timestampToASS(startRaw);
    const end = timestampToASS(endRaw);

    const text = lines.slice(2).join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const wrapped = wrapText(text, 18, 2)
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}");

    assEvents += `Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapped}\n`;
  }

  fs.writeFileSync(assPath, assHeader + assEvents, "utf8");
  return assPath;
}

function createClip(inputPath, outputPath, startTime, duration, srtPath) {
  return new Promise((resolve, reject) => {
    const inPath = path.resolve(inputPath);
    const outPath = path.resolve(outputPath);

    let assPath;
    try {
      assPath = enhanceSubtitleStyling(srtPath);
      console.log(`[ClipService] ASS subtitle file: ${assPath}`);
    } catch (err) {
      return reject(new Error(`Failed to build ASS subtitles: ${err.message}`));
    }

    const assEscaped = escapeForFFmpegPath(path.resolve(assPath));

    const filterComplex =
      `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,boxblur=20:10,crop=1080:1920[bg];` +
      `[0:v]scale=980:-2[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2[base];` +
      `[base]ass='${assEscaped}'[vout]`;

    const command =
      `ffmpeg -ss ${startTime} -i "${inPath}" -t ${duration} ` +
      `-filter_complex "${filterComplex}" ` +
      `-map "[vout]" -map 0:a:0? ` +
      `-c:v libx264 -preset veryfast -crf 23 -c:a aac -y "${outPath}"`;

    console.log("[ClipService] Running FFmpeg...");
    console.log(command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr || error.message);
        return reject(new Error(stderr || error.message));
      }
      resolve(outPath);
    });
  });
}

module.exports = { createClip };