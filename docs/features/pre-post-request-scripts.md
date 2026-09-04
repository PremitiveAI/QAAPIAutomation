# Feature — Pre/Post-Request Scripts

## ⚠️ Read this first

The script editor's autocomplete and type definitions advertise a **larger `pm.*` API than the runtime
implements**. `pm.test(...)` autocompletes, type-checks cleanly, and then **throws at execution time**.

This document lists what actually works. Treat it — not the editor, and not your Postman experience — as
the reference. ([AUDIT.md](../../AUDIT.md) issue 35.)

---

## Overview

JavaScript that runs immediately before a request is sent (`pre_request_script`) or immediately after the
response arrives (`post_request_script`), executed server-side by `js2py` against a hand-built emulation
of Postman's `pm` object.

**Status:** Implemented for manual runs. **Not executed at all for scheduled runs.**

Implementation: [`app/utils/universal_runner.py`](../../backend/app/utils/universal_runner.py).

## Business purpose

Real API suites are not stateless. A login must yield a token that later requests use; a signed request
needs a timestamped SHA-256 checksum. Scripts make chained, authenticated flows possible.

## The supported API

### `pm.environment` and `pm.globals`

Both are backed by the **same** underlying object — a copy of `tbl_collections.env_vars`. Setting a
"global" and setting an "environment" variable are indistinguishable in this implementation.

| Call | Supported | Notes |
| ---- | :-------: | ----- |
| `pm.environment.get(key)` | ✅ | |
| `pm.environment.set(key, value)` | ✅ | Recorded for write-back to the database |
| `pm.environment.has(key)` | ✅ | |
| `pm.globals.get(key)` | ✅ | Same store as `environment` |
| `pm.globals.set(key, value)` | ✅ | |
| `pm.globals.has(key)` | ✅ | |
| `pm.environment.unset(key)` | ❌ | |
| `pm.collectionVariables.*` | ❌ | |

### `pm.request`

| Call | Supported | Notes |
| ---- | :-------: | ----- |
| `pm.request.headers.add({key, value})` | ✅ | Adds **only if absent** |
| `pm.request.headers.upsert({key, value})` | ✅ | Adds or overwrites |
| `pm.request.headers.get(key)` | ✅ | |
| `pm.request.headers.has(key)` | ✅ | |
| `pm.request.headers.all()` | ✅ | Returns the header object |
| `pm.request.body` | ✅ | Read-only view: `{mode, raw\|urlencoded\|formdata}` |
| `pm.request.url` | ❌ | **Advertised by the editor, not implemented** |
| `pm.request.method` | ❌ | **Advertised by the editor, not implemented** |

### `pm.response` — post-request scripts only

| Call | Supported | Notes |
| ---- | :-------: | ----- |
| `pm.response.json()` | ✅ | The parsed response body |
| `pm.response.text()` | ✅ | `JSON.stringify` of the body |
| `pm.response.code` | ⚠️ | Reads `response_body.statusCode`, **defaulting to `200`** — it is *not* the real HTTP status |
| `pm.response.has(key)` | ✅ | Non-standard; not present in Postman |
| `pm.response.get(key)` | ✅ | Non-standard; not present in Postman |
| `pm.response.status` | ❌ | **Advertised, not implemented** |
| `pm.response.headers` | ❌ | **Advertised, not implemented** |
| `pm.response.responseTime` | ❌ | **Advertised, not implemented** |

> `pm.response.code` is the most dangerous item in this table. It looks correct and returns `200` in
> almost every case, regardless of the actual status. Do not branch on it.

### `pm.variables`

| Call | Supported |
| ---- | :-------: |
| `pm.variables.replaceIn(str)` | ✅ — substitutes `{{var}}` from the environment |
| `pm.variables.get(key)` | ❌ **Advertised, not implemented** |
| `pm.variables.set(key, value)` | ❌ **Advertised, not implemented** |

### Legacy and helpers

| Call | Supported | Notes |
| ---- | :-------: | ----- |
| `postman.setEnvironmentVariable(key, value)` | ✅ | Legacy Postman syntax |
| `CryptoJS.SHA256(data).toString()` | ✅ | **Only** `SHA256`, and only `.toString()`. Bridged to Python's `hashlib` |
| `console.log(msg)` | ✅ | Printed to the backend console as `🖥️ [JS Console]: …` |
| `pm.test(name, fn)` | ❌ | **Advertised, not implemented — throws** |
| `pm.expect(value)` | ❌ | **Advertised, not implemented — throws** |
| `pm.sendRequest(opts, cb)` | ❌ | **Advertised, not implemented — throws** |
| `require(...)`, other CryptoJS algorithms, `setTimeout`, `fetch` | ❌ | |

