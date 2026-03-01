const multer = require("multer");
const path = require("path");
const fs = require("fs");


function formatPathForFFmpeg(filePath) {
  return filePath
    .replace(/\\/g, "/")       // convert \ to /
    .replace("C:", "C\\\\:");  // escape drive colon
}


const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");
const { timestampToSeconds } = require("../utils/timeUtils");
const { createClip } = require("../services/clipService");

/*
|--------------------------------------------------------------------------
| Multer Storage Configuration
|--------------------------------------------------------------------------
*/

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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
}).single("video");

/*
|--------------------------------------------------------------------------
| Upload + Process Controller
|--------------------------------------------------------------------------
*/

exports.uploadVideo = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(500).json({
        error: "Upload failed",
        details: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "No video file uploaded",
      });
    }

    let videoPath = null;
    let audioPath = null;

    try {
      videoPath = req.file.path;
      console.log("Video Uploaded:", videoPath);

      /*
      |--------------------------------------------------------------------------
      | Step 1: Extract Audio
      |--------------------------------------------------------------------------
      */
      audioPath = await extractAudio(videoPath);
      console.log("Audio Extracted:", audioPath);

      /*
      |--------------------------------------------------------------------------
      | Step 2: Transcribe Audio (returns subtitles + srtPath)
      |--------------------------------------------------------------------------
      */
      const result = await transcribeAudio(audioPath);

      const subtitles = result.subtitles;
      const srtPath = result.srtPath;

      if (!subtitles || subtitles.length === 0) {
        throw new Error("No subtitles generated");
      }

      /*
      |--------------------------------------------------------------------------
      | Step 3: Pick First Meaningful Segment (>4 words)
      |--------------------------------------------------------------------------
      */
      const validSubs = subtitles.filter(
        (sub) => sub.text.split(" ").length > 4
      );

      if (validSubs.length === 0) {
        throw new Error("No strong subtitle segments found");
      }

      const firstSegment = validSubs[0];

      const startSeconds = timestampToSeconds(firstSegment.start);
      const endSeconds = startSeconds + 30; // 30-second short

      /*
      |--------------------------------------------------------------------------
      | Step 4: Create Vertical Short + Burn Subtitles
      |--------------------------------------------------------------------------
      */
      const finalVideoPath = await createClip(
        videoPath,
        startSeconds,
        endSeconds,
        srtPath
      );

      console.log("Short Created:", finalVideoPath);

      /*
      |--------------------------------------------------------------------------
      | Step 5: Cleanup Temp Audio (Keep Final Short)
      |--------------------------------------------------------------------------
      */
      if (audioPath && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      return res.status(200).json({
        message: "Short generated successfully",
        shortPath: finalVideoPath,
      });

    } catch (error) {
      console.error("Processing error:", error);

      if (audioPath && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }

      return res.status(500).json({
        error: "Processing failed",
        details: error.message,
      });
    }
  });
};