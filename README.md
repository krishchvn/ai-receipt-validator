# Receipt Validator

An AI-powered receipt validation system that extracts, validates, and assesses the authenticity of receipt images and PDFs.

---

## Features

- **Multi-format support** — JPG, PNG, WebP, TIFF, BMP, and PDF (native text + scanned)
- **AI extraction** — Uses `nvidia/nemotron-nano-12b-v2-vl:free` via OpenRouter to extract structured receipt data from images
- **Math validation** — Verifies `subtotal + tax + tip = total` with ±0.02 tolerance
- **Line item verification** — Independently sums all line items and compares against the receipt's declared subtotal (`calculated_sub_total`)
- **Fraud signal detection** — AI flags suspicious patterns; each signal is rated `high`, `mid`, or `low` severity
- **Accept / Reject verdict** — Receipts are automatically accepted or rejected based on math validity and fraud signal severity
- **React frontend** — Drag-and-drop UI with real-time preloaders and colour-coded results

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (Python) |
| AI model | nvidia/nemotron-nano-12b-v2-vl:free via OpenRouter |
| AI client | openai (OpenAI-compatible SDK) |
| PDF text extraction | PyMuPDF (fitz) |
| PDF → image conversion | pdf2image |
| Image processing | Pillow |
| Data validation | Pydantic + pydantic-settings |
| Frontend | React + Vite |

---

## Validation Logic

See [docs/validation-logic.md](docs/validation-logic.md) for full detail.

**Short version:**

1. `subtotal + tax + tip = total` → sets `math_valid`, `discrepancy`
2. `sum(line_items) = subtotal` → sets `line_items_sum_valid`, `calculated_sub_total`
3. If primary math passes, line-item mismatches become a warning only (not a rejection)
4. Fraud signals from AI are classified as `high / mid / low`
5. `is_accepted = math_valid AND fraud_signal_rating != "high"`

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/validate` | Validate a receipt file |
| `GET` | `/health` | Health check |

See [docs/api-reference.md](docs/api-reference.md) for full request/response schema.

---

## How to Run

### Prerequisites

- Python 3.9+
- Node.js 18+
- `poppler` (required by pdf2image)

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils
```

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
OPENROUTER_API_KEY=sk-or-...
```

Start the server:

```bash
uvicorn main:app --reload --port 8001
```

Backend runs at: `https://ai-receipt-validator.onrender.com/`
Interactive API docs: `https://ai-receipt-validator.onrender.com/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Project Structure

```
receipt-validator/
├── README.md
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router
│   ├── requirements.txt
│   ├── .env                     # API keys (not committed)
│   ├── api/routes/
│   │   └── validate.py          # POST /api/v1/validate endpoint
│   ├── core/
│   │   └── config.py            # Pydantic settings
│   ├── models/
│   │   └── receipt.py           # Data models
│   ├── services/
│   │   ├── ai.py                # OpenRouter / AI extraction
│   │   └── validator.py         # Math + fraud validation
│   └── utils/
│       └── file_handler.py      # PDF + image processing
├── frontend/
│   └── src/
│       ├── App.jsx              # Main UI
│       └── App.css              # Styles
├── docs/
│   ├── validation-logic.md
│   ├── api-reference.md
│   └── fraud-detection.md
└── sample-images/               # Test receipts
```
