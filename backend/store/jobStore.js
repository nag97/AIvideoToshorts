/**
 * Redis-backed job store using Upstash
 * All job state is persisted in Redis with a 24-hour TTL
 */

const redis = require("./redisClient");

const JOB_TTL = 86400; // 24 hours in seconds
const JOB_KEY_PREFIX = "job:";

/**
 * Generate unique job ID
 * @returns {string} Job ID
 */
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the Redis key for a job ID
 * @param {string} jobId
 * @returns {string} Redis key
 */
function getJobKey(jobId) {
  return `${JOB_KEY_PREFIX}${jobId}`;
}

/**
 * Create a new job
 * @param {object} options - Job options (videoPath, filename)
 * @returns {string} Job ID
 */
async function createJob(options = {}) {
  const jobId = generateJobId();
  const job = {
    id: jobId,
    status: "queued",
    progress: 0,
    step: "Initializing",
    result: null,
    error: null,
    videoPath: options.videoPath || null,
    filename: options.filename || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const key = getJobKey(jobId);
  await redis.setex(key, JOB_TTL, JSON.stringify(job));
  console.log(
    "[JobStore] Created job:",
    jobId,
    "with TTL:",
    JOB_TTL,
    "seconds",
  );
  return jobId;
}

/**
 * Get job by ID
 * @param {string} jobId
 * @returns {object|null} Job object or null if not found
 */
async function getJob(jobId) {
  const key = getJobKey(jobId);
  const data = await redis.get(key);

  if (!data) {
    console.log("[JobStore] Job not found:", jobId);
    return null;
  }

  return JSON.parse(data);
}

/**
 * Update job with new data
 * @param {string} jobId
 * @param {object} data - Fields to update (status, progress, step, result, error)
 * @returns {object} Updated job object
 */
async function updateJob(jobId, data) {
  const key = getJobKey(jobId);
  const existing = await redis.get(key);

  if (!existing) {
    throw new Error(`Job ${jobId} not found`);
  }

  const job = JSON.parse(existing);
  const updated = {
    ...job,
    ...data,
    updatedAt: new Date().toISOString(),
  };

  // Re-set with TTL to refresh expiration
  await redis.setex(key, JOB_TTL, JSON.stringify(updated));
  console.log(`[JobStore] Updated job ${jobId}:`, data);
  return updated;
}

/**
 * Delete a job (cleanup)
 * @param {string} jobId
 */
async function deleteJob(jobId) {
  const key = getJobKey(jobId);
  await redis.del(key);
  console.log("[JobStore] Deleted job:", jobId);
}

/**
 * Get all jobs (for monitoring/debugging)
 * @returns {array} Array of all job objects
 */
async function getAllJobs() {
  const pattern = `${JOB_KEY_PREFIX}*`;
  const keys = await redis.keys(pattern);

  const jobs = [];
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      jobs.push(JSON.parse(data));
    }
  }

  return jobs;
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  deleteJob,
  getAllJobs,
};
