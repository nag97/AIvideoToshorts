/**
 * In-memory job store using Map
 * Stores job processing status, progress, and results
 */

const jobs = new Map();

/**
 * Generate unique job ID
 * @returns {string} Job ID
 */
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new job
 * @returns {string} Job ID
 */
function createJob() {
  const jobId = generateJobId();
  const job = {
    id: jobId,
    status: "queued",
    progress: 0,
    step: "Initializing",
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  console.log("[JobStore] Created job:", jobId);
  return jobId;
}

/**
 * Get job by ID
 * @param {string} jobId
 * @returns {object|null} Job object or null if not found
 */
function getJob(jobId) {
  return jobs.get(jobId) || null;
}

/**
 * Update job with new data
 * @param {string} jobId
 * @param {object} data - Fields to update (status, progress, step, result, error)
 * @returns {object} Updated job object
 */
function updateJob(jobId, data) {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const updated = {
    ...job,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, updated);
  console.log(`[JobStore] Updated job ${jobId}:`, data);
  return updated;
}

/**
 * Delete a job (cleanup)
 * @param {string} jobId
 */
function deleteJob(jobId) {
  jobs.delete(jobId);
  console.log("[JobStore] Deleted job:", jobId);
}

/**
 * Get all jobs (for monitoring/debugging)
 * @returns {array} Array of all job objects
 */
function getAllJobs() {
  return Array.from(jobs.values());
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  getAllJobs,
};
