import React from "react";
import "../styles/resultdisplay.css";

const ResultDisplay = ({ result, onReset }) => {
  if (!result) return null;

  console.log("🎥 Rendering result with:", result);
  console.log("📹 Video URL:", result.shortUrl || result.outputVideo);

  // Construct video URL with fallback
  const videoUrl = result.shortUrl || result.outputVideo;

  if (!videoUrl) {
    console.error("❌ No video URL found in result:", result);
    return (
      <div className="result-display-container">
        <div className="result-wrapper">
          <div className="error-message">
            No video URL found. Processing may have failed.
          </div>
          <button className="btn-new-upload" onClick={onReset}>
            ➕ Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="result-display-container">
      <div className="result-wrapper">
        <h2 className="result-title">Your Generated Short</h2>

        {/* Video Player */}
        {videoUrl && (
          <div className="video-container">
            <video
              controls
              className="result-video-player"
              poster={result.thumbnail}
              onLoadStart={() =>
                console.log("📹 Video loading started:", videoUrl)
              }
              onCanPlay={() => console.log("✅ Video can play")}
              onError={(e) => console.error("❌ Video error:", e)}
            >
              <source src={videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {/* Metadata */}
        <div className="result-metadata">
          {result.durationSeconds && (
            <div className="metadata-item">
              <span className="metadata-label">Duration:</span>
              <span className="metadata-value">{result.durationSeconds}s</span>
            </div>
          )}

          {result.pickedSegment && (
            <>
              <div className="metadata-item">
                <span className="metadata-label">Segment Start:</span>
                <span className="metadata-value">
                  {result.pickedSegment.start_ts}
                </span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Segment End:</span>
                <span className="metadata-value">
                  {result.pickedSegment.end_ts}
                </span>
              </div>
              {result.pickedSegment.reason && (
                <div className="metadata-item">
                  <span className="metadata-label">Reason Picked:</span>
                  <span className="metadata-value">
                    {result.pickedSegment.reason}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="result-actions">
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-download"
              onClick={() => console.log("📥 Download clicked:", videoUrl)}
            >
              ⬇️ Download Short
            </a>
          )}
          <button className="btn-new-upload" onClick={onReset}>
            ➕ Process Another Video
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;
