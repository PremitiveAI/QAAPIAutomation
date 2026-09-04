# app/utils/r_document_parser.py

import json
import re
import mimetypes
import base64
import fitz  # PyMuPDF
import docx
from datetime import datetime
from typing import Optional
from pathlib import Path
from io import BytesIO
from PIL import Image

from langchain_google_genai import (ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings)
from langchain_core.messages import HumanMessage

from app.config.env import env


# ============================================================
# GEMINI SETUP (LANGCHAIN)
# ============================================================

GOOGLE_API_KEY = env("GOOGLE_API_KEY").strip().strip('"')
GOOGLE_AI_MODEL = env("GOOGLE_AI_MODEL", default="gemini-2.0-flash")

if not GOOGLE_API_KEY:
    raise Exception("❌ GOOGLE_API_KEY not found")

llm = ChatGoogleGenerativeAI(
    model=GOOGLE_AI_MODEL,
    temperature=0,
    max_output_tokens=4096
)

embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")


# ============================================================
# DATE PARSER
# ============================================================

def parse_date(date_str: Optional[str]):
    if not date_str:
        return None

    date_str = date_str.replace(".", "-").replace("/", "-").strip()

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d-%m-%y", "%m-%d-%Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass

    return None


# ============================================================
# FILE TYPE DETECTOR
# ============================================================
def detect_file_type(file_path: str) -> str:
    mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    if mime.startswith("image/"):
        return "image"
    if mime == "application/pdf":
        return "pdf"
    if mime in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return "docx"

    return "other"

def ocr_image_with_langchain(llm, file_path: str) -> str:
    with open(file_path, "rb") as f:
        image_bytes = f.read()

    mime = mimetypes.guess_type(file_path)[0] or "image/jpeg"
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": "Extract all readable text from this image. Return plain text only."
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{b64}"
                }
            }
        ]
    )

    response = llm.invoke([message])
    return response.content or ""

def ocr_pdf_with_langchain(llm, pdf_path: str) -> str:
    """
    Extracts text from PDF.
    Uses Gemini Vision ONLY for scanned pages.
    """

    doc = fitz.open(pdf_path)
    full_text = []

    for page_no, page in enumerate(doc, start=1):
        text = page.get_text().strip()

        # ------------------------------------
        # Case 1: Normal text-based PDF
        # ------------------------------------
        if text:
            full_text.append(text)
            continue

        # ------------------------------------
        # Case 2: Scanned PDF → image → Gemini
        # ------------------------------------
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        ocr_text = _ocr_pil_image_with_gemini(llm, img)
        if ocr_text:
            full_text.append(ocr_text)

    return "\n".join(full_text)

def _ocr_pil_image_with_gemini(llm, img: Image.Image) -> str:
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_bytes = buffer.getvalue()

    b64 = base64.b64encode(img_bytes).decode("utf-8")

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": "Extract all readable text from this document image. Return plain text only."
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{b64}"
                }
            }
        ]
    )

    response = llm.invoke([message])
    return response.content or ""


# ============================================================
# OCR / TEXT EXTRACTION USING GEMINI (LANGCHAIN)
# ============================================================
def ocr_extract_text(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()

    if ext in [".jpg", ".jpeg", ".png"]:
        return ocr_image_with_langchain(llm, file_path)

    if ext == ".pdf":
        return ocr_pdf_with_langchain(llm, file_path)

    if ext == ".docx":
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    # --- New Logic for .txt files ---
    if ext == ".txt":
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read().strip()

    return ""


# ============================================================
# EMBEDDING GENERATOR (LANGCHAIN)
# ============================================================

def gen_embedding(text: str):
    if not text or not text.strip():
        raise ValueError("Embedding text cannot be empty")

    return embeddings.embed_query(text)


# ============================================================
# JSON CLEANER
# ============================================================

def clean_gemini_json(text: str) -> str:
    if not text:
        return "{}"

    text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)

    match = re.search(r"\{[\s\S]*\}", text)
    return match.group(0).strip() if match else "{}"


# ============================================================
# EXTRACT STRUCTURED DOCUMENT DETAILS (LANGCHAIN)
# ============================================================

def extract_details(text: str, rules) -> dict:

    prompt = f"""
# ROLE
Document Validation Engine (Strict OCR Parser)

# TASK
1. Match OCR_TEXT to a document ID in CONFIGURATION.
2. Validate OCR_TEXT using ONLY the provided rules for that ID.
3. Output result in STRICT JSON.

# CONFIGURATION
{rules}

# RULES OF ENGAGEMENT
- **Strict Logic**: Validate ONLY the rules listed in the config. Do NOT add extra checks.
- **Pass/Fail**: "pass" if rule is met; "fail" if missing, incorrect, or hallucinated.
- **JSON Only**: No markdown code blocks, no preamble, no text outside the JSON object.
- **Unrecognized**: If no ID matches, return `{{"id": null, "rules": [], "error": "Unrecognized document"}}`.

# OUTPUT SCHEMA
{{
  "id": integer,
  "document_name": "string",
  "rules": [
    {{
      "rule": "string",
      "mandatory": boolean,
      "result": "pass/fail"
    }}
  ]
}}

# OCR_TEXT
{text}
"""

    response = llm.invoke(prompt)
    raw = response.content or ""
    cleaned = clean_gemini_json(raw)
    try:
        return json.loads(cleaned)
    except Exception:
        return {"id": None, "rules": [], "error": "Document type not recognized"}
    











   
# ============================================================
# SEARCH QUERY PARSER (RULES + GEMINI BACKUP)
# ============================================================

