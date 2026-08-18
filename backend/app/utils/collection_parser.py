# import json

# import re
# from app.utils.env_extractor import extract_env_vars

# def normalize_postman_raw_json(raw: str) -> dict | None:
#     """
#     Converts Postman raw body into valid JSON
#     - removes // comments
#     - converts {{var}} to "{{var}}"
#     """
#     if not raw:
#         return None

#     # 1️⃣ Remove JS-style comments
#     raw = re.sub(r'//.*$', '', raw, flags=re.MULTILINE)

#     # 2️⃣ Convert {{var}} → "{{var}}"
#     raw = re.sub(
#         r'{{\s*([\w\-]+)\s*}}',
#         r'"{{\1}}"',
#         raw
#     )

#     # 3️⃣ Try JSON parsing
#     try:
#         return json.loads(raw)
#     except Exception:
#         return None


# def parse_postman_collection(data):
#     collection_name = data.get("info", {}).get("name", "Unnamed Collection")
#     apis = []
#     env_vars = set()

#     def walk(items):
#         for item in items:
#             if "item" in item:
#                 walk(item["item"])
#                 continue

#             req = item.get("request", {})
#             if not req:
#                 continue

#             # ---- URL ----
#             url = req.get("url")
#             raw_url = url.get("raw") if isinstance(url, dict) else url
#             env_vars.update(extract_env_vars(raw_url))

#             # ---- HEADERS ----
#             headers = {}
#             for h in req.get("header", []):
#                 headers[h.get("key")] = h.get("value")
#                 env_vars.update(extract_env_vars(h.get("value")))

#             # ---- REQUEST BODY ----
#             request_body = None
#             body = req.get("body")
#             if body and body.get("mode") == "raw":
#                 raw_body = body.get("raw")
#                 # try:
#                 #     request_body = json.loads(raw_body)
#                 # except Exception:
#                 #     request_body = raw_body

#                 if raw_body:
#                     # convert {{var}} → "{{var}}"
#                     fixed_body = re.sub(
#                         r'{{\s*(\w+)\s*}}',
#                         r'"{{\1}}"',
#                         raw_body
#                     )

#                     try:
#                         request_body = json.loads(fixed_body)
#                     except Exception:
#                         request_body = json.loads(json.dumps({"_raw": raw_body}))

#                 env_vars.update(extract_env_vars(raw_body))

#             # ---- RESPONSE BODY (🔥 NEW PART) ----
#             response_body = None
#             responses = item.get("response", [])

#             if responses:
#                 first_response = responses[0]  # take first saved response
#                 raw_resp_body = first_response.get("body")

#                 try:
#                     response_body = json.loads(raw_resp_body)
#                 except Exception:
#                     response_body = raw_resp_body

#             apis.append({
#                 "name": item.get("name"),
#                 "method": req.get("method"),
#                 "url": raw_url,
#                 "headers": headers,
#                 "request_body": request_body,
#                 "response_body": response_body  # ✅ FIXED
#             })

#     walk(data.get("item", []))
#     return collection_name, apis, list(env_vars)
import json
import re
from app.utils.env_extractor import extract_env_vars


def normalize_postman_raw_json(raw: str):
    """
    Converts Postman raw body into valid JSON
    - removes // comments
    - converts {{var}} to "{{var}}"
    """
    if not raw:
        return None

    # Remove JS-style comments
    raw = re.sub(r'//.*$', '', raw, flags=re.MULTILINE)

    # Convert {{var}} → "{{var}}"
    raw = re.sub(
        r'{{\s*([\w\-]+)\s*}}',
        r'"{{\1}}"',
        raw
    )

    try:
        return json.loads(raw)
    except Exception:
        return None

def detect_body_type(req: dict) -> str | None:
    body = req.get("body")
    if not body:
        if req.get("url", {}).get("query"):
            return "query"
        return None

    mode = body.get("mode")
    if mode == "formdata":
        return "formdata"
    elif mode == "urlencoded":
        return "urlencoded"
    elif mode == "raw":
        if body.get("options", {}).get("raw", {}).get("language") == "json":
            return "json"
        return "raw"
    elif mode == "graphql":
        return "graphql"
    return None

def parse_postman_collection(data):
    collection_name = data.get("info", {}).get("name", "Unnamed Collection")
    apis = []
    env_vars = set()

    def walk(items):
        for item in items:
            if "item" in item:
                walk(item["item"])
                continue

            req = item.get("request", {})
            if not req:
                continue 

            # ---- URL ----
            url = req.get("url")
            raw_url = url.get("raw") if isinstance(url, dict) else url
            env_vars.update(extract_env_vars(raw_url))

            query_params = None
            query = url.get("query")
            # if request is query:
            if query:
                query_params = {
                    "mode": "query",
                    "query": query,
                }


            # ---- HEADERS ----
            headers = {}
            for h in req.get("header", []):
                headers[h.get("key")] = h.get("value")
                env_vars.update(extract_env_vars(h.get("value")))


            # ---- BODY TYPE DETECTION ----
            body_type = detect_body_type(req)


            # ---- REQUEST BODY (✅ FIXED PROPERLY) ----
            request_body = None
            body = req.get("body")

            # if body and body.get("mode") == "raw":
            if body and body_type == "json":
                raw_body = body.get("raw")
                request_body = {
                    "mode": "raw",
                    "raw": normalize_postman_raw_json(raw_body), # ✅ USE NORMALIZER (THIS IS THE FIX)
                    # "language": "json"
                }                    
                
            elif body and body.get("mode") in ["formdata", "urlencoded"]:
                # request_body = body.get(body.get("mode"))
                request_body = body

            # ---- RESPONSE BODY ----
            response_body = None
            responses = item.get("response", [])

            if responses:
                raw_resp_body = responses[0].get("body")
                try:
                    response_body = json.loads(raw_resp_body)
                except Exception:
                    response_body = raw_resp_body


            

            apis.append({
                "name": item.get("name"),
                "method": req.get("method"),
                "url": raw_url,
                "headers": headers,
                "query_params": query_params,
                "request_body": request_body,
                "response_body": response_body,
                "body_type": body_type # ✅ include type
            })

    walk(data.get("item", []))
    return collection_name, apis, list(env_vars)
