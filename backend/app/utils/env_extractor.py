import re

ENV_REGEX = re.compile(r"\{\{(.*?)\}\}")

def extract_env_vars(text):
    if not text or not isinstance(text, str):
        return set()
    return set(ENV_REGEX.findall(text))
