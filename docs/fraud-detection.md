# Fraud Detection

This document explains how fraud signals are generated, classified, filtered, and used to make accept/reject decisions.

---

## How Signals Are Generated

Fraud signals come from the AI model (`nvidia/nemotron-nano-12b-v2-vl:free`). The model is prompted to identify only **structurally or mathematically provable issues** — not stylistic observations.

The AI returns each signal as:

```json
{ "description": "Totals appear fabricated", "severity": "high" }
```

---

## Severity Tiers

| Severity | Description | Examples |
|---|---|---|
| `high` | Clear indicators of fabrication or intentional manipulation | Totals appear fabricated, amounts have been altered, tax manipulation to inflate or deflate the total |
| `mid` | Mathematical inconsistencies that may indicate error or fraud | Total does not add up, subtotal inconsistent with line items |
| `low` | Missing or unclear data that reduces confidence | Missing merchant name or date, illegible sections |

### What is NOT flagged

The AI is explicitly instructed to ignore these common receipt characteristics:

- Round number prices
- Unusual tax rates for the region
- Inconsistent fonts or spacing
- Handwritten style

These were historically over-flagged and produced too many false positives.

---

## Programmatic Validation (Backend)

In addition to AI signals, the backend independently computes:

- **Line item sum check:** `sum(line_items) vs subtotal` → contributes to `line_items_sum_valid` and a warning
- **Primary math check:** `subtotal + tax + tip vs total` → contributes to `math_valid`

These checks are deterministic and do not rely on the AI.

---

## Signal Filtering

When primary math passes (`subtotal + tax + tip = total`), AI-generated signals that are about amount discrepancies are removed. This prevents false rejections on receipts with VAT-inclusive pricing formats (e.g. Philippine receipts) where line items may not directly sum to the pre-VAT subtotal.

Signals removed when math is valid contain any of these keywords:

```
"discrepancy", "does not match", "mismatch",
"sum of line item", "line item total", "inconsistency with the sum"
```

All other signals are preserved regardless of math validity.

---

## Rolled-up Rating

After filtering, the worst signal severity is computed and stored as `fraud_signal_rating`:

```
high  → any signal is high
mid   → worst remaining is mid
low   → all signals are low
null  → no signals
```

---

## Accept / Reject Decision

```
is_accepted = math_valid AND fraud_signal_rating != "high"
```

| Condition | is_accepted |
|---|---|
| Math valid, no fraud signals | `true` |
| Math valid, only low/mid signals | `true` |
| Math valid, high fraud signal | `false` |
| Math invalid (any reason) | `false` |
| Not a receipt (`is_receipt = false`) | `false` |

---

## Frontend Behaviour

- `is_accepted = true` → green card, "Receipt Accepted"
- `is_accepted = false` → red card, "Receipt Rejected"
- Fraud signals are listed with colour-coded severity badges (`HIGH` in red, `MID` in amber, `LOW` in blue)
- Warnings are displayed in an amber box below the signals
