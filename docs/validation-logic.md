# Validation Logic

This document explains how the backend validates a receipt after AI extraction.

---

## Overview

Validation happens in `backend/services/validator.py` inside `validate_math()`. It runs entirely in Python with no additional AI calls — deterministic, decimal-precise arithmetic.

---

## Step 1 — Non-receipt Early Exit

If the AI sets `is_receipt = false`, validation stops immediately:

- `fraud_signals` is overridden with a single `high`-severity signal: _"Not a valid receipt or poor image quality"_
- `fraud_signal_rating = "high"`
- `is_accepted = false`
- `warning` is set to ask the user to upload a valid receipt

---

## Step 2 — Primary Math Check

```
computed = subtotal + tax_total + tip   (all default to 0 if null)
discrepancy = |computed - total|
math_valid = discrepancy <= 0.02
```

All arithmetic uses Python's `Decimal` type with `ROUND_HALF_UP` to avoid floating-point errors.

**Tolerance:** `±0.02` — accommodates minor rounding differences between receipt printing and extraction.

If `total` is `null`, validation stops and `warning = "Could not extract total from receipt"`.

---

## Step 3 — Line Item Sum Check

Runs regardless of whether primary math passed or failed.

```
calculated_sub_total = sum(item.total_price for item in line_items)
items_discrepancy = |calculated_sub_total - subtotal|
line_items_sum_valid = items_discrepancy <= 0.02
```

**Important:** `line_items_sum_valid` is informational only. It never overrides `math_valid`. If primary math passes, `line_items_sum_valid` is set to `true` as well — because the printed subtotal is the ground truth (line items may reflect VAT-inclusive pricing or partial OCR extraction).

If `line_items_sum_valid = false`, a warning is added: _"Calculated Total by AI does not match SubTotal on receipt. Please check manually."_

---

## Step 4 — Fraud Signal Filtering

When primary math is valid, AI-generated fraud signals about amount discrepancies are removed. These are identified by keywords:

| Keyword | Rationale |
|---|---|
| `"discrepancy"` | About numeric gaps |
| `"does not match"` | About mismatches |
| `"mismatch"` | About mismatches |
| `"sum of line item"` | About line item arithmetic |
| `"line item total"` | About line item arithmetic |
| `"inconsistency with the sum"` | About sum inconsistency |

Non-amount signals (e.g. _"merchant name missing"_) are always kept.

---

## Step 5 — Fraud Signal Rating

The worst-case severity across all remaining fraud signals:

```
fraud_signal_rating = "high"   if any signal has severity "high"
                    = "mid"    if worst remaining is "mid"
                    = "low"    if all signals are "low"
                    = null     if no signals
```

---

## Step 6 — Accept / Reject Decision

```
is_accepted = math_valid == True AND fraud_signal_rating != "high"
```

A receipt is rejected if:
- `math_valid = false` (primary arithmetic fails), OR
- Any fraud signal is rated `high`

---

## Step 7 — Warning Assembly

Warnings are concatenated with ` | `:

| Condition | Warning message |
|---|---|
| `confidence == "low"` | `"Please confirm manually"` |
| `line_items_sum_valid == false` | `"Calculated Total by AI does not match SubTotal on receipt. Please check manually."` |
| Any fraud signals remain | `"Fraud signals detected: <descriptions>"` |
| `is_handwritten == true` AND `math_valid == false` | `"Handwritten receipt — please verify totals manually"` |

`warning` is `null` if none of the above apply.

---

## Data Flow Summary

```
ReceiptData (from AI)
    │
    ├─ is_receipt = false? → reject immediately (high fraud signal)
    ├─ total = null?        → warning, return early
    │
    ├─ [Primary math]  subtotal + tax + tip vs total
    ├─ [Line item sum] sum(line_items) vs subtotal → calculated_sub_total
    ├─ [Signal filter] remove amount signals if primary math passes
    ├─ [Rating]        worst severity across remaining signals
    ├─ [Verdict]       is_accepted
    └─ [Warnings]      assemble warning string
        │
        └─ ValidationResult
```
