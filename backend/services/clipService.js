const { exec } = require("child_process");
const path = require("path");

exports.createClip = (videoPath, startTime, endTime, srtPath) => {
  return new Promise((resolve, reject) => {
    const basePath = videoPath.replace(path.extname(videoPath), "");

    const clipPath = `${basePath}_clip.mp4`;
    const finalPath = `${basePath}_short.mp4`;

    /*
    |--------------------------------------------------------------------------
    | Step 1: Cut Clip
    |--------------------------------------------------------------------------
    */

    const cutCmd = `ffmpeg -i "${videoPath}" -ss ${startTime} -to ${endTime} -c copy "${clipPath}" -y`;

    console.log("Cut Command:", cutCmd);

    exec(cutCmd, (cutError) => {
      if (cutError) {
        console.error("FFmpeg Cut Error:", cutError);
        return reject(cutError);
      }

      /*
      |--------------------------------------------------------------------------
      | Step 2: Burn Subtitles + Vertical Format (Windows Safe)
      |--------------------------------------------------------------------------
      */

      // Normalize path for ffmpeg subtitles filter: use forward slashes,
      // escape the drive-colon (C:\ -> C\:) and wrap in single quotes.
      const escapedSrtPath = srtPath
        .replace(/\\/g, "/")
        .replace(/^([A-Za-z]):/, "$1\\:");

      const burnCmd = `ffmpeg -i "${clipPath}" -vf "scale=1080:1920,subtitles='${escapedSrtPath}'" -c:a copy "${finalPath}" -y`;

      console.log("Burn Command:", burnCmd);

      exec(burnCmd, (burnError) => {
        if (burnError) {
          console.error("FFmpeg Burn Error:", burnError);
          return reject(burnError);
        }

        resolve(finalPath);
      });
    });
  });
};
