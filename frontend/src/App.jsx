import { useState, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:8001/api/v1/validate";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp", "application/pdf"];
const MAX_FILES = 3;

const STATUS = { IDLE: "idle", VALIDATING: "validating", DONE: "done" };

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [results, setResults] = useState([]);
  const [fileNames, setFileNames] = useState([]);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  async function handleFiles(files) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (fileList.length > MAX_FILES) {
      alert(`You can only upload up to ${MAX_FILES} files at once. You selected ${fileList.length}.`);
      return;
    }

    const invalid = fileList.find(f => !ACCEPTED_TYPES.includes(f.type));
    if (invalid) {
      setError(`Unsupported file type: ${invalid.name}. Please upload JPG, PNG, WebP, TIFF, BMP or PDF.`);
      return;
    }

    setError(null);
    setResults([]);
    setFileNames(fileList.map(f => f.name));
    setStatus(STATUS.VALIDATING);

    const formData = new FormData();
    fileList.forEach(f => formData.append("files", f));

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      const data = await res.json();
      console.log("Receipt validation response:", data);
      setResults(data);
    } catch {
      setError("Failed to reach the server. Make sure the backend is running on port 8001.");
    } finally {
      setStatus(STATUS.DONE);
    }
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleReset() {
    setStatus(STATUS.IDLE);
    setResults([]);
    setFileNames([]);
    setError(null);
  }

  return (
    <div className="app">
      <div className="card">
        <h1 className="title">Receipt Validator</h1>
        <p className="subtitle">Upload up to {MAX_FILES} receipts at once</p>

        {status === STATUS.IDLE && (
          <div
            className={`dropzone${dragOver ? " dragover" : ""}`}
            onClick={() => inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">📄</div>
            <p className="dropzone-text">Drag & drop or <span className="link">browse</span></p>
            <p className="dropzone-hint">JPG, PNG, WebP, TIFF, BMP, PDF · max {MAX_FILES} files</p>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.tiff,.bmp,.pdf"
              multiple
              onChange={handleInputChange}
              hidden
            />
          </div>
        )}

        {status === STATUS.VALIDATING && (
          <div className="loader-container">
            <div className="spinner" />
            <p className="loader-text">Validating {fileNames.length} receipt{fileNames.length > 1 ? "s" : ""}…</p>
            <div className="file-list">
              {fileNames.map((name, i) => (
                <p key={i} className="loader-filename">{name}</p>
              ))}
            </div>
          </div>
        )}

        {status === STATUS.DONE && error && (
          <div className="result-card rejected">
            <div className="result-icon">✕</div>
            <h2 className="result-title">Error</h2>
            <p className="result-message">{error}</p>
            <button className="btn" onClick={handleReset}>Try Again</button>
          </div>
        )}

        {status === STATUS.DONE && results.length > 0 && !error && (
          <div className="results-list">
            {results.map((result, i) => (
              <ResultCard key={i} result={result} fileName={fileNames[i]} />
            ))}
            <button className="btn" onClick={handleReset}>Validate More</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, fileName }) {
  const accepted = result.is_accepted;

  return (
    <div className={`result-card ${accepted ? "accepted" : "rejected"}`}>
      <div className="result-header">
        <div className="result-icon">{accepted ? "✓" : "✕"}</div>
        <div>
          <h2 className="result-title">{accepted ? "Accepted" : "Rejected"}</h2>
          {fileName && <p className="result-filename">{fileName}</p>}
        </div>
      </div>

      {result.merchant && <p className="result-merchant">{result.merchant}</p>}

      <div className="result-grid">
        {result.date && <MetaItem label="Date" value={result.date} />}
        {result.currency && <MetaItem label="Currency" value={result.currency} />}
        {result.total != null && <MetaItem label="Total" value={`${result.currency ?? ""} ${result.total}`} />}
        {result.subtotal != null && <MetaItem label="Subtotal" value={`${result.currency ?? ""} ${result.subtotal}`} />}
        {result.tax_total != null && <MetaItem label="Tax" value={`${result.currency ?? ""} ${result.tax_total}`} />}
        {result.calculated_sub_total != null && (
          <MetaItem label="Calc. Subtotal" value={`${result.currency ?? ""} ${result.calculated_sub_total}`} />
        )}
        <MetaItem label="Math Valid" value={result.math_valid === true ? "Yes" : result.math_valid === false ? "No" : "—"} />
        <MetaItem label="Confidence" value={result.confidence ?? "—"} />
        {result.fraud_signal_rating && (
          <MetaItem label="Fraud Rating" value={result.fraud_signal_rating.toUpperCase()} highlight={result.fraud_signal_rating} />
        )}
      </div>

      {result.fraud_signals?.length > 0 && (
        <div className="fraud-signals">
          <p className="signals-heading">Fraud Signals</p>
          <ul className="signals-list">
            {result.fraud_signals.map((s, i) => (
              <li key={i} className="signal">
                <span className={`badge badge-${s.severity}`}>{s.severity.toUpperCase()}</span>
                {s.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warning && (
        <div className="warning-box">
          <span>⚠</span> {result.warning}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value, highlight }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={`meta-value${highlight ? ` highlight-${highlight}` : ""}`}>{value}</span>
    </div>
  );
}
