const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

exports.transcribeAudio = (audioPath) => {
  return new Promise((resolve, reject) => {
    const audioFullPath = path.resolve(audioPath);
    const outputDir = path.dirname(audioFullPath);
    const outputPath = audioFullPath.replace(path.extname(audioFullPath), ".txt");

    const cmd = `whisper "${audioFullPath}" --model base --output_format txt --output_dir "${outputDir}" --language en`;

    console.log("Running Whisper:", cmd);

    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(error);

      if (!fs.existsSync(outputPath)) {
        return reject(new Error("Whisper did not create transcript file"));
      }

      fs.readFile(outputPath, "utf8", (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  });
};