Assertions belong in the scenario's `response` array, not in scripts — see
[ai-test-generation.md](ai-test-generation.md#validation-rule-types).

## Language support

`js2py` implements **ES5.1**. Modern syntax will not parse:

| Syntax | Works |
| ------ | :---: |
| `var`, `function`, `if`, `for` | ✅ |
| `let`, `const` | ✅ in practice |
| `a?.b` optional chaining | ✅ — rewritten before execution (see below) |
| Arrow functions `() => {}` | ❌ |
| Template literals `` `${x}` `` | ❌ |
| Destructuring, spread, `async`/`await`, `class` | ❌ |

Optional chaining is handled by a pre-pass:

```python
# a?.b?.c  →  a && a.b && a.b.c
pattern = re.compile(r'([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\?\.(\w+)')
```

This is a textual rewrite, so `?.` inside a string literal is also rewritten.

## Working examples

**Capture an auth token (post-request):**

```javascript
var data = pm.response.json();
if (data && data.data && data.data.token) {
    pm.environment.set("token", data.data.token);
}
console.log("token captured");
```

**Signed request with a checksum (pre-request):**

```javascript
var jsondata = { "order_id": "123", "exchange": "NSE" };
var ts = pm.environment.get("X-Timestamp");
var secret = pm.environment.get("Secret_Key");
var hash = CryptoJS.SHA256(ts + JSON.stringify(jsondata) + secret).toString();
postman.setEnvironmentVariable("header-checksum", hash);
pm.request.headers.upsert({ key: "X-Checksum", value: hash });
```

**Will not work:**

```javascript
pm.test("status is 200", function () {          // ❌ pm.test is not defined
    pm.expect(pm.response.code).to.equal(200);  // ❌ pm.expect is not defined
});
const auth = `Bearer ${token}`;                 // ❌ template literal
```

## Storage format

```json
{ "listen": "prerequest", "script": { "exec": ["var a = 1;", "pm.environment.set('a', a);"] } }
```

`listen` is `"prerequest"` for pre-request scripts and `"test"` for post-request scripts — Postman's
naming. Stored on `tbl_api_endpoints.pre_request_script` / `post_request_script`, and optionally
per-scenario inside `test_scenario[]`.

**Per-scenario scripts take precedence.** `run_tests` reads `case.get("pre_request_script")` from the
scenario, not from the endpoint, so an endpoint-level script is used only by the synthesised default
scenario.

## Execution flow

```
run_tests (per scenario)
  → if pre_request_script:
        execute_script("pre", collection_details, api_details, db)
          → UniversalJSExecutor.execute(lines, env_vars, headers, body, response)
          → merge non-None results into env_vars
          → UPDATE tbl_collections.env_vars ; db.commit()
          → returns { env, headers, request_body }
        → the returned env/headers/body replace the working copies for this request
  → substitute {{vars}} → send the request
  → if post_request_script:
        api_details["response"] = resp_body
        execute_script("post", ...)  → env written back again
```

### Variables are written back to the database

```python
xx_env_vars = env_vars.copy()
xx_env_vars.update({k: v for k, v in updated_env.items() if v is not None})
db.execute(update(Collection).where(Collection.id == collection_id).values(env_vars=xx_env_vars))
db.commit()
```

Two consequences worth internalising:

- **A run permanently modifies the collection's environment.** A token captured during a run is visible
  in the environment panel afterwards, and persists into the next run.
- **`None` values never overwrite.** A script cannot clear a variable by setting it to `null`.

## Editing

Scripts are edited in Monaco with JavaScript diagnostics enabled and a custom completion provider.
`buildScriptObject` splits the editor content into lines, drops the content entirely if it is only the
placeholder comment (returning `null`), and otherwise preserves every line **including comments**.

> On `/collectionDetails` the **Save API** path uses a shadowed variant that **strips `//` comments**,
> while the **Save Scenarios** path preserves them. [AUDIT.md](../../AUDIT.md) issue 32.

## Validation

`PreRequestEvent` / `PostRequestEvent` validate only the envelope: `listen` must be the correct literal
and `script.exec` must be a list of strings. **The JavaScript itself is never validated server-side** —
syntax errors surface at run time as a caught exception.

## Error handling

```python
except Exception as e:
    return {"error": f"JS Execution Failed: {str(e)}"}
```

`execute_script` then logs and returns `None`, and `run_tests` proceeds **without** the script's effects.
A failed script does not fail the scenario — the request is sent unmodified, typically producing a
confusing authentication failure rather than a clear script error.

Script failures appear only in the backend console, not in the report.

## Security

`js2py` executes user-supplied JavaScript inside the API process. It is **not a security sandbox**, and
`_sha256_bridge` and `_print_bridge` are live Python callables exposed to that context. Treat the ability
to save a script as a privileged operation. [AUDIT.md](../../AUDIT.md) issue 7.

## Known limitations

1. **The editor advertises an API the runtime lacks** — the single biggest source of confusion.
2. **Scheduled runs skip scripts entirely.** [AUDIT.md](../../AUDIT.md) issue 25.
3. **`pm.response.code` is not the HTTP status** — it defaults to `200`.
4. **ES5 only** — no arrow functions, no template literals.
5. **`CryptoJS` supports only `SHA256`** — no MD5, HMAC, AES or Base64 helpers.
6. **`environment` and `globals` are the same store.**
7. **A failed script is silent in the UI** and does not fail the scenario.
8. **Scripts cannot delete a variable.**
9. **No `pm.sendRequest`**, so a script cannot make its own HTTP call.
10. **Scripts are not imported from the Postman collection.** The parser never reads request-level
    `event` blocks, so scripts present in the export must be re-entered by hand.
    See [collection-upload.md](collection-upload.md#known-limitations).
11. `PostmanScriptEngine` in [`postman_engine.py`](../../backend/app/utils/postman_engine.py) is a
    superseded, hard-coded SHA-256 implementation kept only for `debug_script.py`.
