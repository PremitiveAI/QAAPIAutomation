from fastapi import UploadFile, Request 
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_, asc, desc
from typing import Any, Union
import requests, json, datetime, re, os

from app.models.tbl_collections import Collection
from app.models.tbl_api_endpoints import ApiEndpoint

from app.models.tbl_api_test_reports import ApiTestReports
from app.models.tbl_test_reports import TestReports

from app.utils.test_case_llm import ( generate_test_cases)
from app.utils.response import success_response, error_response
from app.services.test_case_service import execute_tests
from app.services.test_case_service_scheduler import scheduler_execute_tests
from app.utils.crypto import encrypt_simple_id, decrypt_simple_id



def custom_serializer(obj):
    if hasattr(obj, "__dict__"):
        # Remove SQLAlchemy internal attributes if present
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    raise TypeError(f"Type {obj.__class__.__name__} not serializable")

def normalize_request_body(request_body: Union[dict, None]) -> dict:
    """
    Normalize a request_body dict coming from DB.
    
    Handles multiple possibilities:
    - If request_body is None, return empty dict.
    - If 'raw'/'data' values are strings with comments/newlines, clean and parse them.
    - If values are already dict/list, return as-is.
    - If parsing fails, return the cleaned string.
    - Preserves other keys in request_body.
    """
    # if request_body is None:
    #     return {}   # gracefully handle null

    # normalized = {}

    # for key, value in request_body.items():
    #     if isinstance(value, str):
            
    #         # Step 1: Remove JS-style comments
    #         cleaned = re.sub(r'//.*', '', value)

    #         # Step 2: Strip whitespace
    #         cleaned = cleaned.strip()

    #         # Step 3: Try parsing JSON
    #         try:
    #             parsed: Union[dict, list, str] = json.loads(cleaned)
    #             normalized[key] = parsed
    #         except json.JSONDecodeError:
    #             # If parsing fails, just keep the cleaned string
    #             normalized[key] = cleaned

    #     else:
    #         # Already dict/list/other type
    #         normalized[key] = value

    # return normalized
    if request_body is None:
        return {}

    # Case 1: dict
    if isinstance(request_body, dict):
        normalized = {}
        for key, value in request_body.items():
            if isinstance(value, str):
                cleaned = re.sub(r'//.*', '', value).strip()
                try:
                    normalized[key] = json.loads(cleaned)
                except json.JSONDecodeError:
                    normalized[key] = cleaned
            else:
                normalized[key] = value
        return normalized

    # Case 2: list (form-data, urlencoded)
    elif isinstance(request_body, list):
        normalized_list = []
        for item in request_body:
            if isinstance(item, dict):
                normalized_item = {}
                for k, v in item.items():
                    if isinstance(v, str):
                        cleaned = re.sub(r'//.*', '', v).strip()
                        try:
                            normalized_item[k] = json.loads(cleaned)
                        except json.JSONDecodeError:
                            normalized_item[k] = cleaned
                    else:
                        normalized_item[k] = v
                normalized_list.append(normalized_item)
            else:
                normalized_list.append(item)
        return normalized_list

    # Fallback
    return request_body
            
                   
def list_apis_controller(db: Session, collection_id: int):
    return db.query(ApiEndpoint).filter_by(collection_id=collection_id).all()

def get_collection_details(db: Session, collection_id: int):
    return db.query(Collection).filter_by(id=collection_id).first()

def get_api_details(db: Session, api_id: int):
    apiDetails = db.query(ApiEndpoint).filter_by(id=api_id).first()
    return apiDetails

def update_api_details(db: Session, api_id: int, update_data: dict):
    api = db.query(ApiEndpoint).filter_by(id=api_id).first()
    if not api:
        return None

    # Dynamically update fields
    for key, value in update_data.items():
        if hasattr(api, key):   # only update valid attributes
            setattr(api, key, value)

    # print("API ======> ", api)

    db.commit()
    db.refresh(api)
    return api


def update_test_details(db: Session, test_id: int, update_data: dict):
    record = db.query(TestReports).filter_by(id=test_id).first()
    if not record:
        return None

    # Dynamically update fields
    for key, value in update_data.items():
        if hasattr(record, key):   # only update valid attributes
            setattr(record, key, value)

    # print("API ======> ", record)


    db.commit()
    db.refresh(record)
    # return record
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}

def create_test_record(db: Session, model, **kwargs):
    try:
        record = model(**kwargs)
        db.add(record) # Add and Commit
        db.commit()
        db.refresh(record)        
        return record
    
    except SQLAlchemyError as e:
        db.rollback()  # Always rollback on failure
        print(f"Error creating record in {model.__name__}: {e}")
        return None

