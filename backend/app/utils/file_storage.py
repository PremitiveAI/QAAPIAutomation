import os
import json
from fastapi import UploadFile

BASE_STORAGE_PATH = "storage/collections"

def save_collection_files(
    collection_id: int,
    collection_data: dict,
    env_data: dict | None = None
):
    # collection_15 folder
    folder_path = os.path.join(BASE_STORAGE_PATH, f"collection_{collection_id}")
    os.makedirs(folder_path, exist_ok=True)

    collection_file_path = os.path.join(folder_path, "collection.json")

    with open(collection_file_path, "w", encoding="utf-8") as f:
        json.dump(collection_data, f, indent=2)

    env_file_path = None
    if env_data:
        env_file_path = os.path.join(folder_path, "environment.json")
        with open(env_file_path, "w", encoding="utf-8") as f:
            json.dump(env_data, f, indent=2)

    return collection_file_path, env_file_path
