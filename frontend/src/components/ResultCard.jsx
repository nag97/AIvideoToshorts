function ResultCard({ result }) {
  if (!result) return null;

  return (
    <div className="card">
      <h2>Generated Short</h2>

      {result.shortUrl && (
        <video controls width="100%" className="video-player">
          <source src={result.shortUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}

      <div className="result-info">
        <p>
          <strong>Duration:</strong> {result.durationSeconds}s
        </p>

        {result.pickedSegment && (
          <>
            <p>
              <strong>Start:</strong> {result.pickedSegment.start_ts}
            </p>
            <p>
              <strong>End:</strong> {result.pickedSegment.end_ts}
            </p>
            <p>
              <strong>Reason:</strong> {result.pickedSegment.reason}
            </p>
          </>
        )}

        {result.shortUrl && (
          <a href={result.shortUrl} target="_blank" rel="noreferrer" className="download-btn">
            Open / Download Short
          </a>
        )}
      </div>
    </div>
  );
}

export default ResultCard;