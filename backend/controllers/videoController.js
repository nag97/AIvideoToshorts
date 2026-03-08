const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { createJob, getJob } = require("../store/jobStore");
const { processVideoJob } = require("../workers/videoProcessor");

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

    try {
      const videoPath = req.file.path;
      console.log("[Upload] File saved:", videoPath);

      // Step 1: Create a job
      const jobId = createJob();
      console.log("[Upload] Created job:", jobId, "for video:", videoPath);

      // Step 2: Return jobId immediately to frontend
      res.status(202).json({
        success: true,
        message: "Video uploaded. Processing started.",
        jobId: jobId,
      });

      // Step 3: Start background processing (fire and forget)
      processVideoJob(jobId, videoPath).catch((err) => {
        console.error(`[Background] Unhandled error in job ${jobId}:`, err);
      });
    } catch (error) {
      console.error("[Upload] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Upload processing failed",
        details: error.message,
      });
    }
  });
};

/**
 * Get the status of a processing job
 * GET /api/video/status/:jobId
 */
exports.getJobStatus = (req, res) => {
  const { jobId } = req.params;

  try {
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: "Job not found",
        jobId: jobId,
      });
    }

    // Return job status (exclude internal fields if needed)
    return res.status(200).json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      step: job.step,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error("[Status] Error:", error);
    return res.status(500).json({
      error: "Failed to fetch job status",
      details: error.message,
    });
  }
};
