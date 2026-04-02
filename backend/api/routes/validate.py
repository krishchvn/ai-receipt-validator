import asyncio
from typing import List
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

MAX_FILES = 3


async def _validate_single(file: UploadFile) -> ValidationResult:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: jpg, png, webp, tiff, bmp, pdf",
        )
    input_type, content = await process_file(file)
    extracted = await extract_receipt_data(input_type, content)
    return validate_math(extracted)


@router.post("/validate", response_model=List[ValidationResult])
async def validate(files: List[UploadFile] = File(...)):
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_FILES} files allowed per request.",
        )

    results = await asyncio.gather(*[_validate_single(f) for f in files])
    return list(results)