class TestCaseController:

    @staticmethod
    def generate_test_case(db: Session, payload, request: Request):
        data = payload.dict()  # Convert Pydantic model to dict
        admin_id = getattr(request.state, "adminUserId", 1) # Safely get admin user id from request.state, default to 1 if not set 

        apiDetails = get_api_details(db, data['apiId'])
        if not apiDetails: 
            return error_response(f"API with id {data['apiId']} does not exist", code=4000)
        
        # Convert SQLAlchemy object to dict instead of JSON string
        api_dict = custom_serializer(apiDetails)

        headers = normalize_request_body(api_dict['headers'])
        query_params = normalize_request_body(api_dict['query_params'])
        request_body = normalize_request_body(api_dict['request_body'])
        response_body = normalize_request_body(api_dict['response_body'])
        data = generate_test_cases(data["comment"], query_params, request_body, response_body)
        
        return success_response("fetched successfully", {
            "apiId": api_dict['id'], 
            # "collection_id": api_dict['collection_id'], 
            "name": api_dict['name'], 
            "url": api_dict['url'], 
            "method": api_dict['method'], 
            "body_type": api_dict.get('body_type'), # <--- ADD THIS
            "headers": headers, 
            "query_params": query_params, 
            "request_body": request_body, 
            "response_body": response_body, 
            "has_env_vars": api_dict['has_env_vars'], 
            # "status": api_dict['status'],
            "test_scenarios": data
        })

    def save_test_case(db: Session, payload, request: Request):
        data = payload.dict()  # Convert Pydantic model to dict
        admin_id = getattr(request.state, "adminUserId", 1) # Safely get admin user id from request.state, default to 1 if not set 

        apiDetails = get_api_details(db, data['apiId'])
        if not apiDetails: 
            return error_response(f"API with id {data['apiId']} does not exist", code=4000)  
              
        # testCase = json.dumps(data['testCase'], indent=2) 
        update = update_api_details(db, data['apiId'],  { "test_scenario": data['testCase']})

        return success_response("fetched successfully", {
                "apiId": data["apiId"], 
                # "":,
                "updated_data": update.test_scenario
        })
      

    async def run_test_case(db: Session, collection_id: int, request: Request):

        # decrypted_id = decrypt_simple_id(collection_id)
        decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
        if err:
            return err
        
        test_start_time = datetime.datetime.now() 
        collection = db.query(Collection).filter_by(id=decrypted_id).first()
        if not collection: 
            return error_response(f"Collection with ID {collection_id} not found", code=4000)

        apis = db.query(ApiEndpoint).filter_by(collection_id=decrypted_id,status=1).order_by(ApiEndpoint.api_order.asc()).all()
        
        # Usage for TestReports
        new_report = create_test_record(db, TestReports, 
            collection_id=decrypted_id,  collection_name=collection.name
        )

        # You can now access the created data immediately
        if not new_report:
            return error_response(f"Test execution failed. Please refresh and try again.", code=4000)
        print(f"Created Report ID: {new_report.id}")

        reports_to_save = []

        for api in apis:
            data = await execute_tests(db, collection, api)

            if data:
                report = ApiTestReports(
                    test_id=new_report.id,
                    collection_id=decrypted_id,
                    apiId=data.get('apiId'),
                    test_report_file=data.get('test_report_file'),
                    test_total=data.get('test_total'),
                    test_passed=data.get('test_passed'),
                    test_failed=data.get('test_failed'),
                    test_errors=data.get('test_errors'),
                    total_execution_time=data.get('total_execution_time')
                )
                reports_to_save.append(report)

        # 3. Perform Bulk Save
        if reports_to_save:
            try:
                db.add_all(reports_to_save)  # Adds the entire list at once
                db.commit()                  # Single transaction for all reports
                print(f"Successfully saved {len(reports_to_save)} reports.")
            except Exception as e:
                db.rollback()                # Roll back everything if one fails
                print(f"Failed to bulk save reports: {e}")
        
        test_end_time = datetime.datetime.now()
        total_response_time = (test_end_time - test_start_time).total_seconds() * 1000

        total_apis = len(reports_to_save)
        total_tests = sum(r.test_total for r in reports_to_save)
        total_passed = sum(r.test_passed for r in reports_to_save)
        total_failed = sum(r.test_failed for r in reports_to_save)
        total_errors = sum(r.test_errors for r in reports_to_save)

        update = update_test_details(db, new_report.id,  { 
            "total_apis": total_apis,
            "total_tests": total_tests,
            "total_passed": total_passed,
            "total_failed": total_failed,
            "total_errors": total_errors,
            "total_execution_time": total_response_time,            
        })
        
        return success_response("Test case run successfully",  {
            "report_id":new_report.id,            
            "collection_id": encrypt_simple_id(update.get("collection_id")),
            "collection_name": update.get("collection_name"),
            "total_apis": update.get("total_apis"),
            "total_tests": update.get("total_tests"),
            "total_passed": update.get("total_passed"),
            "total_failed": update.get("total_failed"),
            "total_errors": update.get("total_errors"),
            "total_execution_time": update.get("total_execution_time")
        })
    



    def get_report_list(db: Session, payload, request: Request):

        # 1. Start the base query
        query = db.query(TestReports).filter(TestReports.status == 1)

        # 2. Add Search logic (case-insensitive search on collection name)
        if payload.search:
            query = query.filter(TestReports.collection_name.ilike(f"%{payload.search}%"))

        # 3. Add Sort and Order logic
        sort_column = getattr(TestReports, payload.sort, TestReports.createdAt)
        if payload.order.upper() == "DESC":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))

        # 4. Add Pagination (Limit and Offset)
        query = query.offset(payload.offset).limit(payload.limit)

        # 5. Execute
        reports = query.all()
        
        # Optional: Get total count for frontend pagination
        total_count = db.query(TestReports).filter(TestReports.status == 1).count()


        
        formatted_report = []
        for report in reports:
            test_dict = {
                "id" : report.id,
                "collection_id" : encrypt_simple_id(report.collection_id),
                "collection_name" : report.collection_name,
                "total_apis" : report.total_apis,
                "total_tests" : report.total_tests,
                "total_passed" : report.total_passed,
                "total_failed" : report.total_failed,
                "total_errors" : report.total_errors,
                "total_execution_time" : report.total_execution_time,
                "createdAt" : report.createdAtFormatted,           
            }
            formatted_report.append(test_dict)

        return success_response("fetched successfully", {  
            "count": total_count,         
            "result": formatted_report
        })


    def get_report_details(db: Session, report_id: str, request: Request):
        # decrypted_id = decrypt_simple_id(report_id)
        decrypted_id, err = decrypt_simple_id(report_id, "report_id")
        if err:
            return err  
        report = db.query(TestReports).filter_by(id=decrypted_id).first()
        if not report: 
            return error_response(f"Report with ID {report_id} not found", code=4000)

        # tests = db.query(ApiTestReports).filter_by(test_id=report_id).all()
        tests = db.query(ApiTestReports, ApiEndpoint.name, ApiEndpoint.url, ApiEndpoint.method,ApiEndpoint.body_type) \
            .join(ApiEndpoint, ApiTestReports.apiId == ApiEndpoint.id) \
            .filter(ApiTestReports.test_id == decrypted_id) \
            .all()
        
        formatted_tests = []
        for test, name, url, method ,body_type in tests:
            test_dict = {
                "id": test.id,
                "collection_id": encrypt_simple_id(test.collection_id),
                "apiId": test.apiId,
                "apiName": name,
                "method": method,
                "url": url,
                "body_type": body_type,  # <--- NEW: Including in response
                "test_total": test.test_total,
                "test_passed": test.test_passed,
                "test_errors": test.test_errors,
                "test_failed": test.test_failed,
                "total_execution_time": test.total_execution_time,
                "createdAt": test.createdAtFormatted,            
            }
            formatted_tests.append(test_dict)

        return success_response("fetched successfully", {
            "report": {
                "report_id": report.id,
                "collection_id": encrypt_simple_id(report.collection_id),
                "collection_name": report.collection_name,
                "total_apis": report.total_apis,
                "total_tests": report.total_tests,
                "total_passed": report.total_passed,
                "total_failed": report.total_failed,
                "total_errors": report.total_errors,
                "total_execution_time": report.total_execution_time,
                "createdAt": report.createdAtFormatted
            },
            "result": formatted_tests
        })


    def get_api_test_report(db: Session, report_id: int, api_id: int,  request: Request):
       
        report = db.query(TestReports).filter_by(id=report_id).first()
        if not report: 
            return error_response(f"Report with ID {report_id} not found", code=4000)
        
        apiDetails = get_api_details(db, api_id)
        if not apiDetails: 
            return error_response(f"API with id {api_id} does not exist", code=4000) 

        test = db.query(ApiTestReports).filter_by(test_id=report_id, apiId=api_id, status=1).first()

        # 1. Check if the file actually exists
        if not os.path.exists(test.test_report_file):
            return error_response(f"File not found at {test.test_report_file}", code=404)

        try:
            # 2. Open and read the JSON file
            with open(test.test_report_file, 'r') as f:
                data = json.load(f)

            test_dict = {
                "id": test.id,
                "collection_id": encrypt_simple_id(test.collection_id),
                "apiId": test.apiId,
                "body_type": apiDetails.body_type,  # <--- INJECTING BODY TYPE HERE
                # "test_total": test.test_total,
                # "test_passed": test.test_passed,
                # "test_failed": test.test_failed,
                # "test_errors": test.test_errors,
                # "total_execution_time": test.total_execution_time,
                # "createdAt": test.createdAtFormatted,            
                **data,
            }

            return success_response("fetched successfully", 
                test_dict
            )
            # 3. Return the data inside your success_response
            # return success_response("Data retrieved successfully", data)

        except json.JSONDecodeError:
            return error_response("The file contains invalid JSON formatting", code=500)
        except Exception as e:
            return error_response(f"An error occurred: {str(e)}", code=500)

       




    def run_scheduler_test_case(db: Session, collection_id: int):
        test_start_time = datetime.datetime.now() 
        collection = db.query(Collection).filter_by(id=collection_id, status=1).first()
        if not collection: 
            return print(f"Collection with ID {collection_id} not found")

        apis = db.query(ApiEndpoint).filter_by(collection_id=collection_id,status=1).order_by(ApiEndpoint.api_order.asc()).all()
        
        # Usage for TestReports
        new_report = create_test_record(db, TestReports, collection_id=collection_id, collection_name=collection.name)

        # You can now access the created data immediately
        if not new_report:
            return error_response(f"Test execution failed. Please refresh and try again.", code=4000)
        print(f"Created Report ID: {new_report.id}")

        reports_to_save = []

        for api in apis:
            data = scheduler_execute_tests(collection, api)

            if data:
                report = ApiTestReports(
                    test_id=new_report.id,
                    collection_id=data.get('collection_id'),
                    apiId=data.get('apiId'),
                    test_report_file=data.get('test_report_file'),
                    test_total=data.get('test_total'),
                    test_passed=data.get('test_passed'),
                    test_failed=data.get('test_failed'),
                    test_errors=data.get('test_errors'),
                    total_execution_time=data.get('total_execution_time')
                )
                reports_to_save.append(report)

        # 3. Perform Bulk Save
        if reports_to_save:
            try:
                db.add_all(reports_to_save)  # Adds the entire list at once
                db.commit()                  # Single transaction for all reports
                print(f"Successfully saved {len(reports_to_save)} reports.")
            except Exception as e:
                db.rollback()                # Roll back everything if one fails
                print(f"Failed to bulk save reports: {e}")
        
        test_end_time = datetime.datetime.now()
        total_response_time = (test_end_time - test_start_time).total_seconds() * 1000

        total_apis = len(reports_to_save)
        total_tests = sum(r.test_total for r in reports_to_save)
        total_passed = sum(r.test_passed for r in reports_to_save)
        total_failed = sum(r.test_failed for r in reports_to_save)
        total_errors = sum(r.test_errors for r in reports_to_save)

        update_test_details(db, new_report.id,{ 
            "total_apis": total_apis,
            "total_tests": total_tests,
            "total_passed": total_passed,
            "total_failed": total_failed,
            "total_errors": total_errors,
            "total_execution_time": total_response_time,            
        })
        




