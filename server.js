const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
require("dotenv").config();

 
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const videoRoutes = require("./backend/routes/videoRoutes");

app.use("/api/videos", videoRoutes);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
