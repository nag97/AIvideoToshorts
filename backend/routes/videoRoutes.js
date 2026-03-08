const express = require("express");
const router = express.Router();

const { uploadVideo, getJobStatus } = require("../controllers/videoController");

// Upload video and start background processing
// Returns jobId for polling progress
router.post("/upload", uploadVideo);

// Get job status and progress
// Returns status, progress, step, result, and error (if any)
router.get("/status/:jobId", getJobStatus);

module.exports = router;
