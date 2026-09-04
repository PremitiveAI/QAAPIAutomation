# app/config/env.py
import os
from dotenv import load_dotenv

# Detect project root automatically
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..",".."))

load_dotenv(os.path.join(ROOT_DIR, ".env"))

# Expose a global getter
def env(key: str, default=None):
    return os.getenv(key, default)


def update_env_variable(key: str, value: str, env_file=".env"):
    lines = []
    found = False

    # Read existing .env file
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            for line in f:
                if line.startswith(f"{key}="):
                    lines.append(f"{key}={value}\n")
                    found = True
                else:
                    lines.append(line)

    # If key not found, append it
    if not found:
        lines.append(f"{key}={value}\n")

    # Write back to .env file
    with open(env_file, "w") as f:
        f.writelines(lines)

# # Usage
# update_env_variable("BASE_URL", "http://localhost:8000/")
# update_env_variable("BASE_URL", "https://mydomain.com/")

