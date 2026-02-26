const express = require("express");
const router = express.Router();
const { uploadVideo } = require("../controllers/videoController");

router.post("/upload", uploadVideo);

module.exports = router;
