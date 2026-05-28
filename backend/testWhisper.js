// testWhisper.js
require("dotenv").config();
const { transcribeAudio } = require("./services/transcriptionService");

// replace this with any short mp3 file you have in your uploads folder
const testAudioPath = "./uploads/1772862489829.mp3";

transcribeAudio(testAudioPath)
  .then((result) => {
    console.log("✅ Groq working!");
    console.log(`Subtitles found: ${result.subtitles.length}`);
    console.log("First subtitle:", result.subtitles[0]);
  })
  .catch((err) => {
    console.error("❌ Failed:", err.message);
  });
