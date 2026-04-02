# API Reference

Base URL: `https://ai-receipt-validator.onrender.com/`

Interactive docs (Swagger UI): `https://ai-receipt-validator.onrender.com/docs`

---

## POST /api/v1/validate

Validates a receipt image or PDF.

### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | Yes | Receipt image or PDF |

**Accepted MIME types:**
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/tiff`
- `image/bmp`
- `application/pdf`

**Example (curl):**

```bash
curl -X POST https://ai-receipt-validator.onrender.com/api/v1/validate \
  -F "file=@receipt.jpg;type=image/jpeg" | python3 -m json.tool
```

---

### Response

`Content-Type: application/json`

```json
{
  "is_receipt": true,
  "merchant": "ACME Store",
  "date": "2024-03-15",
  "currency": "USD",
  "line_items": [
    { "description": "Item A", "total_price": 10.00 },
    { "description": "Item B", "total_price": 5.50 }
  ],
  "subtotal": 15.50,
  "tax_total": 1.55,
  "tip": null,
  "total": 17.05,
  "is_handwritten": false,
  "confidence": "high",
  "fraud_signals": [],
  "math_valid": true,
  "discrepancy": 0.0,
  "calculated_sub_total": 15.50,
  "line_items_sum_valid": true,
  "fraud_signal_rating": null,
  "is_accepted": true,
  "warning": null
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `is_receipt` | bool | Whether the file is a receipt |
| `merchant` | string \| null | Merchant name |
| `date` | string \| null | Date in ISO format (e.g. `"2024-01-15"`) |
| `currency` | string \| null | Currency code (e.g. `"USD"`, `"PHP"`) |
| `line_items` | array | List of `{ description, total_price }` objects |
| `subtotal` | number \| null | Subtotal as printed on the receipt |
| `tax_total` | number \| null | Tax amount |
| `tip` | number \| null | Tip amount |
| `total` | number \| null | Final total |
| `is_handwritten` | bool | Whether the receipt appears handwritten |
| `confidence` | `"high"` \| `"medium"` \| `"low"` | AI confidence in extraction quality |
| `fraud_signals` | array | List of `{ description, severity }` objects |
| `math_valid` | bool \| null | Whether `subtotal + tax + tip = total` |
| `discrepancy` | number \| null | Absolute difference between computed and printed total |
| `calculated_sub_total` | number \| null | Sum of all line item `total_price` values |
| `line_items_sum_valid` | bool \| null | Whether `calculated_sub_total ≈ subtotal` |
| `fraud_signal_rating` | `"high"` \| `"mid"` \| `"low"` \| null | Worst fraud signal severity |
| `is_accepted` | bool \| null | Final accept/reject verdict |
| `warning` | string \| null | Human-readable warning message (pipe-separated if multiple) |

### Fraud Signal Object

```json
{ "description": "Totals appear fabricated", "severity": "high" }
```

| Field | Values | Description |
|---|---|---|
| `description` | string | Human-readable description of the signal |
| `severity` | `"high"` \| `"mid"` \| `"low"` | Impact level |

---

### Error Responses

**400 — Unsupported file type**

```json
{
  "detail": "Unsupported file type: image/gif. Allowed: jpg, png, webp, tiff, bmp, pdf"
}
```

**500 — Server error**

Returned if the AI fails to respond or returns unparseable output.

---

## GET /health

Health check endpoint.

### Response

```json
{ "status": "ok" }
```