def extract_name_from_query(q: str) -> str:
    patterns = [
        r"aadhaar of ([A-Za-z ]+)",
        r"pan of ([A-Za-z ]+)",
        r"passport of ([A-Za-z ]+)",
        r"([A-Za-z ]+)\s+aadhaar",
        r"([A-Za-z ]+)\s+pan",
        r"([A-Za-z ]+)\s+passport",
    ]

    for p in patterns:
        m = re.search(p, q, re.I)
        if m:
            return m.group(1).strip()

    m = re.search(r"\b([A-Za-z]{3,}\s+[A-Za-z]{3,})\b", q)
    return m.group(1).strip() if m else ""

def detect_gender(q: str) -> str:
    if re.search(r"\bmale\b", q, re.I):
        return "Male"
    if re.search(r"\bfemale\b", q, re.I):
        return "Female"
    return ""

def detect_document_type(q: str) -> str:
    q = q.lower().strip()

    # ---------- STRONG IDENTIFIERS (NUMBER PATTERNS) ----------
    if re.search(r"\b\d{12}\b", q):  # Aadhaar number
        return "aadhaar_card"

    if re.search(r"\b[a-z]{5}[0-9]{4}[a-z]\b", q, re.I):  # PAN format
        return "pan_card"

    if re.search(r"\b[a-z][0-9]{7}\b", q, re.I):  # Passport format
        return "passport"

    # ---------- KEYWORD GROUPS ----------
    aadhaar_keywords = ["aadhaar", "aadhar", "uidai", "आधार"]
    pan_keywords = ["pan card", "pan number", "permanent account", "income tax", "पैन"]
    passport_keywords = ["passport", "पासपोर्ट"]
    electricity_keywords = ["electricity bill", "light bill", "bijli bill", "electricity", "bijli", "power bill"]
    marksheet_keywords = ["marksheet", "mark sheet", "scorecard", "result"]
    resume_keywords = ["resume", "cv", "curriculum vitae", "experience", "skills"]

    # ---------- MATCHING (WORD-BOUNDARY SAFE) ----------
    def has_any(keywords):
        return any(re.search(rf"\b{re.escape(k)}\b", q) for k in keywords)

    if has_any(aadhaar_keywords):
        return "aadhaar_card"

    if has_any(pan_keywords):
        return "pan_card"

    if has_any(passport_keywords):
        return "passport"

    if has_any(electricity_keywords):
        return "electricity_bill"

    if has_any(marksheet_keywords):
        return "marksheet"

    if has_any(resume_keywords):
        return "resume"

    return ""

def extract_dob_from_query(q: str):
    m = re.search(r"(\d{1,4}[-/]\d{1,2}[-/]\d{2,4})", q)
    if m:
        d = parse_date(m.group(1))
        if d:
            return {"dob": str(d.date())}
    return {}

def parse_search_query(query: str):
    q = query.strip()

    parsed = {
        "document_type": detect_document_type(q),
        "name": "", #extract_name_from_query(q),
        "gender": detect_gender(q),
        "dob": extract_dob_from_query(q).get("dob", ""),
        "aadhaar_number": "",
        "pan_number": "",
        "keywords": q,
    }

    # Gemini backup if weak signal
    if not parsed["document_type"] or not parsed["name"] or not parsed["aadhaar_number"] or not parsed["pan_number"]:
        prompt = f"""
Convert the user query into JSON.
Return ONLY valid JSON.
Do NOT add explanations, comments, or markdown.
If a field is not present in the query, leave it empty ("").

NORMALIZATION RULES:
- Always return "pan_number" in UPPERCASE letters.
- Always return "aadhaar_number" with NO spaces (digits only).

OUTPUT SCHEMA:
{{
  "document_type": "",       # pan_card, aadhaar_card, resume, qualification, address_proof, other
  "name": "",
  "gender": "",
  "dob": "",
  "aadhaar_number": "",
  "pan_number": "",
  "keywords": "{q}"
}}

QUERY:
{q}
"""
        try:
            response = llm.invoke(prompt)
            g = json.loads(clean_gemini_json(response.content))
            for k in parsed:
                if not parsed[k] and g.get(k):
                    parsed[k] = g[k]
        except:
            pass

    return parsed

def build_answer(query: str, dataList: list):
    q = query.strip()

    # Initialize parsed structure
    parsed = {"ans": ""}

    # Build a context string from dataList
    # Assume dataList is a list of dicts or strings
    context = ""
    if isinstance(dataList, list):
        context = "\n".join(
            [json.dumps(item, ensure_ascii=False) if isinstance(item, dict) else str(item) for item in dataList]
        )

    # Prompt with context
    prompt = f"""
You are a helpful assistant. 
Understand the query and answer ONLY from the provided data list.
If no answer is found, return an empty string ("").

RULES:
- Output STRICT JSON ONLY
- No markdown, comments, or explanations
- Do NOT hallucinate values
- Always follow the schema exactly
- "ans" can be:
  - a string
  - a number
  - a list (e.g., [])
  - an object (e.g., {{}})
- Masking rules:
  - Aadhaar numbers must always be masked: show only last 4 digits, replace others with X (e.g., "XXXX XXXX 6721")
  - PAN numbers must always be masked: show first 5 characters, mask middle 4 digits with X, keep last character (e.g., "APZPNXXXXA")

DATA LIST:
{context}

OUTPUT SCHEMA:
{{
  "ans": ""
}}

QUERY:
{q}
"""

    try:
        response = llm.invoke(prompt)
        g = json.loads(clean_gemini_json(response.content))

        # Merge Gemini result into parsed
        for k in parsed:
            if not parsed[k] and g.get(k):
                parsed[k] = g[k]

    except Exception as e:
        # Optional: log error instead of silent pass
        print(f"Gemini backup failed: {e}")

    return parsed
