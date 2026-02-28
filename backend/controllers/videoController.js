const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");

// ✅ Correct storage path (always backend/uploads)
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

// 🎯 Main Upload + Process Function
exports.uploadVideo = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    let videoPath;
    let audioPath;

    try {
      videoPath = req.file.path;

      // Step 1: Extract audio
      audioPath = await extractAudio(videoPath);

      // Step 2: Transcribe audio (local Whisper)
      const transcript = await transcribeAudio(audioPath);

      // Step 3: Cleanup files after processing
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      return res.status(200).json({
        message: "Transcription complete",
        transcript,
      });

    } catch (error) {
      console.error("Processing error:", error);

      // Cleanup even if error occurs
      if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

      return res.status(500).json({ error: "Processing failed" });
    }
  });
};