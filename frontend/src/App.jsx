import { useState, useRef } from "react";
import "./App.css";

const API_URL = "http://localhost:8001/api/v1/validate";
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp", "application/pdf"];

const STATUS = { IDLE: "idle", UPLOADING: "uploading", VALIDATING: "validating", DONE: "done" };

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Unsupported file type. Please upload JPG, PNG, WebP, TIFF, BMP or PDF.`);
      return;
    }
    setError(null);
    setResult(null);
    setFileName(file.name);
    setStatus(STATUS.UPLOADING);

    const formData = new FormData();
    formData.append("file", file);

    setStatus(STATUS.VALIDATING);
    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      const data = await res.json();
      console.log("Receipt validation response:", data);
      setResult(data);
    } catch {
      setError("Failed to reach the server. Make sure the backend is running on port 8001.");
    } finally {
      setStatus(STATUS.DONE);
    }
  }

  function handleInputChange(e) {
    handleFile(e.target.files[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleReset() {
    setStatus(STATUS.IDLE);
    setResult(null);
    setError(null);
    setFileName(null);
  }

  const isLoading = status === STATUS.UPLOADING || status === STATUS.VALIDATING;

  return (
    <div className="app">
      <div className="card">
        <h1 className="title">Receipt Validator</h1>
        <p className="subtitle">Upload a receipt image or PDF to validate it</p>

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
            <p className="dropzone-hint">JPG, PNG, WebP, TIFF, BMP, PDF</p>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.tiff,.bmp,.pdf"
              onChange={handleInputChange}
              hidden
            />
          </div>
        )}

        {isLoading && (
          <div className="loader-container">
            <div className="spinner" />
            <p className="loader-text">
              {status === STATUS.UPLOADING ? "Uploading receipt…" : "Validating receipt…"}
            </p>
            {fileName && <p className="loader-filename">{fileName}</p>}
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

        {status === STATUS.DONE && result && !error && (
          <ResultCard result={result} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}

function ResultCard({ result, onReset }) {
  const accepted = result.is_accepted;

  return (
    <div className={`result-card ${accepted ? "accepted" : "rejected"}`}>
      <div className="result-icon">{accepted ? "✓" : "✕"}</div>
      <h2 className="result-title">{accepted ? "Receipt Accepted" : "Receipt Rejected"}</h2>
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

      <button className="btn" onClick={onReset}>Validate Another</button>
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
