# app/utils/crypto.py

import base64
import hashlib
import json
from cryptography.fernet import Fernet
import urllib.parse
from app.config.env import env
from app.utils.response import error_response


# -------------------------
# Convert normal secret → Fernet key
# -------------------------
def _generate_fernet_key(secret: str) -> bytes:
    sha = hashlib.sha256(secret.encode()).digest()  # 32 bytes
    return base64.urlsafe_b64encode(sha)            # Fernet-compatible


# Load secret from .env
SECRET = env("TOKEN_SECRET")
FERNET_KEY = _generate_fernet_key(SECRET)
fernet = Fernet(FERNET_KEY)


# -------------------------
# Encrypt Data
# -------------------------
def encrypt_data(data: dict) -> str:
    """ Encrypt dictionary → string token. """
    json_str = json.dumps(data)
    token = fernet.encrypt(json_str.encode()).decode()
    return token


# -------------------------
# Decrypt Data
# -------------------------
def decrypt_data(token: str) -> dict:
    """ Decrypt token → dictionary."""
    try:
        decrypted = fernet.decrypt(token.encode()).decode()
        return json.loads(decrypted)
    except Exception:
        return {}


# token = encrypt_data({"id": user.id})
# payload = decrypt_data(session_token)
# userId = payload.get("id")


# -------------------------
# NEW: Simple ID encoder/decoder (shorter, safer) 
# # -------------------------
def encrypt_simple_id(id_value: int) -> str:
    """Encode integer ID into a short base64 string."""
    return base64.urlsafe_b64encode(str(id_value).encode()).decode()

def decrypt_simple_id(enc_id,field_name: str = "id") -> int:
    """Decode short base64 string back into integer ID."""
    try:
        if isinstance(enc_id, int):
            return enc_id,None
        if str(enc_id).isdigit():
            return None , error_response(f"Invalid {field_name} format. Please use encrypted id.", code=400)
        
        enc_id = urllib.parse.unquote(enc_id)
        decoded = base64.urlsafe_b64decode(str(enc_id).encode()).decode()
        return int(decoded), None
    except Exception:  
        return None, error_response(f"Invalid {field_name} format. Please use encrypted id.", code=400)

SENSITIVE = ["password", "otp", "panaadhaar_number", "pan_number"]

def mask_sensitive(body: str):
    try:
        data = json.loads(body)

        if isinstance(data, dict):
            for key in SENSITIVE:
                if key in data:
                    data[key] = "***"
            return json.dumps(data)

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    for key in SENSITIVE:
                        if key in item:
                            item[key] = "***"
            return json.dumps(data)

    except:
        # Fallback simple mask (least accurate)
        for key in SENSITIVE:
            body = body.replace(f'"{key}"', f'"{key}"').replace(key, "***")

    return body


# import base64

# def encrypt_id(id_value: int) -> str:
#     return base64.urlsafe_b64encode(str(id_value).encode()).decode()

# def decrypt_id(enc_id: str) -> int:
#     return int(base64.urlsafe_b64decode(enc_id.encode()).decode())

import base64

SECRET_SALT = "EMPX"

def encrypt_id(id_value: int) -> str:
    raw = f"{SECRET_SALT}:{id_value}"
    return base64.urlsafe_b64encode(raw.encode()).decode()

def decrypt_id(enc_id: str) -> int:
    decoded = base64.urlsafe_b64decode(enc_id.encode()).decode()
    return int(decoded.split(":")[1])






import re

def mask_aadhaar(aadhaar_number: str) -> str:
    # Remove spaces and non-digits
    clean = re.sub(r"\D", "", aadhaar_number)
    if len(clean) == 12:
        return f"XXXX XXXX {clean[-4:]}"
    return aadhaar_number  # fallback if not valid

def mask_pan(pan_number: str) -> str:
    # Uppercase and remove spaces
    clean = pan_number.replace(" ", "").upper()
    # if re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", clean):
    return clean[:5] + "XXXX" + clean[-1]
    # return pan_number  # fallback if not valid

# Example usage
# print(mask_aadhaar("463706016721"))  # XXXX XXXX 6721
# print(mask_pan("apzpn1234a"))          # APZPNXXXXA
