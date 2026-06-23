/**
 * Background video processing worker
 * Handles the complete video processing pipeline with progress tracking
 */

const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");
const { getBestSegment } = require("../services/highlightService");
const { createClip } = require("../services/clipService");
const { timestampToSeconds } = require("../utils/timeUtils");
const { updateJob } = require("../store/jobStore");

const outputDir = path.join(__dirname, "../outputs");
const uploadDir = path.join(__dirname, "../uploads");

// Create directories if they don't exist
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
    console.log(`[VideoProcessor ${jobId}] ======== PIPELINE START ========`);
    console.log(`[VideoProcessor ${jobId}] Input video: ${videoPath}`);

    // Validate uploaded video contains a video stream before doing any audio or AI work
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 1/6] Validating uploaded video stream...`,
    );
    await updateJob(jobId, {
      status: "processing",
      progress: 5,
      step: "Validating uploaded video",
    });

    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    const hasVideoStream = Array.isArray(metadata.streams)
      ? metadata.streams.some((stream) => stream.codec_type === "video")
      : false;

    if (!hasVideoStream) {
      const validationError =
        "Uploaded file does not contain a video stream. Please upload a video file.";
      console.error(
        `[VideoProcessor ${jobId}] Validation failed: ${validationError}`,
      );
      await updateJob(jobId, {
        status: "failed",
        progress: 0,
        step: "Error - invalid upload",
        error: validationError,
      });
      return;
    }

    console.log(
      `[VideoProcessor ${jobId}] [STAGE 1/6] ✓ Video stream validation passed`,
    );

    // Step 2: Extract audio
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 2/6] Starting audio extraction...`,
    );
    await updateJob(jobId, {
      status: "processing",
      progress: 10,
      step: "Extracting audio from video",
    });

    audioPath = await extractAudio(videoPath);
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 2/6] ✓ Audio extracted: ${audioPath}`,
    );

    // Step 2: Transcribe audio
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 2/5] Starting transcription...`,
    );
    await updateJob(jobId, {
      status: "processing",
      progress: 30,
      step: "Transcribing speech to text",
    });

    const { subtitles, srtPath } = await transcribeAudio(audioPath);
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 2/5] ✓ Transcription complete: ${srtPath}`,
    );
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 2/5] Generated ${subtitles?.length || 0} subtitle entries`,
    );

    if (!subtitles || subtitles.length === 0) {
      throw new Error("No subtitles generated from audio");
    }

    // Step 3: Select best segment
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 3/5] Selecting best highlight segment...`,
    );
    await updateJob(jobId, {
      status: "processing",
      progress: 60,
      step: "Selecting highlight with AI",
    });

    const transcriptForModel = buildTimestampedTranscript(subtitles);
    const best = await getBestSegment(transcriptForModel);
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 3/5] ✓ Selected segment:`,
      best,
    );

    const startSeconds = Math.max(0, timestampToSeconds(best.start_ts));
    const endSeconds = Math.max(
      startSeconds + 1,
      timestampToSeconds(best.end_ts),
    );
    const duration = Math.min(60, Math.max(5, endSeconds - startSeconds));
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 3/5] Segment: start=${startSeconds}s, end=${endSeconds}s, duration=${duration}s`,
    );

    // Step 4: Create the final clip
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 4/5] Creating final video clip with subtitles...`,
    );
    await updateJob(jobId, {
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
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 4/5] Using SRT: ${segmentSrtPath}`,
    );

    const finalVideoPath = await createClip(
      videoPath,
      outputPath,
      startSeconds,
      duration,
      segmentSrtPath,
    );

    console.log(
      `[VideoProcessor ${jobId}] [STAGE 4/5] ✓ Final video created: ${finalVideoPath}`,
    );

    // Step 5: Finalization
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 5/5] Finalizing and cleaning up...`,
    );

    // Cleanup audio file
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(
        `[VideoProcessor ${jobId}] [STAGE 5/5] Cleaned up audio file`,
      );
    }

    // Build the result URL
    const filename = path.basename(finalVideoPath);
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const shortUrl = `${baseUrl}/outputs/${encodeURIComponent(filename)}`;
    console.log(
      `[VideoProcessor ${jobId}] [STAGE 5/5] Output URL: ${shortUrl}`,
    );

    // Mark job as completed
    console.log(
      `[VideoProcessor ${jobId}] ✅ PIPELINE COMPLETE! Processing took approximately ${Math.round((Date.now() - new Date(Date.parse(new Date().toISOString()))) / 1000)} seconds`,
    );
    await updateJob(jobId, {
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
    console.log(`[VideoProcessor ${jobId}] Job state updated in Redis`);
  } catch (error) {
    console.error(
      `[VideoProcessor ${jobId}] ❌ PIPELINE FAILED! Error:`,
      error.message,
    );
    console.error(`[VideoProcessor ${jobId}] Error stack:`, error.stack);

    // Cleanup audio file if it exists
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (e) {
        console.error(
          `[VideoProcessor ${jobId}] Error cleaning up audio:`,
          e.message,
        );
      }
    }

    // Mark job as failed
    await updateJob(jobId, {
      status: "failed",
      error: error.message,
      step: "Error - processing failed",
    });
    console.log(`[VideoProcessor ${jobId}] Job marked as failed in Redis`);
  }
}

module.exports = {
  processVideoJob,
};