class APIController:
    @staticmethod
    def save_api(db: Session, collection_id: int, payload, request: Request):
        data = payload.dict()  # Convert Pydantic model to dict
        admin_id = getattr(request.state, "adminUserId", 1) # Safely get admin user id from request.state, default to 1 if not set 

        apiDetails = get_api_details(db, data['apiId'])
        if not apiDetails: 
            return error_response(f"API with id {data['apiId']} does not exist", code=4000)  
              
        # testCase = json.dumps(data['testCase'], indent=2) 


        ALLOWED_FIELDS = {"name", "method", "url", "headers", "query_params", "request_body", "pre_request_script", "post_request_script", "test_scenario"}
        update_payload = {}

        for field in ALLOWED_FIELDS:
            if field in data and data[field] is not None:
                update_payload[field] = data[field]

        if not update_payload:
            return error_response(f"No fields provided for update")
        
        update = update_api_details(db, data['apiId'],  update_payload )

        return success_response("fetched successfully", {
            "apiId": data['apiId'],
            "name": update.name,
            "method": update.method,
            "url": update.url,
            "headers": update.headers,
            "query_params": update.query_params,
            "request_body": update.request_body,
            "pre_request_script": update.pre_request_script,
            "post_request_script": update.post_request_script,
            "test_scenario": update.test_scenario
        })
    

