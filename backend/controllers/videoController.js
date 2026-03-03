const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");
const { timestampToSeconds } = require("../utils/timeUtils");
const { createClip } = require("../services/clipService");
const { getBestSegment } = require("../services/highlightService");

function buildTimestampedTranscript(subtitles) {
  return subtitles
    .map((s) => `${s.start} --> ${s.end}\n${s.text}`)
    .join("\n\n");
}

// Helper: Convert seconds to SRT timestamp HH:MM:SS,mmm
function secondsToTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// Helper: Parse SRT file and return array of { start, end, text }
function parseSRT(srtPath) {
  const content = fs.readFileSync(srtPath, "utf-8");
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
  const subtitles = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    const [startStr, endStr] = timeLine.split(" --> ").map((t) => t.trim());
    const text = lines.slice(2).join("\n").trim();

    subtitles.push({
      start: startStr,
      end: endStr,
      text: text,
    });
  }

  return subtitles;
}

// Create segment-specific SRT: trim, shift, and reindex
function createSegmentSrt(originalSrtPath, startSeconds, duration, outDir) {
  const subtitles = parseSRT(originalSrtPath);
  const endSeconds = startSeconds + duration;

  const filtered = subtitles
    .map((sub) => ({
      startSec: timestampToSeconds(sub.start),
      endSec: timestampToSeconds(sub.end),
      text: sub.text,
    }))
    .filter((sub) => sub.endSec > startSeconds && sub.startSec < endSeconds);

  if (filtered.length === 0) {
    console.log(
      "SEGMENT SRT: No overlapping subtitles found, returning original",
    );
    return originalSrtPath;
  }

  const shifted = filtered.map((sub) => ({
    startSec: Math.max(0, sub.startSec - startSeconds),
    endSec: Math.min(duration, sub.endSec - startSeconds),
    text: sub.text,
  }));

  let srtContent = "";
  shifted.forEach((sub, idx) => {
    srtContent += `${idx + 1}\n`;
    srtContent += `${secondsToTimestamp(sub.startSec)} --> ${secondsToTimestamp(sub.endSec)}\n`;
    srtContent += `${sub.text}\n\n`;
  });

  const segmentSrtPath = path.join(outDir, `segment_${Date.now()}.srt`);
  fs.writeFileSync(segmentSrtPath, srtContent, "utf-8");
  console.log("SEGMENT SRT:", segmentSrtPath);

  return segmentSrtPath;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("video");

exports.uploadVideo = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(500).json({
        error: "Upload failed",
        details: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    let videoPath = null;
    let audioPath = null;

    try {
      videoPath = req.file.path;
      console.log("UPLOAD: file saved:", videoPath);

      console.time("extractAudio");
      audioPath = await extractAudio(videoPath);
      console.timeEnd("extractAudio");
      console.log("AUDIO:", audioPath);

      console.time("transcribeAudio");
      const { subtitles, srtPath } = await transcribeAudio(audioPath);
      console.timeEnd("transcribeAudio");
      console.log("SRT:", srtPath, "subtitles:", subtitles?.length || 0);

      if (!subtitles || subtitles.length === 0) {
        throw new Error("No subtitles generated");
      }

      const transcriptForModel = buildTimestampedTranscript(subtitles);

      console.time("getBestSegment");
      const best = await getBestSegment(transcriptForModel);
      console.timeEnd("getBestSegment");
      console.log("PICKED:", best);

      const startSeconds = Math.max(0, timestampToSeconds(best.start_ts));
      const endSeconds = Math.max(
        startSeconds + 1,
        timestampToSeconds(best.end_ts),
      );

      const duration = Math.min(60, Math.max(5, endSeconds - startSeconds));

      const outputDir = path.join(__dirname, "../outputs");
      if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `short_${Date.now()}.mp4`);

      // Generate segment-specific SRT (trimmed + time-shifted)
      const segmentSrtPath = createSegmentSrt(
        srtPath,
        startSeconds,
        duration,
        outputDir,
      );

      console.time("createClip");
      const finalVideoPath = await createClip(
        videoPath,
        outputPath,
        startSeconds,
        duration,
        segmentSrtPath,
      );
      console.timeEnd("createClip");
      console.log("FINAL:", finalVideoPath);

      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      const filename = path.basename(finalVideoPath);
      const shortUrl = `${req.protocol}://${req.get("host")}/outputs/${encodeURIComponent(filename)}`;

      return res.status(200).json({
        message: "Short generated successfully",
        shortPath: finalVideoPath,
        shortUrl: shortUrl,
        pickedSegment: best,
        durationSeconds: duration,
      });
    } catch (error) {
      console.error("PROCESSING ERROR:", error);

      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      return res.status(500).json({
        error: "Processing failed",
        details: error.message,
      });
    }
  });
};
