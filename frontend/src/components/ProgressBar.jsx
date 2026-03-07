import React, { useEffect, useState } from "react";
import "../styles/progressbar.css";

const ProgressBar = ({
  isProcessing,
  message = "Please wait, processing your video...",
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setProgress(0);
      return;
    }

    // Simulate smooth progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach 90%
        if (prev < 30) return prev + Math.random() * 15;
        if (prev < 60) return prev + Math.random() * 8;
        if (prev < 90) return prev + Math.random() * 3;
        return prev; // Stop at 90% until response arrives
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isProcessing]);

  useEffect(() => {
    if (!isProcessing) {
      setProgress(100); // Jump to 100 when done
    }
  }, [isProcessing]);

  if (!isProcessing && progress === 0) return null;

  return (
    <div className="progress-container">
      <div className="progress-message">
        <p>{message}</p>
      </div>
      <div className="progress-bar-wrapper">
        <div className="progress-bar-background">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        <span className="progress-percentage">
          {Math.round(Math.min(progress, 100))}%
        </span>
      </div>
    </div>
  );
};

export default ProgressBar;
