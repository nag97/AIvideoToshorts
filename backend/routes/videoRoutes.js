const express = require("express");
const router = express.Router();

const {
  uploadVideo,
  getJobStatus,
  processCallback,
} = require("../controllers/videoController");

// Upload video and queue background processing via QStash
// Returns jobId for polling progress
router.post("/upload", uploadVideo);

// Get job status and progress
// Returns status, progress, step, result, and error (if any)
router.get("/status/:jobId", getJobStatus);

// QStash webhook callback for processing video jobs
// Receives jobId, retrieves videoPath from Redis, and starts the pipeline
router.post("/process-callback", processCallback);

module.exports = router;
