import React, { useState } from "react";
import "../styles/uploadbox.css";
import api from "../services/api";

const UploadBox = ({ onUploadStart, onUploadSuccess, onUploadError }) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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

    // Notify parent that upload is starting
    if (onUploadStart) onUploadStart();

    try {
      console.log("🚀 Starting upload request to /api/video/upload");
      console.log("📤 Sending file:", selectedFile.name);

      const formData = new FormData();
      formData.append("video", selectedFile);

      const response = await api.post("/api/video/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("✅ Response received from backend:", response.data);
      console.log("🎥 Result object:", response.data);

      if (!response.data || !response.data.shortUrl) {
        throw new Error("Invalid response: missing video URL");
      }

      console.log("📹 Video URL ready:", response.data.shortUrl);

      // Notify parent with result
      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }

      // Clear form
      setInputValue("");
      setSelectedFile(null);
    } catch (err) {
      const errorMessage =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "Upload failed";
      console.error("❌ Upload error:", errorMessage);
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

      {/* Processing Indicator */}
      <p className="upload-info">
        AI-powered processing • Fast & accurate • Try for free
      </p>
    </div>
  );
};

export default UploadBox;
