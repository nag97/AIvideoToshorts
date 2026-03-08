/**
 * Background video processing worker
 * Handles the complete video processing pipeline with progress tracking
 */

const path = require("path");
const fs = require("fs");
const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");
const { getBestSegment } = require("../services/highlightService");
const { createClip } = require("../services/clipService");
const { timestampToSeconds } = require("../utils/timeUtils");
const { updateJob } = require("../store/jobStore");

/**
 * Helper: Convert seconds to SRT timestamp HH:MM:SS,mmm
 */
function secondsToTimestamp(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Parse SRT file and return array of { start, end, text }
 */
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

/**
 * Build timestamped transcript string from subtitles
 */
function buildTimestampedTranscript(subtitles) {
  return subtitles
    .map((s) => `${s.start} --> ${s.end}\n${s.text}`)
    .join("\n\n");
}

/**
 * Create segment-specific SRT: trim, shift, and reindex
 */
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
      "[VideoProcessor] No overlapping subtitles found, using original SRT",
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
  console.log("[VideoProcessor] Created segment SRT:", segmentSrtPath);

  return segmentSrtPath;
}

/**
 * Process video job in the background with progress tracking
 * @param {string} jobId - Job ID to track progress
 * @param {string} videoPath - Path to uploaded video file
 */
async function processVideoJob(jobId, videoPath) {
  let audioPath = null;

  try {
    // Step 1: Extract audio
    console.log(`[VideoProcessor ${jobId}] Starting audio extraction...`);
    updateJob(jobId, {
      status: "processing",
      progress: 10,
      step: "Extracting audio from video",
    });

    audioPath = await extractAudio(videoPath);
    console.log(`[VideoProcessor ${jobId}] Audio extracted: ${audioPath}`);

    // Step 2: Transcribe audio
    console.log(`[VideoProcessor ${jobId}] Starting transcription...`);
    updateJob(jobId, {
      status: "processing",
      progress: 30,
      step: "Transcribing speech to text",
    });

    const { subtitles, srtPath } = await transcribeAudio(audioPath);
    console.log(`[VideoProcessor ${jobId}] Transcription complete: ${srtPath}`);

    if (!subtitles || subtitles.length === 0) {
      throw new Error("No subtitles generated from audio");
    }

    // Step 3: Select best segment
    console.log(`[VideoProcessor ${jobId}] Selecting best segment...`);
    updateJob(jobId, {
      status: "processing",
      progress: 60,
      step: "Selecting highlight with AI",
    });

    const transcriptForModel = buildTimestampedTranscript(subtitles);
    const best = await getBestSegment(transcriptForModel);
    console.log(`[VideoProcessor ${jobId}] Selected segment:`, best);

    const startSeconds = Math.max(0, timestampToSeconds(best.start_ts));
    const endSeconds = Math.max(
      startSeconds + 1,
      timestampToSeconds(best.end_ts),
    );
    const duration = Math.min(60, Math.max(5, endSeconds - startSeconds));

    // Step 4: Create the final clip
    console.log(`[VideoProcessor ${jobId}] Creating final video clip...`);
    updateJob(jobId, {
      status: "processing",
      progress: 80,
      step: "Rendering video with subtitles",
    });

    const outputDir = path.join(__dirname, "../outputs");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `short_${Date.now()}.mp4`);
    const segmentSrtPath = createSegmentSrt(
      srtPath,
      startSeconds,
      duration,
      outputDir,
    );

    const finalVideoPath = await createClip(
      videoPath,
      outputPath,
      startSeconds,
      duration,
      segmentSrtPath,
    );

    console.log(
      `[VideoProcessor ${jobId}] Final video created:`,
      finalVideoPath,
    );

    // Cleanup audio file
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`[VideoProcessor ${jobId}] Cleaned up audio file`);
    }

    // Build the result URL
    const filename = path.basename(finalVideoPath);
    const shortUrl = `http://localhost:5000/outputs/${encodeURIComponent(
      filename,
    )}`;

    // Mark job as completed
    console.log(`[VideoProcessor ${jobId}] ✅ Processing complete!`);
    updateJob(jobId, {
      status: "completed",
      progress: 100,
      step: "Completed",
      result: {
        success: true,
        shortUrl: shortUrl,
        outputVideo: `/outputs/${encodeURIComponent(filename)}`,
        pickedSegment: best,
        durationSeconds: duration,
      },
    });
  } catch (error) {
    console.error(`[VideoProcessor ${jobId}] ❌ Error:`, error.message);

    // Cleanup audio file if it exists
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        console.error("Failed to cleanup audio:", e.message);
      }
    }

    // Mark job as failed
    updateJob(jobId, {
      status: "failed",
      error: error.message,
      step: "Error - processing failed",
    });
  }
}

module.exports = {
  processVideoJob,
};
