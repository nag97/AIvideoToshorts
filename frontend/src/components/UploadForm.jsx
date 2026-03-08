import { useState } from "react";
import { uploadVideo, watchJobProgress } from "../services/api";

function UploadForm({ onSuccess, setLoading, setError }) {
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a video file.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      // Step 1: Upload and get jobId
      console.log("🚀 Uploading video...");
      const uploadResponse = await uploadVideo(file);
      console.log("✅ Upload successful, tracking job...");

      // Step 2: Watch job progress
      const result = await watchJobProgress(
        uploadResponse.jobId,
        2000,
        (job) => {
          console.log(`Progress: ${job.progress}% - ${job.step}`);
        },
      );

      console.log("✅ Processing complete!");
      onSuccess(result);
    } catch (error) {
      console.error(error);
      setError(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          error?.message ||
          "Upload failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Upload Long Video</h2>
      <form onSubmit={handleSubmit} className="upload-form">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button type="submit">Generate Short</button>
      </form>
    </div>
  );
}

export default UploadForm;
