# Real-Time Progress Tracking API

This document describes the new job-based video processing architecture that allows frontend clients to track progress in real-time while videos are being processed.

---

## Architecture Overview

The system uses an asynchronous job-based approach:

1. **User uploads video** → Backend creates a job and returns `jobId` immediately
2. **Frontend receives `jobId`** → Starts polling for job status every 2-3 seconds
3. **Backend processes in background** → Updates job progress after each pipeline stage
4. **Frontend displays progress** → Shows real-time feedback to user
5. **Processing completes** → Frontend receives final video URL from job result

---

## API Endpoints

### POST `/api/video/upload`

Upload a video file and start background processing.

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with video file as `video` field

**Response (202 Accepted):**

```json
{
  "success": true,
  "message": "Video uploaded. Processing started.",
  "jobId": "job_1729837492234_abc123xyz"
}
```

**Error Response (400/500):**

```json
{
  "error": "Upload failed",
  "details": "Error message"
}
```

---

### GET `/api/video/status/:jobId`

Retrieve the current status of a processing job.

**Request:**

- Method: `GET`
- Path Parameter: `jobId` - The job ID returned from upload

**Response (200 OK):**

```json
{
  "id": "job_1729837492234_abc123xyz",
  "status": "processing",
  "progress": 60,
  "step": "Selecting highlight with AI",
  "result": null,
  "error": null,
  "createdAt": "2026-03-08T10:30:45.123Z",
  "updatedAt": "2026-03-08T10:31:02.456Z"
}
```

**Status Values:**

- `"queued"` - Job is waiting to be processed
- `"processing"` - Job is actively being processed
- `"completed"` - Job finished successfully
- `"failed"` - Job encountered an error

**Progress Values:**

- `0-10` - Extracting audio
- `10-30` - Transcribing speech to text
- `30-60` - Selecting highlight with AI
- `60-80` - Rendering video with subtitles
- `80-100` - Finalizing output

**Error Response (404/500):**

```json
{
  "error": "Job not found",
  "jobId": "job_1729837492234_abc123xyz"
}
```

---

## Processing Pipeline

Each job goes through the following stages with progress updates:

```
0%   ├─ queued
     │
10%  ├─ Extracting audio from video
30%  ├─ Transcribing speech to text
60%  ├─ Selecting highlight with AI
80%  ├─ Rendering video with subtitles
     │
100% └─ Completed ✓
```

---

## Backend Implementation

### Job Store (`backend/store/jobStore.js`)

In-memory Map-based storage for job objects.

**Job Object Structure:**

```javascript
{
  id: "job_1729837492234_abc123xyz",
  status: "processing",
  progress: 60,
  step: "Selecting highlight with AI",
  result: null,
  error: null,
  createdAt: "2026-03-08T10:30:45.123Z",
  updatedAt: "2026-03-08T10:31:02.456Z"
}
```

**Available Functions:**

- `createJob()` - Create new job, returns jobId
- `getJob(jobId)` - Retrieve job by ID
- `updateJob(jobId, data)` - Update job with new data
- `deleteJob(jobId)` - Remove job from store
- `getAllJobs()` - Get all jobs (for monitoring)

### Video Processor (`backend/workers/videoProcessor.js`)

Handles the complete video processing pipeline with progress tracking.

**Main Function:**

```javascript
processVideoJob(jobId, videoPath);
```

This function:

1. Extracts audio from video (10% → 30%)
2. Transcribes audio to text (30% → 60%)
3. Selects best segment with AI (60% → 80%)
4. Creates final video with subtitles (80% → 100%)
5. Updates job status to "completed" with result URL
6. Handles errors and updates job status to "failed"

### Controller (`backend/controllers/videoController.js`)

**Updated `uploadVideo(req, res)`:**

- Creates a job
- Returns jobId immediately (202 Accepted)
- Starts background processing asynchronously
- Does NOT wait for processing to complete

**New `getJobStatus(req, res)`:**

- Returns current job status, progress, and result
- Called by frontend for polling

---

## Frontend Implementation

### API Service Methods (`frontend/src/services/api.js`)

#### `uploadVideo(videoFile)`

Upload a video and get a jobId.

```javascript
import { uploadVideo } from "./services/api";

const handleUpload = async (videoFile) => {
  const response = await uploadVideo(videoFile);
  console.log("Job ID:", response.jobId);
  // response = { success: true, message: "...", jobId: "job_..." }
};
```

#### `getJobStatus(jobId)`

Poll the current status of a job.

```javascript
import { getJobStatus } from "./services/api";

const checkStatus = async (jobId) => {
  const job = await getJobStatus(jobId);
  console.log(job.status); // "processing", "completed", "failed"
  console.log(job.progress); // 0-100
  console.log(job.step); // Current processing step
  console.log(job.result); // { shortUrl, pickedSegment, ... } or null
  console.log(job.error); // Error message or null
};
```

