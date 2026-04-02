from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from models.receipt import FraudSignal, ReceiptData, ValidationResult

TOLERANCE = Decimal("0.02")

_SEVERITY_RANK = {"high": 2, "mid": 1, "low": 0}

# Keywords used to identify fraud signals that are about amount discrepancies.
# These are removed when primary math (subtotal + tax + tip = total) checks out.
_AMOUNT_DISCREPANCY_KEYWORDS = (
    "discrepancy",
    "does not match",
    "mismatch",
    "sum of line item",
    "line item total",
    "inconsistency with the sum",
    "subtotal inconsistent",
    "line item",
    "calculated",
)


def _is_amount_discrepancy_signal(description: str) -> bool:
    lowered = description.lower()
    return any(kw in lowered for kw in _AMOUNT_DISCREPANCY_KEYWORDS)


def _worst_severity(signals: List[FraudSignal]) -> Optional[str]:
    if not signals:
        return None
    return max((s.severity for s in signals), key=lambda s: _SEVERITY_RANK.get(s, 0))


def validate_math(data: ReceiptData) -> ValidationResult:
    result = ValidationResult(**data.model_dump())

    if not data.is_receipt:
        result.fraud_signals = [FraudSignal(description="Not a valid receipt or poor image quality — please upload a clear receipt image.", severity="high")]
        result.fraud_signal_rating = "high"
        result.is_accepted = False
        result.warning = "The uploaded file does not appear to be a receipt. Please upload a valid receipt image."
        return result

    if data.total is None:
        result.warning = "Could not extract total from receipt"
        return result

    subtotal = Decimal(str(data.subtotal or 0))
    tax = Decimal(str(data.tax_total or 0))
    tip = Decimal(str(data.tip or 0))
    total = Decimal(str(data.total))

    computed = (subtotal + tax + tip).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    discrepancy = abs(computed - total)
    primary_math_valid = discrepancy <= TOLERANCE

    # Always compute calculated_sub_total from line items
    if data.line_items:
        line_items_sum = sum(
            Decimal(str(item.total_price)) for item in data.line_items
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        result.calculated_sub_total = float(line_items_sum)
        if data.subtotal is not None:
            items_discrepancy = abs(line_items_sum - subtotal)
            result.line_items_sum_valid = items_discrepancy <= TOLERANCE

    if primary_math_valid:
        result.math_valid = True
        result.discrepancy = 0.0
        result.fraud_signals = [s for s in data.fraud_signals if not _is_amount_discrepancy_signal(s.description)]
    else:
        result.math_valid = False
        result.discrepancy = float(discrepancy)

    result.fraud_signal_rating = _worst_severity(result.fraud_signals)
    result.is_accepted = True

    # Build warning from remaining fraud signals and math issues
    warnings = []
    if data.confidence == "low":
        warnings.append("Please confirm manually")
    if result.line_items_sum_valid is False:
        warnings.append("Calculated Total by AI does not match SubTotal on receipt. Please check manually.")
    if result.fraud_signals:
        warnings.append(f"Fraud signals detected: {'; '.join(s.description for s in result.fraud_signals)}")
    if data.is_handwritten and not result.math_valid:
        warnings.append("Handwritten receipt — please verify totals manually")
    result.warning = " | ".join(warnings) if warnings else None

    return result
