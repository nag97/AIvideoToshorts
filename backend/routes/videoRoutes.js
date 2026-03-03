const express = require("express");
const router = express.Router();

const { uploadVideo } = require("../controllers/videoController");

// final route: POST /api/video/upload
router.post("/upload", uploadVideo);

module.exports = router;