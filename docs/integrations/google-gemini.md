# Integration — Google Gemini

The only external service this application depends on. Used for two unrelated purposes: generating API
test scenarios, and OCR/extraction for uploaded documents.

## Configuration

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `GOOGLE_API_KEY` | **Yes** | — | API key |
| `GOOGLE_AI_MODEL` | No | `gemini-2.0-flash` | Model id |

Client construction, identical in both modules:

```python
GOOGLE_API_KEY = env("GOOGLE_API_KEY").strip().strip('"')
GOOGLE_AI_MODEL = env("GOOGLE_AI_MODEL", default="gemini-2.0-flash")

if not GOOGLE_API_KEY:
    raise Exception("❌ GOOGLE_API_KEY not found")

llm = ChatGoogleGenerativeAI(model=GOOGLE_AI_MODEL, temperature=0, max_output_tokens=4096)
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
```

Three things to note:

1. **This runs at import time, not on first use.** Both modules are imported transitively from
   `app.main`, so a missing key means the **backend will not start**. A missing variable raises
   `AttributeError` on `None.strip()`; an empty one raises the explicit `Exception`.
2. **The key is never passed explicitly.** `ChatGoogleGenerativeAI` picks it up from the environment, so
   `python-dotenv` must have loaded `.env` first — which `app/config/env.py` guarantees.
3. **`embeddings` is constructed in both modules and never used.** Dead initialisation.

`.strip().strip('"')` tolerates a key accidentally wrapped in quotes in `.env`.

## Usage 1 — Test-scenario generation

[`app/utils/test_case_llm.py`](../../backend/app/utils/test_case_llm.py) ·
triggered by `POST /api-test/generation`

| Property | Value |
| -------- | ----- |
| Model | `GOOGLE_AI_MODEL` (default `gemini-2.0-flash`) |
| Temperature | `0` — deterministic output preferred for structured JSON |
| Max output tokens | `4096` |
| Input | The endpoint's query params, request body and example response, plus the user's free-text description |
| Output | `{"test_scenario": [...]}` |

Response cleanup:

```python
text = re.sub(r"```json", "", text, flags=re.IGNORECASE)
text = re.sub(r"```", "", text)
match = re.search(r"\{[\s\S]*\}", text)
return match.group(0).strip() if match else "{}"
```

Greedy matching takes the outermost braces, discarding any prose before or after. If `json.loads` still
fails, the function returns `{"test_scenario": []}` — a **successful** API response with no scenarios.

Full detail: [../features/ai-test-generation.md](../features/ai-test-generation.md).

## Usage 2 — Document OCR and extraction

[`app/utils/kyc_document_parser.py`](../../backend/app/utils/kyc_document_parser.py) ·
triggered by `POST /document/upload`

| Input | Handling |
| ----- | -------- |
| Image | Base64-encoded into a `HumanMessage` with an `image_url` part: *"Extract all readable text from this image. Return plain text only."* |
| PDF | PyMuPDF first. Pages with an embedded text layer cost **zero** Gemini calls; only empty pages are rendered and sent to Vision |
| DOCX | `python-docx` — no Gemini call |

Extracted text is then sent back to Gemini together with the project's rule sets for evaluation.

Full detail: [../features/documents-kyc.md](../features/documents-kyc.md).

## Cost and quota

Nothing in the application meters, caches, throttles or logs model usage. Practical implications:

| Operation | Cost driver |
| --------- | ----------- |
| Test generation | One call per click. Re-generating for the same endpoint costs again — there is no cache |
| Image OCR | One vision call per image |
| Scanned PDF | **One vision call per page** |
| Born-digital PDF | Zero calls |
| DOCX | Zero calls |

Because authentication is a single shared token, **any holder of that token can consume your quota**.
Quota exhaustion surfaces as an unhandled exception → HTTP 500 with `Code: 5000`, with the real cause
visible only in `logs/errors.log`.

## Failure modes

| Failure | Behaviour |
| ------- | --------- |
| Key missing or empty | **Backend fails to start** |
| Key invalid | Exception at call time → HTTP 500, `Code: 5000` |
| Quota exceeded | Same |
| Network failure | Same — no retry, no timeout, no circuit breaker |
| Model returns prose instead of JSON | `clean_gemini_json` extracts what it can; on failure the API returns an **empty scenario list with `Code: 0`** |
| Output truncated at 4096 tokens | JSON is cut mid-document → parse failure → silent empty result |

The last two are the ones to watch: a failure to produce usable output is indistinguishable from a
successful call that found nothing to suggest.

There is no timeout on any Gemini call. A hung request holds the FastAPI worker for as long as the client
library allows.

## Data sent to Google

Be deliberate about this. The integration transmits:

| From | Content |
| ---- | ------- |
| Test generation | The endpoint's **request body, example response body and query parameters**, plus your description |
| Document upload | The **full contents** of every uploaded file |

Test generation therefore sends whatever was captured in the Postman export — which frequently includes
real tokens, real customer records and production identifiers in saved example responses. Document upload
sends KYC material by definition.

Neither path redacts anything, and neither is gated by a configuration flag. If your organisation has
data-residency or PII constraints, review them before enabling this feature — there is no way to use the
product's headline capability without sending endpoint payloads to Google.

## Changing the model

Set `GOOGLE_AI_MODEL` in `backend/.env` and restart:

```ini
GOOGLE_AI_MODEL=gemini-2.0-flash
```

The variable applies to **both** the text and vision paths — they share the same client configuration, so
they cannot be tuned independently. The embeddings model is hard-coded to `models/text-embedding-004`
and, being unused, has no effect.

## Dependencies

| Package | In `requirements.txt` | Purpose |
| ------- | :-------------------: | ------- |
| `langchain-google-genai` | ✅ | `ChatGoogleGenerativeAI`, `GoogleGenerativeAIEmbeddings` |
| `langchain` | ✅ | Pulls in `langchain-core` for `HumanMessage` |
| `pymupdf` | ✅ | PDF text extraction and page rendering |
| `python-docx` | ✅ | DOCX text extraction |
| `Pillow` | ❌ **missing** | Imported by `kyc_document_parser.py`. [AUDIT.md](../../AUDIT.md) issue 2 |

## Known limitations

1. **Fails closed at startup** — no key means no backend, even for features that never call the model.
2. **No caching**, so identical generations cost repeatedly.
3. **No timeout and no retry** on any call.
4. **`max_output_tokens=4096`** silently truncates large generations.
5. **Malformed output is indistinguishable from an empty result.**
6. **No usage tracking or rate limiting**, on a shared-token system.
7. **One model setting for two different workloads.**
8. **Unused embeddings client** constructed in both modules.
9. **No provider abstraction.** Switching to another LLM would require rewriting both modules.
