import hashlib
import json
import re
from typing import Dict, List

class PostmanScriptEngine:
    @staticmethod
    def execute_prerequest(script_lines: List[str], env_vars: Dict, request_body: Dict) -> Dict:
        """
        Reads the JS lines from frontend and updates the env_vars.
        """
        print("\n🚀 [DEBUG] ENGINE STARTED")
        full_script = " ".join(script_lines)

        # Logic 1: Detect and Execute SHA256 Checksum
        if "CryptoJS.SHA256" in full_script:
            print("✅ Detected CryptoJS.SHA256 logic")
            
            # Pull variables from the environment dictionary
            timestamp = env_vars.get("X-Timestamp", "")
            secret_key = env_vars.get("Secret_Key", "")
            
            # JSON.stringify(jsondata) -> Python json.dumps (no spaces)
            json_payload = json.dumps(request_body, separators=(',', ':'))
            
            # Construct the raw string for hashing
            raw_str = f"{timestamp}{json_payload}{secret_key}"
            
            # Generate SHA256 Hash
            hash_result = hashlib.sha256(raw_str.encode()).hexdigest()
            
            # Update the environment dictionary (Mocking postman.setEnvironmentVariable)
            env_vars['header-checksum'] = hash_result
            env_vars['header-timestamp'] = timestamp
            env_vars['header-AppKey'] = env_vars.get("X-AppKey")
            env_vars['header-SessionToken'] = env_vars.get("X-SessionToken")
            
            print(f"✅ Hash Generated: {hash_result}")
        
        return env_vars