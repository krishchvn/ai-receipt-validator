from pydantic import BaseModel
from typing import Optional


class LineItem(BaseModel):
    description: str
    total_price: float


class FraudSignal(BaseModel):
    description: str
    severity: str  # "high", "mid", "low"


class ReceiptData(BaseModel):
    is_receipt: bool
    merchant: Optional[str] = None
    date: Optional[str] = None
    currency: Optional[str] = None
    line_items: list[LineItem] = []
    subtotal: Optional[float] = None
    tax_total: Optional[float] = None
    tip: Optional[float] = None
    total: Optional[float] = None
    is_handwritten: bool = False
    confidence: str = "high"
    fraud_signals: list[FraudSignal] = []


class ValidationResult(ReceiptData):
    math_valid: Optional[bool] = None
    discrepancy: Optional[float] = None
    calculated_sub_total: Optional[float] = None
    line_items_sum_valid: Optional[bool] = None
    fraud_signal_rating: Optional[str] = None  # "high", "mid", "low", or null
    is_accepted: Optional[bool] = None
    warning: Optional[str] = None
