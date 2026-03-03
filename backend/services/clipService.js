const { exec } = require("child_process");
const path = require("path");

function escapeForFFmpegPath(p) {
  // FFmpeg subtitles filter likes forward slashes; escape drive colon on Windows
  return p.replace(/\\/g, "/").replace(":", "\\:");
}

/**
 * Create a vertical short + burn subtitles
 * @param {string} inputPath  - original video path
 * @param {string} outputPath - final mp4 path
 * @param {number} startTime  - seconds
 * @param {number} duration   - seconds
 * @param {string} srtPath    - subtitle file path
 */
function createClip(inputPath, outputPath, startTime, duration, srtPath) {
  return new Promise((resolve, reject) => {
    const inPath = path.resolve(inputPath);
    const outPath = path.resolve(outputPath);
    const srtEscaped = escapeForFFmpegPath(path.resolve(srtPath));

    const vf = [
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      `subtitles='${srtEscaped}'`
    ].join(",");

    const command =
      `ffmpeg -ss ${startTime} -i "${inPath}" -t ${duration} ` +
      `-vf "${vf}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -y "${outPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(outPath);
    });
  });
}

module.exports = { createClip };