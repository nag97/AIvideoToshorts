# AIvideoToshorts

Turn long-form videos into short vertical clips with AI-selected highlight moments and subtitles.

## Overview

AIvideoToshorts is a full-stack video processing application where a user uploads a long video, the backend processes it asynchronously, selects the most engaging segment using AI, and returns a short vertical clip with styled subtitles.

The pipeline is:

1. Upload a video
2. Extract audio from the video
3. Transcribe the audio into subtitles
4. Send the timestamped transcript to Gemini to pick the best highlight
5. Trim and render a vertical short using FFmpeg
6. Return the generated clip to the frontend

---

## Features

- Upload long-form video files
- Background job-based processing
- Real-time progress tracking using polling
- Automatic audio extraction
- Speech-to-text transcription with subtitle generation
- AI-based highlight segment selection
- Vertical short generation for short-form content
- Styled subtitles burned into the output video
- Result display after processing completes

---

## Tech Stack

### Frontend
- React
- Vite
- Axios

### Backend
- Node.js
- Express
- Multer
- CORS
- dotenv

### AI / Video Processing
- Whisper CLI for transcription
- Google Gemini API for highlight selection
- FFmpeg via fluent-ffmpeg for audio extraction and clip rendering

---

## Project Structure

```bash
AIvideoToshorts/
│
├── backend/
│   ├── controllers/
│   ├── outputs/
│   ├── queue/
│   ├── routes/
│   ├── services/
│   ├── store/
│   ├── uploads/
│   ├── utils/
│   ├── workers/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── styles/
│   └── package.json
│
├── server.js
├── package.json
└── README.md
