const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const disableQueue = process.env.DISABLE_QUEUE === "true";

if (disableQueue || !process.env.REDIS_URL) {
  console.warn(
    "Queue disabled (DISABLE_QUEUE=true or REDIS_URL not set). Using in-process fallback.",
  );
  module.exports = { videoQueue: null, connection: null };
} else {
  try {
    const connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    const videoQueue = new Queue("video-processing", { connection });

    module.exports = { videoQueue, connection };
  } catch (e) {
    console.error(
      "Failed to initialize Redis queue, falling back to in-process mode:",
      e.message || e,
    );
    module.exports = { videoQueue: null, connection: null };
  }
}
