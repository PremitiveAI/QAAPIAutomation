# Feature — AI Test Generation

## Overview

Sends an endpoint's shape and a free-text description to Google Gemini, and receives structured test
scenarios — each with a name, a description, request data, and a list of validation rules.

**Status:** Implemented. This is the product's differentiating feature.

## Business purpose

Writing assertions by hand is the slow part of API testing. Given a request body, a sample response and
a sentence like *"cover valid login, wrong password, and a missing username"*, the model proposes
complete scenarios in seconds. The user then edits and approves them.

## User flow

1. Select an API in the workbench.
2. Type a description into the comment box — e.g. "Test valid login, invalid password, missing fields".
3. Click to generate. A loading state appears.
4. Scenarios return, all pre-selected, and the first opens in the **testCases** tab.
5. Untick unwanted scenarios; edit the request or the validation rules of any scenario.
6. Save. Only ticked scenarios are persisted.

## Frontend flow

```
handleAddScriptComment()
  → guard: an API must be selected and the comment non-empty
  → POST /api/testGeneration  { apiId, comment }
  → read data.Success.data.test_scenarios.test_scenario        ← double nesting
  → if empty → toast "No test scenarios generated"
  → attach the current editor scripts to each scenario:
        pre_request_script  = s.pre_request_script  || buildScriptObject(preScript,  "prerequest")
        post_request_script = s.post_request_script || buildScriptObject(postScript, "test")
  → setScenarios(); setSelectedScenarioNames(all); setHasUnsavedScenarios(true)
  → selectFirstScenario() → switch to the testCases tab
```

Generation results are **held in component state only**. Nothing is persisted until the user saves.

## Backend flow

```
POST /api-test/generation
  → TestCaseController.generate_test_case
  → get_api_details(db, apiId)                          Code 4000 if missing
  → custom_serializer(apiDetails)                       SQLAlchemy object → dict
  → normalize_request_body() ×4                         headers, query_params, request_body, response_body
  → generate_test_cases(comment, query_params, request_body, response_body)
      → format_postman_request_body()                   canonicalise to {mode, <mode>}
      → build the prompt
      → llm.invoke([HumanMessage(content=prompt)])      Gemini
      → clean_gemini_json(raw)                          strip ``` fences, extract the first {...}
      → json.loads()                                    → {"test_scenario": []} on failure
  → success_response(...)
```

### `normalize_request_body`

Defensive cleanup before the values reach the prompt. For dicts and lists of dicts, any **string** value
is stripped of `//` comments and re-parsed as JSON where possible:

```python
cleaned = re.sub(r'//.*', '', value).strip()
try:    normalized[key] = json.loads(cleaned)
except: normalized[key] = cleaned
```

This turns a stringified body stored during import back into a real object, so the model sees structure
rather than an escaped string.

### `clean_gemini_json`

```python
text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
text = re.sub(r"```", "", text)
match = re.search(r"\{[\s\S]*\}", text)
return match.group(0).strip() if match else "{}"
```

Greedy `[\s\S]*` takes the outermost braces, so prose before or after the JSON is discarded.

## The prompt

Constructed in [`test_case_llm.py`](../../backend/app/utils/test_case_llm.py). It pins output to strict
JSON, injects the actual request and query shapes as the example values, and passes the response body and
the user's description as context:

```
You are a QA automation assistant. Generate test scenarios in STRICT JSON format.

RULES:
- Output STRICT JSON ONLY (no markdown, no comments, no explanations).
- Do NOT hallucinate missing values.
- Each scenario must include:
  - "scenario_name" - "scenario_details" - "query_params" - "request" - "response"

Validation rules schema:
- "type": one of ["status_code", "response_time_lt", "json_validate"]
- Operators: exists, eq, neq, gt, gte, lt, lte, contains, not_contains, regex, type

OUTPUT FORMAT:
{ "test_scenario": [ { …, "query_params": <actual>, "request": <actual>, "response": [ … ] } ] }

