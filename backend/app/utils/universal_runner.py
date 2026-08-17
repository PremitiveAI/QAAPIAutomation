
import js2py
import json
import hashlib

import re

def rewrite_optional_chaining(js_code: str) -> str:
    """
    Converts optional chaining (?.) into ES5-safe checks
    Example:
      a?.b?.c  →  a && a.b && a.b.c
    """

    pattern = re.compile(r'([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\?\.(\w+)')

    while '?.' in js_code:
        js_code = pattern.sub(
            lambda m: f"{m.group(1)} && {m.group(1)}.{m.group(2)}",
            js_code
        )

    return js_code


class UniversalJSExecutor:
    @staticmethod
    def execute(script_lines: list, db_env_vars: dict, db_header: dict, db_body: dict, db_response: dict ):
        js_code = "\n".join(script_lines)

        js_code = rewrite_optional_chaining(js_code)

        # print("js_code ==================>",js_code)
        context = js2py.EvalJs()

        # Bridge: Let JavaScript print to Python Terminal
        def js_print(msg):
            print(f"🖥️  [JS Console]: {msg}")

        def py_sha256(data):
            return hashlib.sha256(str(data).encode()).hexdigest()

        env_json_string = json.dumps(db_env_vars if db_env_vars else {})

        setup_env = f"""
        var output_vars = {{}};
        var current_env = {env_json_string};
        var current_globals = {env_json_string}; // you can separate env vs globals if needed
        var request_headers = {json.dumps(db_header if db_header else {})};
        var request_body = {json.dumps(db_body if db_body else {})};
        var response_body = {json.dumps(db_response if db_response else {})}; 
        
        var pm = {{
            environment: {{
                get: function(key) {{
                    return current_env[key];
                }},
                has: function(key) {{
                    return current_env.hasOwnProperty(key);
                }},
                set: function(key, val) {{
                    current_env[key] = val;
                    output_vars[key] = val;
                }}
            }},
            globals: {{
                get: function(key) {{
                    return current_globals[key];
                }},
                has: function(key) {{
                    return current_globals.hasOwnProperty(key);
                }},
                set: function(key, val) {{
                    current_globals[key] = val;
                    output_vars[key] = val;
                }}
            }},
            request: {{
                headers: {{
                    add: function(header) {{
                        if (!request_headers.hasOwnProperty(header.key)) {{
                            request_headers[header.key] = header.value;
                        }}
                    }},
                    upsert: function(header) {{
                        request_headers[header.key] = header.value;
                    }},
                    get: function(key) {{
                        return request_headers[key];
                    }},
                    has: function(key) {{
                        return request_headers.hasOwnProperty(key);
                    }},
                    all: function() {{
                        return request_headers;
                    }}
                }},
                body: (function() {{
                    var mode = request_body.mode || "raw";
                    if (mode === "raw") {{
                        return {{
                            mode: "raw",
                            raw: request_body.raw || {{}}
                        }};
                    }} else if (mode === "urlencoded") {{
                        return {{
                            mode: "urlencoded",
                            urlencoded: request_body.urlencoded || []
                        }};
                    }} else if (mode === "formdata") {{
                        return {{
                            mode: "formdata",
                            formdata: request_body.formdata || []
                        }};
                    }} else {{
                        return {{
                            mode: mode,
                            raw: ""
                        }};
                    }}
                }})()
            }},

            response: {{
                json: function() {{
                    return response_body || {{}};
                }},
                text: function() {{
                    try {{
                        return JSON.stringify(response_body);
                    }} catch (e) {{
                        return String(response_body);
                    }}
                }},
                code: (response_body && response_body.statusCode) ? response_body.statusCode : 200,
                has: function(key) {{
                    return response_body && response_body.hasOwnProperty(key);
                }},
                get: function(key) {{
                    return response_body ? response_body[key] : undefined;
                }}
            }},

            variables: {{
                replaceIn: function(str) {{
                    return str.replace(/{{(.*?)}}/g, function(match, p1) {{
                        if (current_env.hasOwnProperty(p1)) return current_env[p1];
                        if (current_globals.hasOwnProperty(p1)) return current_globals[p1];
                        return match;
                    }});
                }}
            }}
        }};

        var postman = {{
            setEnvironmentVariable: function(key, val) {{
                current_env[key] = val;
                output_vars[key] = val;
            }}
        }};

        var CryptoJS = {{
            SHA256: function(data) {{
                var h = _sha256_bridge(data);
                return {{ toString: function() {{ return h; }} }};
            }}
        }};
        
        // Allow console.log in JS
        var console = {{ log: _print_bridge }};
        """
        
        context._sha256_bridge = py_sha256
        context._print_bridge = js_print
        context.execute(setup_env)

        try:
            context.execute(js_code)
            
            # Print to terminal for you to see
            # print("--- FINAL ENVIRONMENT ---")
            # print(json.dumps(context.current_env.to_dict(), indent=2))
            
            return {
                # "modified_vars": context.output_vars.to_dict(),
                # "full_environment": context.current_env.to_dict(),

                "modified_vars": context.output_vars.to_dict(), 
                "full_environment": context.current_env.to_dict(),
                "globals": context.current_globals.to_dict(), 
                "request_headers": context.request_headers.to_dict(),
                "request_body": context.pm.request.body.to_dict(),
                "response_body": context.response_body.to_dict()
            }
        except Exception as e:
            return {"error": f"JS Execution Failed: {str(e)}"}