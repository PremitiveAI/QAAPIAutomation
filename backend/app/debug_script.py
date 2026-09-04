from app.utils.postman_engine import PostmanScriptEngine

# 1. Mock Data (The stuff you usually get from Postman JSON)
mock_script = [
    "let jsondata = { \"order_id\":\"123\", \"exchange\":\"NSE\" };",
    "var hash = CryptoJS.SHA256(pm.globals.get('X-Timestamp')+JSON.stringify(jsondata)+pm.globals.get('Secret_Key')).toString();",
    "postman.setEnvironmentVariable('header-checksum', hash);"
]

mock_env = {
    "X-Timestamp": "2026-02-05T12:00:00",
    "Secret_Key": "SECURE_KEY_88",
    "X-AppKey": "APP_123"
}

mock_body = {
    "order_id": "123",
    "exchange": "NSE"
}

# 2. Run the Engine
print("SYSTEM: Triggering Engine Test...")
final_env = PostmanScriptEngine.execute_prerequest(mock_script, mock_env, mock_body)

# 3. Final Verification
if "header-checksum" in final_env:
    print("VERIFICATION: PASSED! The hash is in the environment.")
    print(f"FINAL CHECKSUM: {final_env['header-checksum']}")
else:
    print("VERIFICATION: FAILED! Check the logs above.")