import os
import re
from pathlib import Path
from datetime import datetime
from app.config.env import env

def secure_filename(name: str):
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)


def save_collection_file(collection_id: int, filename: str, contents: bytes, is_env=False) -> str:
    """
    Save collection or env file under STORAGE_DIR/collections/{collection_id}/
    """

    base_dir = env("STORAGE_DIR")  #SAME ENV LOGIC
    folder = os.path.join(base_dir, "collections", str(collection_id))
    os.makedirs(folder, exist_ok=True)

    _, ext = os.path.splitext(filename)

    prefix = "environment_" if is_env else "collection_"
    new_name = f"{prefix}{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"

    path = os.path.join(folder, new_name)

    with open(path, "wb") as f:
        f.write(contents)

    return path.replace("\\", "/")

def save_test_case_file(collection_id: int, filename: str, contents: bytes, is_env=False) -> str:
    """
    Save collection or env file under STORAGE_DIR/collections/{collection_id}/
    """

    base_dir = env("STORAGE_DIR")  #SAME ENV LOGIC
    folder = os.path.join(base_dir, "collections", str(collection_id))
    os.makedirs(folder, exist_ok=True)

    _, ext = os.path.splitext(filename)

    prefix = "environment_" if is_env else "collection_"
    new_name = f"{prefix}{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"

    path = os.path.join(folder, new_name)

    with open(path, "wb") as f:
        f.write(contents)

    return path.replace("\\", "/")
