const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

exports.extractAudio = (videoPath) => {
  return new Promise((resolve, reject) => {
    const outputAudioPath = videoPath.replace(".mp4", ".mp3");

    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .save(outputAudioPath)
      .on("end", () => {
        resolve(outputAudioPath);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};