Client description: <the user's comment>
Response body: <the stored example response>
```

Model settings: `temperature=0`, `max_output_tokens=4096`.

> **The prompt advertises four operators the validator does not implement** — `neq`, `lt`,
> `not_contains` and `regex`. Scenarios using them fall through every branch in `validate_response` and
> are recorded as `passed: false` with an empty message, indistinguishable from a real failure.
> [AUDIT.md](../../AUDIT.md) issue 29.

## Scenario schema

The shape the model is asked to produce, and the shape the execution engine consumes:

```json
{
  "scenario_name": "Valid login",
  "scenario_details": "Verify a successful login returns a token",
  "query_params": { "mode": "query", "query": [ { "key": "verbose", "value": "1" } ] },
  "request": { "mode": "raw", "raw": { "username": "demo", "password": "secret" } },
  "response": [
    { "type": "status_code",      "expected": 200 },
    { "type": "response_time_lt", "expected": 500 },
    { "type": "json_validate", "path": "data.token", "operator": "exists" },
    { "type": "json_validate", "path": "data.age",   "operator": "gte", "expected": 18 }
  ],
  "pre_request_script":  { "listen": "prerequest", "script": { "exec": [ ] } },
  "post_request_script": { "listen": "test",       "script": { "exec": [ ] } }
}
```

### Validation rule types

| `type` | Fields | Meaning |
| ------ | ------ | ------- |
| `status_code` | `expected` | HTTP status equality |
| `response_time_lt` | `expected` | Response time in ms strictly less than |
| `json_validate` | `path`, `operator`, `expected?` | Assertion against a value in the JSON body |

`path` uses dotted notation with array indices: `data.items[0].id` → keys `data, items, 0, id`.

### Supported operators

| Operator | Implemented | Behaviour |
| -------- | :---------: | --------- |
| `exists` | ✅ | value is not `None` |
| `eq` | ✅ | `==` |
| `type` | ⚠️ | **only** `expected: "array"` is handled |
| `lte` | ✅ | list → length ≤; scalar → `<=` |
| `gte` | ✅ | `>=`; with a falsy `expected`, degrades to an existence check |
| `gt` | ✅ | `>` |
| `contains` | ⚠️ | **only** when the actual value is a string |
| `neq`, `lt`, `not_contains`, `regex` | ❌ | Advertised in the prompt, **not implemented** |

## API details

[`POST /api-test/generation`](../api/apis-and-test-cases.md#post-api-testgeneration) and
[`POST /api-test/save`](../api/apis-and-test-cases.md#post-api-testsave).

## Validation

**Request:** `generationTestCateReq` requires `apiId: int` and `comment: str`. There is no minimum
length or content check — an empty-ish comment still calls the model and consumes quota.

**Model output:** no schema validation. `json.loads` either succeeds or the function returns
`{"test_scenario": []}`. Malformed scenarios reach the UI and are only rejected at run time.

**Save:** `testCase: List[Dict]` — **no validation of scenario contents whatsoever.**

## Database interaction

| Stage | Operation |
| ----- | --------- |
| Generation | SELECT `tbl_api_endpoints` only — **nothing is written** |
| Save | UPDATE `tbl_api_endpoints.test_scenario` (full array replacement) |

Saving `[]` clears all scenarios — this is how the workbench's reset button works.

## Authentication

`PK-apiToken` only. Note that any token holder can consume your Gemini quota.

## Error handling

| Situation | Result |
| --------- | ------ |
| `apiId` not found | `Code: 4000` |
| Model returns unparseable output | **Success** with `test_scenario: []`; the UI shows "No test scenarios generated" |
| Gemini network/quota failure | Exception → HTTP 500, `Code: 5000` |
| `GOOGLE_API_KEY` missing | The backend **fails to start** — the check runs at import time |
| Backend unreachable | Toast, "Backend not reachable" |

There is no retry, no timeout on the LLM call and no fallback model.

## Dependencies

`langchain-google-genai`, `langchain-core`, a Gemini API key, and `GOOGLE_AI_MODEL`
(default `gemini-2.0-flash`). See [../integrations/google-gemini.md](../integrations/google-gemini.md).

## Known limitations

1. **Four advertised operators are not implemented** — assertions using them silently fail.
2. **No output validation.** A hallucinated or malformed scenario is accepted and stored.
3. **Generation is not persisted.** Navigating away before saving loses everything.
4. **Response context is limited to one example.** Only `item.response[0]` was imported, so the model
   sees a single sample; endpoints with no saved example give it almost nothing to work with.
5. **Regenerating replaces the whole set** — `setScenarios(generatedScenarios)` discards prior edits
   rather than appending.
6. **Editor scripts are copied onto every generated scenario**, so a script written for one case is
   duplicated across all of them.
7. **`max_output_tokens=4096`** caps the response; a request for many scenarios can be truncated
   mid-JSON, which `clean_gemini_json` then fails to parse — yielding a silent empty result.
8. **Sensitive data leaves your network.** The request body, response body and headers of the endpoint
   are sent to Google. Do not generate scenarios against endpoints whose stored examples contain real
   credentials or production PII.
9. **Cost and latency are unbounded and unmonitored** — no caching, no rate limiting, no usage tracking.
