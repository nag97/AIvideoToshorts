import React from "react";
import "../styles/hero.css";
import UploadBox from "./UploadBox";

const Hero = ({ onUploadStart, onUploadSuccess, onUploadError }) => {
  return (
    <section className="hero">
      <div className="hero-content">
        {/* Small Heading */}
        <div className="hero-badge">
          <span className="badge-text">#1 AI VIDEO CLIPPING TOOL</span>
        </div>

        {/* Main Title */}
        <h1 className="hero-title">
          1 long video, <br />
          <span className="title-gradient">multiple viral shorts</span>.
          <br />
          Create content <span className="title-accent">10x faster</span>.
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          ShortifyAI transforms long videos into viral shorts using AI,
          captions, and smart highlight detection.
        </p>

        {/* Upload Box */}
        <UploadBox
          onUploadStart={onUploadStart}
          onUploadSuccess={onUploadSuccess}
          onUploadError={onUploadError}
        />
      </div>

      {/* Background Glow Effects */}
      <div className="glow-top"></div>
      <div className="glow-bottom"></div>
    </section>
  );
};

export default Hero;
