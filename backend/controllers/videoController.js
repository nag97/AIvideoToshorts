const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Client } = require("@upstash/qstash");

const { createJob, getJob } = require("../store/jobStore");

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
      const filename = req.file.originalname;
      console.log("[Upload] File saved:", videoPath);

      // Step 1: Create a job in Redis with videoPath and filename stored
      const jobId = await createJob({
        videoPath: videoPath,
        filename: filename,
      });
      console.log("[Upload] Created job:", jobId, "for video:", videoPath);

      // Step 2: Publish to QStash to invoke the webhook
      try {
        const qstash = new Client({
          token: process.env.QSTASH_TOKEN,
        });

        if (!process.env.BACKEND_PUBLIC_URL) {
          throw new Error(
            "BACKEND_PUBLIC_URL environment variable not set for QStash webhook",
          );
        }

        const callbackUrl = `${process.env.BACKEND_PUBLIC_URL}/api/video/process-callback`;
        console.log(
          "[Upload] Publishing to QStash. Callback URL:",
          callbackUrl,
        );

        // Publish a message to QStash pointing to the webhook
        await qstash.publishJSON({
          url: callbackUrl,
          body: { jobId: jobId },
        });

        console.log("[Upload] Published to QStash for jobId:", jobId);
      } catch (qstashErr) {
        console.error("[Upload] QStash publish error:", qstashErr.message);
        // Mark job as failed if we can't queue it
        // This is best-effort; job will still exist in Redis
        throw qstashErr;
      }

      // Step 3: Return jobId immediately to frontend
      res.status(202).json({
        success: true,
        message: "Video uploaded. Processing queued.",
        jobId: jobId,
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
exports.getJobStatus = async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await getJob(jobId);

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

/**
 * QStash webhook callback to process video job
 * POST /api/video/process-callback
 * Verifies QStash signature and calls the video processing pipeline
 */
exports.processCallback = async (req, res) => {
  try {
    const { Receiver } = require("@upstash/qstash");

    // Verify the QStash signature
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });

    const signature = req.headers["upstash-signature"];
    if (!signature) {
      console.warn("[ProcessCallback] Missing Upstash signature header");
      return res.status(401).json({ error: "Unauthorized: missing signature" });
    }

    // Get the raw body as a string for verification
    let body = req.body;
    if (typeof body !== "string") {
      body = JSON.stringify(body);
    }

    try {
      await receiver.verify({
        signature: signature,
        body: body,
      });
    } catch (verifyErr) {
      console.warn(
        "[ProcessCallback] Signature verification failed:",
        verifyErr.message,
      );
      return res.status(401).json({
        error: "Unauthorized: invalid signature",
        details: verifyErr.message,
      });
    }

    console.log("[ProcessCallback] ✓ QStash signature verified");

    // Extract jobId from the payload
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { jobId } = payload;

    if (!jobId) {
      console.error("[ProcessCallback] Missing jobId in payload");
      return res.status(400).json({ error: "Missing jobId in payload" });
    }

    console.log("[ProcessCallback] Processing jobId:", jobId);

    // Retrieve job and videoPath from Redis
    const job = await getJob(jobId);
    if (!job) {
      console.error("[ProcessCallback] Job not found:", jobId);
      return res.status(404).json({ error: "Job not found", jobId });
    }

    const { videoPath } = job;
    if (!videoPath) {
      console.error("[ProcessCallback] No videoPath found in job:", jobId);
      return res.status(400).json({
        error: "No videoPath found in job",
        jobId,
      });
    }

    console.log("[ProcessCallback] Retrieved videoPath:", videoPath);

    // Respond to QStash immediately (202 Accepted)
    // Processing happens asynchronously
    res.status(202).json({
      success: true,
      message: "Processing job queued",
      jobId: jobId,
    });

    // Start the processing pipeline asynchronously
    // Import here to avoid circular dependency
    const { processVideoJob } = require("../workers/videoProcessor");

    processVideoJob(jobId, videoPath)
      .then(() => {
        console.log(
          "[ProcessCallback] Job processing completed successfully:",
          jobId,
        );

        // Cleanup: delete uploaded video file (best effort)
        try {
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
            console.log("[ProcessCallback] Cleaned up video file:", videoPath);
          }
        } catch (cleanupErr) {
          console.error(
            "[ProcessCallback] Error cleaning up video file:",
            cleanupErr.message,
          );
          // Don't fail the job because of cleanup error
        }
      })
      .catch((err) => {
        console.error(
          `[ProcessCallback] Unhandled error processing job ${jobId}:`,
          err,
        );
        // Job error is already recorded in Redis by processVideoJob
      });
  } catch (error) {
    console.error("[ProcessCallback] Unexpected error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