#### `watchJobProgress(jobId, pollingInterval, onProgress)`

Automatically poll until job is done (recommended).

```javascript
import { watchJobProgress } from "./services/api";

const startProcessing = async (videoFile) => {
  // Upload video
  const uploadResponse = await uploadVideo(videoFile);
  const { jobId } = uploadResponse;

  // Watch progress
  try {
    const result = await watchJobProgress(
      jobId,
      2000, // Poll every 2 seconds
      (job) => {
        // This callback is called on each status update
        console.log(`Progress: ${job.progress}% - ${job.step}`);
        // Update UI here with progress bar
      },
    );

    // Processing complete
    console.log("Done! Video URL:", result.shortUrl);
  } catch (error) {
    console.error("Processing failed:", error.message);
  }
};
```

---

## Example Usage Flow

### Frontend Component Example

```jsx
import { useState } from "react";
import { uploadVideo, watchJobProgress } from "../services/api";

export const UploadForm = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Upload video
      console.log("Uploading video...");
      const uploadResponse = await uploadVideo(file);
      const { jobId } = uploadResponse;

      // Step 2: Watch progress until completion
      const result = await watchJobProgress(jobId, 2000, (job) => {
        setProgress(job.progress);
        setCurrentStep(job.step);
      });

      // Step 3: Display result
      setVideoUrl(result.shortUrl);
      setIsProcessing(false);
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} accept="video/*" />

      {isProcessing && (
        <div>
          <p>Progress: {progress}%</p>
          <p>Current step: {currentStep}</p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {videoUrl && (
        <div>
          <p>✓ Video generated successfully!</p>
          <a href={videoUrl}>Download Video</a>
        </div>
      )}
    </div>
  );
};
```

---

## Error Handling

### Job Processing Failures

If processing fails at any stage:

1. Job status is updated to `"failed"`
2. Error message is stored in `job.error`
3. Frontend receives error message when polling
4. Frontend can display error to user and allow retry

**Example Error Response:**

```json
{
  "id": "job_1729837492234_abc123xyz",
  "status": "failed",
  "progress": 35,
  "step": "Error - processing failed",
  "result": null,
  "error": "Whisper transcription failed: No audio detected",
  "createdAt": "2026-03-08T10:30:45.123Z",
  "updatedAt": "2026-03-08T10:31:15.789Z"
}
```

---

## Performance Considerations

### Database vs In-Memory Store

⚠️ **Current Implementation:** In-memory Map

- ✓ Fast and responsive
- ✓ Simple to implement
- ✗ Data lost on server restart
- ✗ Doesn't scale to multiple server instances

### When to Upgrade

For production, consider migrating to a persistent store:

- **PostgreSQL** - Reliable, transactional
- **Redis** - Fast, TTL support for cleanup
- **MongoDB** - Flexible document storage

### Polling Strategy

**Recommended Settings:**

- Polling interval: `2000-3000ms` (2-3 seconds)
- Timeout per request: `5000ms` (5 seconds)
- Max retries: `None` (keep polling until completion)

---

## Testing

### Upload and Poll Example

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Upload video and get jobId
curl -X POST http://localhost:5000/api/video/upload \
  -F "video=@sample.mp4"

# Response:
# {
#   "success": true,
#   "message": "Video uploaded. Processing started.",
#   "jobId": "job_1729837492234_abc123xyz"
# }

# Terminal 3: Poll status every 2 seconds
watch -n 2 curl http://localhost:5000/api/video/status/job_1729837492234_abc123xyz
```

---

## Files Changed

### Backend

- ✓ `backend/store/jobStore.js` - NEW job store
- ✓ `backend/workers/videoProcessor.js` - NEW background processor
- ✓ `backend/controllers/videoController.js` - UPDATED upload handler, NEW status endpoint
- ✓ `backend/routes/videoRoutes.js` - UPDATED with status route

### Frontend

- ✓ `frontend/src/services/api.js` - UPDATED with new API methods

---

## Summary

The new progress tracking system provides:

1. **Immediate Response** - Upload returns immediately with jobId
2. **Real-Time Updates** - Frontend polls job status every 2-3 seconds
3. **Visual Feedback** - Progress bar and step descriptions
4. **Error Handling** - Detailed error messages with retry capability
5. **Scalability** - Async processing doesn't block upload endpoint
6. **Modularity** - Clean separation of concerns (store, processor, controller)

This architecture allows users to upload videos once and receive real-time feedback as their video is processed, similar to production SaaS applications like RunwayML, Synthesia, and other video AI tools.
