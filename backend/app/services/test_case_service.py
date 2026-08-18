import requests, json, datetime, re, os
from urllib.parse import urlparse, urlunparse, urlencode
from pathlib import Path
from app.config.env import env
from sqlalchemy import update
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional, Literal, Union

from app.models.tbl_api_test_reports import ApiTestReports
from app.models.tbl_collections import Collection 
from app.models.tbl_api_endpoints import ApiEndpoint

from app.utils.universal_runner import UniversalJSExecutor

# Function to replace environment variables in strings
def replace_env_vars(text, env_vars):
    """Replace {{variable}} placeholders with actual environment variable values"""
    if not isinstance(text, str):
        return text
    
    pattern = r'\{\{(\w+)\}\}'
    
    def replacer(match):
        var_name = match.group(1)
        return str(env_vars.get(var_name, match.group(0)))
    
    return re.sub(pattern, replacer, text)

# Function to process nested dictionaries/lists
def process_env_vars(obj, env_vars):
    """Recursively process objects to replace environment variables"""
    if isinstance(obj, dict):
        return {key: process_env_vars(value, env_vars) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [process_env_vars(item, env_vars) for item in obj]
    elif isinstance(obj, str):
        return replace_env_vars(obj, env_vars)
    else:
        return obj

# Helper function to get nested value from dict using path
def get_nested_value(data, path):
    keys = path.replace('[', '.').replace(']', '').split('.')
    value = data
    for key in keys:
        if key.isdigit():
            value = value[int(key)]
        else:
            value = value.get(key)
            if value is None:
                return None
    return value

# Validation function
def validate_response(response, validations, response_time):
    validation_results = []
    
    for validation in validations:
        val_type = validation.get('type')
        result = {"validation": validation, "passed": False, "message": ""}
        
        try:
            if val_type == 'status_code':
                expected = validation['expected']
                actual = response.status_code
                result['passed'] = actual == expected
                result['message'] = f"Status: {actual} (expected {expected})"
                
            elif val_type == 'response_time_lt':
                expected = validation['expected']
                result['passed'] = response_time < expected
                result['message'] = f"Response time: {response_time}ms (expected < {expected}ms)"
                
            elif val_type == 'json_validate':
                path = validation.get('path')
                operator = validation.get('operator')
                expected = validation.get('expected')
                
                try:
                    response_json = response.json()
                except:
                    result['message'] = "Invalid JSON response"
                    validation_results.append(result)
                    continue
                
                actual_value = get_nested_value(response_json, path)
                
                if operator == 'exists':
                    result['passed'] = actual_value is not None
                    result['message'] = f"{path}: {'exists' if result['passed'] else 'does not exist'}"
                    
                elif operator == 'eq':
                    result['passed'] = actual_value == expected
                    result['message'] = f"{path}: {actual_value} (expected {expected})"
                    
                elif operator == 'type':
                    if expected == 'array':
                        result['passed'] = isinstance(actual_value, list)
                        result['message'] = f"{path}: type is {type(actual_value).__name__} (expected array)"
                    
                elif operator == 'lte':
                    if isinstance(actual_value, list):
                        result['passed'] = len(actual_value) <= expected
                        result['message'] = f"{path}: length {len(actual_value)} (expected <= {expected})"
                    else:
                        result['passed'] = actual_value <= expected
                        result['message'] = f"{path}: {actual_value} (expected <= {expected})"
                    
                elif operator == 'gte':
                    result['passed'] = actual_value >= expected if expected else actual_value is not None
                    result['message'] = f"{path}: {actual_value} (expected >= {expected if expected else 'exists'})"
                    
                elif operator == 'gt':
                    result['passed'] = actual_value > expected
                    result['message'] = f"{path}: {actual_value} (expected > {expected})"
                    
                elif operator == 'contains':
                    if isinstance(actual_value, str):
                        result['passed'] = expected in actual_value
                        result['message'] = f"{path}: '{actual_value}' {'contains' if result['passed'] else 'does not contain'} '{expected}'"
                        
        except Exception as e:
            result['message'] = f"Validation error: {str(e)}"
            
        validation_results.append(result)
    
    return validation_results





# file sanitize logic 
def sanitize_file_path(path: str) -> str:
    if not isinstance(path, str):
        return ""

    path = path.strip()

    # Fix Postman-style Windows paths: \C:\ or /C:/
    if re.match(r"^[\\/][A-Za-z]:", path):
        path = path[1:]

    return os.path.normpath(path)

def normalize_file_paths(src):
    if isinstance(src, str):
        return [src]
    if isinstance(src, list):
        return [p for p in src if isinstance(p, str)]
    return []




# url update logic
def postman_query_to_dict(query_params: dict) -> dict:
    """
    Convert Postman-style query params to dict
    """
    if not query_params or not query_params.get("query"):
        return {}

    query_dict = {}

    for item in query_params.get("query", []):
        key = item.get("key")
        value = item.get("value")

        if key is not None:
            query_dict[key] = value

    return query_dict

def update_url_with_query_params(url: str, query_params: dict) -> str:
    """
    If query params exist:
    - Remove existing query from URL
    - Append query params from Postman-style query
    """

    if not query_params or not query_params.get("query"):
        return url  # nothing to do

    parsed = urlparse(url)

    # Convert Postman query → dict
    query_dict = postman_query_to_dict(query_params)

    # Encode new query string
    new_query = urlencode(query_dict, doseq=True)

    # Rebuild URL (query replaced)
    updated_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

    return updated_url




# Main execution
async def run_tests(db, collection_id, env_var, api_id, method, API_URL, BASE_HEADERS, test_scenarios = []):

    # print("test_scenarios ============> ", test_scenarios)
    results = []
    summary = {"total": 0, "passed": 0, "failed": 0, "errors": 0}

    test_start_time = datetime.datetime.now() 
    # print(f"Starting tests at {datetime.datetime.now()}...\n")
    collection_details = {"collection_id": collection_id, "env_vars": env_var}

    # Process environment variables for API URL and headers
    processed_api_url = replace_env_vars(API_URL, env_var)
    processed_headers = process_env_vars(BASE_HEADERS, env_var)

    # print(f"🌐 API method: {method} / URL: {processed_api_url}")
    # print(f"🔑 Headers: {json.dumps(processed_headers, indent=2)}")

    for case in test_scenarios:
        scenario_name = case['scenario_name']
        # print(f"\n📋 Running: {scenario_name}")        

        

       
        

       
        pre_script = case.get("pre_request_script")
        post_script = case.get("post_request_script")
        
        api_details={
            "api_id":api_id, "method":method, "url":API_URL, "headers": BASE_HEADERS,
            "query_params": case.get("query_params"),
            "body": case.get("request"),
            "pre_request_script": pre_script, 
            "post_request_script": post_script
        }

        
        raw_request = case.get("request")
        raw_query_params = case.get("query_params")

        # This checks if pre_script is not None, not {}, not [], and not "" all at once
        if pre_script:
            final_data = await execute_script("pre", collection_details, api_details, db)

            # print("final_data ==========> ", final_data)
            # print("env ==========> ", final_data.get('env'))
            # print("headers ==========> ", final_data.get('headers'))
            # print("request_body ==========> ", final_data.get('request_body'))

            collection_details["env_vars"] = final_data.get('env')
            env_var = final_data.get('env')
            BASE_HEADERS = final_data.get('headers')

            raw_request = final_data.get('request_body') #case.get("request")
            raw_query_params = case.get("query_params")

            

            
        
        
        
        



        try:
            start_time = datetime.datetime.now() # Make API request and measure response time

            processed_api_url = replace_env_vars(API_URL, env_var)
            processed_headers = process_env_vars(BASE_HEADERS, env_var)

            if raw_request is None:
                processed_request = {}
            elif isinstance(raw_request, (dict, list)):
                processed_request = process_env_vars(raw_request, env_var)
                processed_request = processed_request.get(processed_request.get("mode"))
            else:
                processed_request = {}
                
            request_keyy = {
                "method": method.upper(),
                "url": processed_api_url,
                "headers": processed_headers,
                "timeout": 10
            }
        

            files = []
            payload_data = {}
            is_multipart = False

            if isinstance(processed_request, list):
                for item in processed_request:
                    if not isinstance(item, dict):
                        continue

                    key = item.get("key")
                    if not key:
                        continue

                    if item.get("type") == "file":
                        is_multipart = True

                        for file_path in normalize_file_paths(item.get("src")):
                            file_path = sanitize_file_path(file_path)

                            if os.path.isabs(file_path) and os.path.exists(file_path):
                                files.append(
                                    (
                                        key,
                                        (
                                            os.path.basename(file_path),
                                            open(file_path, "rb")
                                        )
                                    )
                                )
                            else:
                                print(f"⚠️ Warning: File not found or invalid path: {file_path}")
                    else:
                        payload_data[key] = item.get("value")
            else:
                payload_data = processed_request if isinstance(processed_request, dict) else {}




            
            if is_multipart:
                request_keyy["headers"].pop("Content-Type", None)


            if request_keyy["method"] == "GET":
                request_keyy["params"] = raw_query_params or {}
                request_keyy["url"] = update_url_with_query_params(request_keyy["url"], raw_query_params)

            else:
                if files:
                    request_keyy["files"] = files
                    request_keyy["data"] = payload_data or {}
                else:
                    request_keyy["json"] = payload_data or {}
    
            response = requests.request(**request_keyy)

                
            end_time = datetime.datetime.now()
            response_time = (end_time - start_time).total_seconds() * 1000
            
            # Validate response
            validation_results = validate_response(response, case['response'], response_time)
            
            # Check if all validations passed
            all_passed = all(v['passed'] for v in validation_results)
            
            # Try to get JSON body, handle if it's not JSON
            try:
                resp_body = response.json()
            except:
                resp_body = response.text

            if post_script:
                api_details['response'] = resp_body
                post_final_data = await execute_script("post", collection_details, api_details, db)
                collection_details["env_vars"] = post_final_data.get('env')


            result_entry = {
                "test_name": scenario_name,
                "scenario_details": case['scenario_details'],
                "input_query": raw_query_params,
                "input_request": raw_request,  #processed_request, 
                "input_headers": processed_headers,
                "actual_status": response.status_code,
                "response_time_ms": round(response_time, 2),
                "validations": validation_results,
                "overall_result": "PASS" if all_passed else "FAIL",
                # "response_body": response.json() if response.text else "No Body",
                "response_body": resp_body,
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            results.append(result_entry)
            summary['total'] += 1
            
            if all_passed:
                summary['passed'] += 1
                # print(f"   ✅ PASS")
            else:
                summary['failed'] += 1
                # print(f"   ❌ FAIL")
                
            # Print validation details
            # for val in validation_results:
            #     status = "✓" if val['passed'] else "✗"
            #     print(f"      {status} {val['message']}")

        except Exception as e:
            summary['total'] += 1
            summary['errors'] += 1
            results.append({
                "test_name": scenario_name,
                "scenario_details": case['scenario_details'],
                "input_request": case.get('request', {}),
                "input_headers": processed_headers,
                "overall_result": "ERROR",
                "error_message": str(e),
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            # print(f"   ⚠️ ERROR: {e}")

    
    test_end_time = datetime.datetime.now()
    test_response_time = (test_end_time - test_start_time).total_seconds() * 1000
    
    # Save Results to JSON
    storage_root = env("STORAGE_DIR") 
    folder_path = f"{storage_root}/collections/{collection_id}/test_report/{api_id}/"
    os.makedirs(folder_path, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"report_{timestamp}.json"
    output_file = os.path.join(folder_path, filename)

    # 5. Save the JSON data
    report_data = {
        "environment": env_var,
        "summary": summary,
        "test_results": results,
        "execution_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_execution_time": test_response_time
    }

    with open(output_file, "w") as f:
        json.dump(report_data, f, indent=4)

    # Print summary
    print("\n" + "=" * 80)
    print("\n📊 TEST SUMMARY")
    print(f"   Total Tests: {summary['total']}")
    print(f"   ✅ Passed: {summary['passed']}")
    print(f"   ❌ Failed: {summary['failed']}")
    print(f"   ⚠️ Errors: {summary['errors']}")
    print(f"\n📄 Detailed report saved to '{output_file}'")
    print("=" * 80)

    return {
        "file_path": output_file,
        "summary": summary,
        "execution_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_execution_time": test_response_time
    }

async def execute_tests(db, collection, api):
    test = getattr(api, "test_scenario", None)

    if not test:
        test = [{
            "scenario_name": "Default",
            "scenario_details": "Test a default senario.",
            "query_params": api.query_params,
            "request": api.request_body,
            "response": [
                { "type": "status_code", "expected": 200 }
            ],
            "pre_request_script": api.pre_request_script,
            "post_request_script": api.post_request_script
        }]


    result = await run_tests(db, collection.id, collection.env_vars, api.id, api.method, api.url, api.headers, test)
    
    return { 
        "collection_id": collection.id,
        "apiId": api.id,        
        "test_report_file": result["file_path"], 
        "test_total": result["summary"]['total'],
        "test_passed": result["summary"]['passed'],
        "test_failed": result["summary"]['failed'],
        "test_errors": result["summary"]['errors'],
        "total_execution_time": result["total_execution_time"],
    }
        









async def execute_script(script_type = "pre", collection_details = None, api_details = None, db:Optional[Session] = None):

    # print(" api_details ========> ", api_details)
    collection_details = collection_details or {}
    api_details = api_details or {}

    collection_id = collection_details.get("collection_id")
    env_vars = collection_details.get("env_vars") or {}
    api_id = api_details.get("api_id")



    # print("@@@@@env_vars@@@@@ ====================> ", env_vars)

    combined_context = env_vars.copy()    
    # combined_context["db_header"] = api_details.get("headers", {})
    # combined_context["db_body"] = api_details.get("body", {})

    script_lines = []
    
    if script_type == "pre":
        pre_event = api_details.get("pre_request_script") or {}
        script_lines = pre_event.get("script", {}).get("exec", [])
        
    elif script_type == "post":
        post_event = api_details.get("post_request_script") or {}
        script_lines = post_event.get("script", {}).get("exec", [])

    if not script_lines:
        print(f"No {script_type} script lines found to execute.")
        return None

    try:
        execution_data = UniversalJSExecutor.execute(script_lines, combined_context, api_details.get("headers", {}), api_details.get("body", {}), api_details.get("response", {})  )

        # print("execution_data =========== >", execution_data)

        if execution_data and "full_environment" in execution_data:
            updated_env = execution_data["full_environment"]

            # print("updated_env +++++++++++++++++++++++++++=>", updated_env)
            request_headers = execution_data["request_headers"]
            request_body = execution_data["request_body"]

            # endpoint_updates = {}
            # if "db_header" in updated_env:                
            #     endpoint_updates["headers"] = updated_env.pop("db_header")
            # if "db_body" in updated_env:
            #     endpoint_updates["request_body"] = updated_env.pop("db_body") 

            # xx_env_vars = {**env_vars, **updated_env }

            xx_env_vars = env_vars.copy()
            xx_env_vars.update({k: v for k, v in updated_env.items() if v is not None})
            # print("xx_env_vars   =================> ", xx_env_vars)

            db.execute(update(Collection).where(Collection.id == collection_id).values(env_vars=xx_env_vars)) # Update Collection Environment            
            # db.execute(update(ApiEndpoint).where(ApiEndpoint.id == api_id).values(**endpoint_updates)) # Update Endpoint Headers/Body
            db.commit()

            final = {
                "env": xx_env_vars,
                "headers": request_headers, #endpoint_updates.get("headers"),
                "request_body": request_body, #endpoint_updates.get("request_body")
            }

            return final
    except Exception as e:
        print(f"Error executing {script_type} script: {str(e)}")
        return None