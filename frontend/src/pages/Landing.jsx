import React, { useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ResultDisplay from "../components/ResultDisplay";
import "../styles/landing.css";

const Landing = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleUploadStart = () => {
    console.log("⏳ Upload started");
    setError("");
    setResult(null);
  };

  const handleUploadSuccess = (data) => {
    console.log("✅ Upload successful - result:", data);
    setResult(data);
    setError("");
  };

  const handleUploadError = (errorMsg) => {
    console.log("❌ Upload failed - error:", errorMsg);
    setError(errorMsg);
    setResult(null);
  };

  const handleReset = () => {
    console.log("🔄 Resetting to upload screen");
    setResult(null);
    setError("");
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

      {/* Show Result when upload succeeds */}
      {result && <ResultDisplay result={result} onReset={handleReset} />}
    </div>
  );
};

export default Landing;
