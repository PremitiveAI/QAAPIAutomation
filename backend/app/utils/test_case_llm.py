import json
import re

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
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
# HELPERS
# ============================================================

def clean_gemini_json(text: str) -> str:
    """
    Clean Gemini output to extract valid JSON only.
    Removes markdown fences and extracts the first {...} block.
    """
    if not text:
        return "{}"

    # Remove markdown fences
    text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```", "", text)

    # Extract JSON object
    match = re.search(r"\{[\s\S]*\}", text)
    return match.group(0).strip() if match else "{}"


# ============================================================
# MAIN FUNCTION
# ============================================================

# def generate_test_cases(test_scenarios: str, request_body: dict, response_body: dict) -> dict:
#     """
#     Generate structured test scenarios using Gemini LLM.
#     - test_scenarios: client-provided text describing scenarios
#     - request_body: dict representing API request body
#     - response_body: dict representing API response body
#     """

#     prompt = f"""
# You are a QA automation assistant. Generate test scenarios in STRICT JSON format.

# RULES:
# - Output STRICT JSON ONLY (no markdown, no comments, no explanations).
# - Do NOT hallucinate missing values.
# - Use the provided request_body and response_body exactly as given.
# - Each scenario must include: scenario_name, scenario_details, request, response.

# response RULES: 
# "response": {{}}

# OUTPUT SCHEMA:
# {{
#   "test_scenario": [
#     {{
#       "scenario_name": "string",
#       "scenario_details": "string",
#       "request": {{}},
#       "response": {{}}
#     }}
#   ]
# }}

# Client test case description:
# {test_scenarios}

# Request body (JSON):
# {json.dumps(request_body, indent=2)}

# Response body (JSON):
# {json.dumps(response_body, indent=2)}
# """
# **********************************************************
# def generate_test_cases(request_body: dict, response_body: dict, client_description: str) -> str:
#     """
#     Prompt template for Gemini to generate response validation tests.
#     """

#     prompt = f"""
# You are a QA automation assistant. Generate response validation tests in STRICT JSON format.

# RULES:
# - Output STRICT JSON ONLY (no markdown, no comments, no explanations).
# - Do NOT hallucinate missing values.
# - Use the provided request_body and response_body exactly as given.
# - Each test must include: type, path (if applicable), operator (if applicable), expected (if applicable).
# - Use the provided request_body and response_body exactly as given.
# - Each test must include: "type", and if applicable "path", "operator", "expected".
# - Only use operators supported by the compare() function:
#   - exists
#   - eq
#   - neq
#   - gt
#   - gte
#   - lt
#   - lte
#   - contains
#   - not_contains
#   - regex
#   - type

# RESPONSE RULES: 
# [
#   {{
#     "type": "status_code",
#     "expected": 201
#   }},
#   {{
#     "type": "response_time_lt",
#     "expected": 500
#   }},
#   {{
#     "type": "json_validate",
#     "path": "data.user_id",
#     "operator": "exists"
#   }},
#   {{
#     "type": "json_validate",
#     "path": "data.age",
#     "operator": "gte",
#     "expected": 18
#   }},
#   {{
#     "type": "json_validate",
#     "path": "data.email",
#     "operator": "regex",
#     "expected": "^[\\\\w\\\\.-]+@[\\\\w\\\\.-]+\\\\.\\\\w+$"
#   }},
#   {{
#     "type": "json_validate",
#     "path": "data.role",
#     "operator": "eq",
#     "expected": "user"
#   }}
# ]


# OUTPUT SCHEMA:
# {{
#   "test_scenario": [
#     {{
#       "scenario_name": "string",
#       "scenario_details": "string",
#       "request": {{}},
#       "response": [{{}}]
#     }}
#   ]
# }}

# Client description of test cases:
# {client_description}

# Request body (JSON):
# {json.dumps(request_body, indent=2)}

# Response body (JSON):
# {json.dumps(response_body, indent=2)}
# """




# def generate_test_cases(client_description: str, request_body: dict, response_body: dict) -> str:
#     """
#     Build a strict prompt for Gemini to generate test scenarios in the required JSON format.
#     """

#     prompt = f"""
# You are a QA automation assistant. Generate test scenarios in STRICT JSON format.

# RULES:
# - Output STRICT JSON ONLY (no markdown, no comments, no explanations).
# - Do NOT hallucinate missing values.
# - Each scenario must include:
#   - "scenario_name": short descriptive title
#   - "scenario_details": explanation of what is being tested
#   - "request": JSON object representing the API request body
#   - "response": array of validation rules

# Validation rules must follow this schema:
# - "type": one of ["status_code", "response_time_lt", "json_validate"]
# - For "json_validate", include "path", "operator", and optionally "expected".
# - Operators allowed: exists, eq, neq, gt, gte, lt, lte, contains, not_contains, regex, type

# OUTPUT FORMAT:
# {{
#   "test_scenario": [
#     {{
#       "scenario_name": "Successful Transaction - Valid Parameters",
#       "scenario_details": "Test a successful transaction with all valid parameters. Verify response code, merchant ID and transaction number.",
#       "request": {json.dumps(request_body, indent=2)},
#       "response": [
#         {{
#           "type": "status_code",
#           "expected": 201
#         }},
#         {{
#           "type": "response_time_lt",
#           "expected": 500
#         }},
#         {{
#           "type": "json_validate",
#           "path": "data.user_id",
#           "operator": "exists"
#         }},
#         {{
#           "type": "json_validate",
#           "path": "data.age",
#           "operator": "gte",
#           "expected": 18
#         }},
#         {{
#           "type": "json_validate",
#           "path": "data.email",
#           "operator": "regex",
#           "expected": "^[\\\\w\\\\.-]+@[\\\\w\\\\.-]+\\\\.\\\\w+$"
#         }},
#         {{
#           "type": "json_validate",
#           "path": "data.role",
#           "operator": "eq",
#           "expected": "user"
#         }}
#       ]
#     }}
#   ]
# }}

# Client description of test cases:
# {client_description}

# Response body (JSON):
# {json.dumps(response_body, indent=2)}
# """

#     # Send prompt to Gemini
#     response = llm.invoke([HumanMessage(content=prompt)])
#     raw = response.content or ""

#     # Clean and parse JSON
#     cleaned = clean_gemini_json(raw)
#     try:
#         return json.loads(cleaned)
#     except Exception:
#         return {"test_scenario": []}















def normalize_request_body(request_body: dict) -> dict:
    """
    Convert Postman-style request_body to actual request payload
    """
    if not request_body:
        return {}

    mode = request_body.get("mode")

    # 1. RAW (JSON)
    if mode == "raw":
        raw = request_body.get("raw")
        return raw if isinstance(raw, dict) else {}

    # 2. x-www-form-urlencoded
    if mode == "urlencoded":
        data = {}
        for item in request_body.get("urlencoded", []):
            if item.get("key"):
                data[item["key"]] = item.get("value")
        return data

    # 3. multipart/form-data
    if mode == "formdata":
        data = {}
        files = {}

        for item in request_body.get("formdata", []):
            key = item.get("key")
            if not key:
                continue

            if item.get("type") == "file":
                # Placeholder for file upload
                files[key] = "<FILE>"
            else:
                data[key] = item.get("value")

        # Keep both so your executor knows how to send it
        return {
            "data": data,
            "files": files if files else None
        }

    return {}






def format_postman_request_body(request_body: dict) -> dict:
    """
    Ensure request body is always in Postman canonical format:
    {
      "mode": "...",
      "<mode>": ...
    }
    """
    if not request_body:
        return {}

    mode = request_body.get("mode")

    if not mode:
        return request_body

    formatted = {"mode": mode}

    if mode == "raw":
        formatted["raw"] = request_body.get("raw", {})

    elif mode == "urlencoded":
        formatted["urlencoded"] = request_body.get("urlencoded", [])

    elif mode == "formdata":
        formatted["formdata"] = request_body.get("formdata", [])

    elif mode == "query":
        formatted["query"] = request_body.get("query", [])

    return formatted



def generate_test_cases(client_description: str, query_params: dict, request_body: dict, response_body: dict) -> dict:
    """
    Build a strict prompt for Gemini to generate test scenarios in the required JSON format.
    """

    # normalized_request = normalize_request_body(request_body)
    
    formatted_request = format_postman_request_body(request_body)
    formatted_query = format_postman_request_body(query_params)

    prompt = f"""
You are a QA automation assistant. Generate test scenarios in STRICT JSON format.

RULES:
- Output STRICT JSON ONLY (no markdown, no comments, no explanations).
- Do NOT hallucinate missing values.
- Each scenario must include:
  - "scenario_name"
  - "scenario_details"
  - "query_params"
  - "request"
  - "response"

Validation rules schema:
- "type": one of ["status_code", "response_time_lt", "json_validate"]
- Operators: exists, eq, neq, gt, gte, lt, lte, contains, not_contains, regex, type

OUTPUT FORMAT:
{{
  "test_scenario": [
    {{
      "scenario_name": "Valid Request",
      "scenario_details": "Verify API behavior with valid input",
      "query_params": {json.dumps(formatted_query, indent=2)}, 
      "request": {json.dumps(formatted_request, indent=2)},
      "response": [
        {{
          "type": "status_code",
          "expected": 200
        }},
        {{
          "type": "response_time_lt",
          "expected": 500
        }}
      ]
    }}
  ]
}}

Client description:
{client_description}

Response body:
{json.dumps(response_body, indent=2)}
"""

    response = llm.invoke([HumanMessage(content=prompt)])
    raw = response.content or ""

    cleaned = clean_gemini_json(raw)
    try:
        return json.loads(cleaned)
    except Exception:
        return {"test_scenario": []}
