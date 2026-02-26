const multer = require("multer");
const path = require("path");

const { extractAudio } = require("../services/ffmpegService");
const { transcribeAudio } = require("../services/transcriptionService");

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage }).single("video");

// 👇 THIS is uploadVideo
exports.uploadVideo = (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const videoPath = req.file.path;

      // Step 1: Extract audio
      const audioPath = await extractAudio(videoPath);

      // Step 2: Transcribe audio
      const transcript = await transcribeAudio(audioPath);

      return res.status(200).json({
        message: "Transcription complete",
        transcript,
      });

    } catch (error) {
      console.error("Processing error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
};
