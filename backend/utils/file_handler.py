from __future__ import annotations

from fastapi import UploadFile, HTTPException
from PIL import Image, UnidentifiedImageError
from pdf2image import convert_from_bytes
import fitz  # PyMuPDF
import io


async def process_file(file: UploadFile) -> tuple[str, Image.Image | str]:
    """
    Returns (input_type, content)
      input_type: "image" or "text"
      content:    PIL Image (for vision LLM) or str (for text LLM prompt)
    """
    contents = await file.read()

    if file.content_type == "application/pdf":
        return _process_pdf(contents)

    try:
        return "image", Image.open(io.BytesIO(contents)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read image file '{file.filename}'. The file may be corrupt or an unsupported format.",
        )


def _process_pdf(contents: bytes) -> tuple[str, Image.Image | str]:
    # Try to extract embedded text (rich/native PDF)
    doc = fitz.open(stream=contents, filetype="pdf")
    text = "".join(page.get_text() for page in doc)
    doc.close()

    if len(text.strip()) > 50:
        return "text", text

    # Scanned PDF — convert first page to image
    pages = convert_from_bytes(contents, dpi=150)
    return "image", pages[0]
