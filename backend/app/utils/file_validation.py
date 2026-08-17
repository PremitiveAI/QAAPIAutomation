from fastapi import UploadFile, HTTPException
import json

ALLOWED_MIME_TYPES = ["application/json"]

def validate_json_file(file: UploadFile):
    # 1️⃣ Extension check
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only .json files are allowed."
        )

    # 2️⃣ MIME type check
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid content type. Please upload a JSON file."
        )

    # 3️⃣ Validate JSON format
    try:
        file.file.seek(0)
        data = json.load(file.file)
        file.file.seek(0)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON file. Unable to parse JSON."
        )

    return data
