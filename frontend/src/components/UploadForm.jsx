import { useState } from "react";
import api from "../services/api";

function UploadForm({ onSuccess, setLoading, setError }) {
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a video file.");
      return;
    }

    const formData = new FormData();
    formData.append("video", file);

    try {
      setError("");
      setLoading(true);

      const response = await api.post("/api/video/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onSuccess(response.data);
    } catch (error) {
      console.error(error);
      setError(
        error?.response?.data?.details ||
          error?.response?.data?.error ||
          "Upload failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Upload Long Video</h2>
      <form onSubmit={handleSubmit} className="upload-form">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button type="submit">Generate Short</button>
      </form>
    </div>
  );
}

export default UploadForm;