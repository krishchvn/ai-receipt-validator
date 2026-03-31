from fastapi import APIRouter, File, UploadFile, HTTPException
from models.receipt import ValidationResult
from services.ai import extract_receipt_data
from services.validator import validate_math
from utils.file_handler import process_file

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
    "image/bmp",
    "application/pdf",
}


@router.post("/validate", response_model=ValidationResult)
async def validate(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: jpg, png, webp, tiff, bmp, pdf",
        )

    input_type, content = await process_file(file)
    extracted = await extract_receipt_data(input_type, content)
    result = validate_math(extracted)
    return result
