import React, { useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ProgressBar from "../components/ProgressBar";
import ResultDisplay from "../components/ResultDisplay";
import "../styles/landing.css";

const Landing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUploadStart = () => {
    console.log("⏳ Upload started - showing progress bar");
    setIsProcessing(true);
    setError("");
    setResult(null);
  };

  const handleUploadSuccess = (data) => {
    console.log("✅ Upload successful - result:", data);
    setIsProcessing(false);
    setResult(data);
    setError("");
  };

  const handleUploadError = (errorMsg) => {
    console.log("❌ Upload failed - error:", errorMsg);
    setIsProcessing(false);
    setError(errorMsg);
    setResult(null);
  };

  const handleReset = () => {
    console.log("🔄 Resetting to upload screen");
    setResult(null);
    setError("");
    setIsProcessing(false);
  };

  return (
    <div className="landing-page">
      <Navbar />

      {/* Show Hero during idle or processing */}
      {!result && (
        <Hero
          onUploadStart={handleUploadStart}
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />
      )}

      {/* Show Progress Bar while processing */}
      {isProcessing && (
        <div className="progress-section">
          <ProgressBar
            isProcessing={true}
            message="Please wait, processing your video..."
          />
        </div>
      )}

      {/* Show Error if upload failed */}
      {error && !isProcessing && (
        <div className="error-section">
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Show Result when upload succeeds */}
      {result && <ResultDisplay result={result} onReset={handleReset} />}
    </div>
  );
};

export default Landing;
