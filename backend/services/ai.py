from __future__ import annotations
import base64
import io
import json
from openai import AsyncOpenAI
from PIL import Image
from core.config import settings
from models.receipt import ReceiptData

client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)
MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"

PROMPT = """Analyze this receipt and respond with ONLY a JSON object — no explanation, no markdown:

{
  "is_receipt": boolean,
  "merchant": string or null,
  "date": string or null (ISO format e.g. "2024-01-15"),
  "currency": string or null (e.g. "USD", "INR", "EUR"),
  "line_items": [{"description": string, "total_price": number}],
  "subtotal": number or null,
  "tax_total": number or null,
  "tip": number or null,
  "total": number or null,
  "is_handwritten": boolean,
  "confidence": "high" or "medium" or "low",
  "fraud_signals": [{"description": string, "severity": "high" or "mid" or "low"}]
}

For fraud_signals, only flag structurally or mathematically provable issues:
- "high": totals appear fabricated, amounts have been altered, tax manipulation to change the final total
- "mid": total does not add up
- "low": missing merchant name or date, illegible sections

Do NOT flag: round number prices, unusual tax rates, inconsistent fonts, or handwritten style — these are normal receipt characteristics.

If this is not a receipt, set is_receipt to false and all other fields to null or empty.
"""


def _parse_response(text: str) -> dict:
    if not text:
        raise ValueError("Model returned an empty response.")
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


MAX_SIDE = 1024

def _image_to_base64(image: Image.Image) -> str:
    if max(image.width, image.height) > MAX_SIDE:
        image = image.copy()
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


async def extract_receipt_data(input_type: str, content: Image.Image | str) -> ReceiptData:
    if input_type == "image":
        image_b64 = _image_to_base64(content)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                ],
            }
        ]
    else:
        messages = [
            {
                "role": "user",
                "content": f"{PROMPT}\n\nReceipt text:\n{content}",
            }
        ]

    response = await client.chat.completions.create(model=MODEL, messages=messages)
    data = _parse_response(response.choices[0].message.content)
    data["line_items"] = data.get("line_items") or []
    data["fraud_signals"] = data.get("fraud_signals") or []
    return ReceiptData(**data)
