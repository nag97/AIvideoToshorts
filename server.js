require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(
  cors({
    origin: [
      "https://nova-shorts-frontend.vercel.app",
      "http://localhost:5173",
    ],
  }),
);
// Use raw body for QStash callback route to allow exact signature verification
app.use(
  "/api/video/process-callback",
  express.raw({ type: "application/json" }),
);

// Parse JSON for all other routes
app.use(express.json());

// ✅ Serve outputs directory as static files
app.use("/outputs", express.static(path.join(__dirname, "backend/outputs")));

// ✅ mount video routes
const videoRoutes = require("./backend/routes/videoRoutes");
app.use("/api/video", videoRoutes);

// ✅ test route (so you can verify server works)
app.get("/health", (req, res) => res.send("OK"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
