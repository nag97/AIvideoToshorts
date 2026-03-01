exports.timestampToSeconds = (timestamp) => {
  const cleanTimestamp = timestamp.replace(/\r/g, "").trim();

  const [time, ms] = cleanTimestamp.split(",");
  const [hh, mm, ss] = time.split(":").map(Number);

  return hh * 3600 + mm * 60 + ss + Number(ms) / 1000;
};
