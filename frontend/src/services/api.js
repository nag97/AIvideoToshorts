import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
});

/**
 * Upload video and start background processing
 * @param {File} videoFile - Video file to upload
 * @returns {Promise<{jobId: string}>} Job ID for tracking progress
 */
export const uploadVideo = async (videoFile) => {
  const formData = new FormData();
  formData.append("video", videoFile);

  const response = await api.post("/api/video/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

/**
 * Poll job status
 * @param {string} jobId - Job ID to track
 * @returns {Promise<{status, progress, step, result, error}>} Job status object
 */
export const getJobStatus = async (jobId) => {
  const response = await api.get(`/api/video/status/${jobId}`);
  return response.data;
};

/**
 * Poll job status with automatic retries until done
 * Useful for getting continuous updates
 * @param {string} jobId - Job ID to track
 * @param {number} pollingInterval - Milliseconds between polls (default 2000)
 * @param {function} onProgress - Callback function called on each status update
 * @returns {Promise<object>} Final job result when completed or failed
 */
export const watchJobProgress = async (
  jobId,
  pollingInterval = 2000,
  onProgress = null,
) => {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);

        if (onProgress) {
          onProgress(job);
        }

        if (job.status === "completed") {
          resolve(job.result);
        } else if (job.status === "failed") {
          reject(new Error(job.error || "Job processing failed"));
        } else {
          // Continue polling
          setTimeout(poll, pollingInterval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};

export default api;
