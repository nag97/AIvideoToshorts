import { useState } from "react";
import UploadForm from "./components/UploadForm";
import ResultCard from "./components/ResultCard";
import Loader from "./components/Loader.jsx";
import "./index.css";

function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="app">
      <div className="container">
        <h1>AI Video to Shorts Generator</h1>
        <p className="subtitle">
          Upload a long video and generate a short with captions automatically.
        </p>

        <UploadForm
          onSuccess={setResult}
          setLoading={setLoading}
          setError={setError}
        />

        {loading && <Loader />}

        {error && <div className="error-box">{error}</div>}

        {result && <ResultCard result={result} />}
      </div>
    </div>
  );
}

export default App;
