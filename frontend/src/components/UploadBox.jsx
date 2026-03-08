import React, { useState } from "react";
import "../styles/uploadbox.css";
import { uploadVideo, watchJobProgress } from "../services/api";

const UploadBox = ({ onUploadStart, onUploadSuccess, onUploadError }) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const handleUploadVideo = () => {
    console.log("📁 Upload Video button clicked - opening file picker");
    document.getElementById("video-upload").click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log("✅ File selected:", file.name, "Size:", file.size, "bytes");
      setSelectedFile(file);
      setInputValue(file.name);
      setError("");
    }
  };

  const handleGenerateShorts = async () => {
    console.log("🎬 Generate Shorts button clicked");

    if (!selectedFile) {
      const errorMsg = "Please upload a video file first";
      console.error("❌ Error:", errorMsg);
      setError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError("");
    setProgress(0);
    setCurrentStep("");

    // Notify parent that upload is starting
    if (onUploadStart) onUploadStart();

    try {
      console.log("🚀 Uploading video file to /api/video/upload");
      console.log("📤 File:", selectedFile.name);

      // Step 1: Upload and get jobId
      const uploadResponse = await uploadVideo(selectedFile);
      console.log("✅ Upload successful, jobId:", uploadResponse.jobId);

      const { jobId } = uploadResponse;

      // Step 2: Watch job progress
      console.log("👀 Starting to watch job progress...");
      const result = await watchJobProgress(jobId, 2000, (job) => {
        console.log(`📊 Progress update: ${job.progress}% - ${job.step}`);
        setProgress(job.progress);
        setCurrentStep(job.step);
      });

      console.log("✅ Processing complete! Result:", result);
      console.log("📹 Video URL:", result.shortUrl);

      // Step 3: Pass final result to parent
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // Clear form
      setInputValue("");
      setSelectedFile(null);
      setProgress(100);
    } catch (err) {
      const errorMessage =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload or processing failed";
      console.error("❌ Error:", errorMessage);
      console.error("Full error:", err);
      setError(errorMessage);

      // Notify parent of error
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-box-container">
      {/* Error Display */}
      {error && <div className="error-message">{error}</div>}

      {/* Input Section */}
      <div className="upload-box">
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Paste YouTube or video link"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="video-input"
            readOnly={selectedFile !== null}
            title={selectedFile ? `Selected file: ${selectedFile.name}` : ""}
            onKeyPress={(e) => e.key === "Enter" && handleGenerateShorts()}
          />
        </div>

        {/* Buttons */}
        <div className="button-group">
          <button
            className="btn-primary"
            onClick={handleGenerateShorts}
            disabled={isLoading || !selectedFile}
            type="button"
          >
            {isLoading ? "Processing..." : "Generate Shorts"}
          </button>
          <button
            className="btn-secondary"
            onClick={handleUploadVideo}
            disabled={isLoading}
            type="button"
          >
            Upload Video
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          id="video-upload"
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

      {/* Animated Gradient Bar */}
      <div className="gradient-bar">
        <div className="gradient-animation"></div>
      </div>

      {/* Processing Progress */}
      {isLoading && progress > 0 && (
        <div className="progress-display">
          <div className="progress-info">
            <span className="progress-label">{progress}%</span>
            <span className="progress-step">{currentStep}</span>
          </div>
          <div className="progress-bar-wrapper">
            <div className="progress-bar-background">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      <p className="upload-info">
        AI-powered processing • Fast & accurate • Try for free
      </p>
    </div>
  );
};

export default UploadBox;
