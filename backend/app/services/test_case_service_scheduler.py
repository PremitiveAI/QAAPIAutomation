import requests, json, datetime, re, os
from pathlib import Path
from app.config.env import env
from app.models.tbl_api_test_reports import ApiTestReports

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

# Main execution
def run_tests(collection_id, env_var, api_id, method, API_URL, BASE_HEADERS, test_scenarios = []):
    # Process environment variables for API URL and headers

    test_start_time = datetime.datetime.now() 

    processed_api_url = replace_env_vars(API_URL, env_var)
    processed_headers = process_env_vars(BASE_HEADERS, env_var)
    
    results = []
    summary = {"total": 0, "passed": 0, "failed": 0, "errors": 0}

    for case in test_scenarios:
        scenario_name = case['scenario_name']
        
        try:
            # Process request body for environment variables
            processed_request = process_env_vars(case.get('request', {}), env_var)
            
            # Make API request and measure response time
            start_time = datetime.datetime.now()
            
            response = requests.request(
                method=method,
                url=processed_api_url,
                headers=processed_headers,
                json=processed_request,
                timeout=10
            )

            end_time = datetime.datetime.now()
            response_time = (end_time - start_time).total_seconds() * 1000
            
            # Validate response
            validation_results = validate_response(response, case['response'], response_time)
            
            # Check if all validations passed
            all_passed = all(v['passed'] for v in validation_results)
            
            result_entry = {
                "test_name": scenario_name,
                "scenario_details": case['scenario_details'],
                "input_request": processed_request,
                "input_headers": processed_headers,
                "actual_status": response.status_code,
                "response_time_ms": round(response_time, 2),
                "validations": validation_results,
                "overall_result": "PASS" if all_passed else "FAIL",
                "response_body": response.json() if response.text else "No Body",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            results.append(result_entry)
            summary['total'] += 1
            
            if all_passed:
                summary['passed'] += 1
            else:
                summary['failed'] += 1

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

    return {
        "file_path": output_file,
        "summary": summary,
        "execution_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_execution_time": test_response_time
    }








def scheduler_execute_tests(collection, api):
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

    result = run_tests(collection.id, collection.env_vars, api.id, api.method, api.url, api.headers, test)

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
        

