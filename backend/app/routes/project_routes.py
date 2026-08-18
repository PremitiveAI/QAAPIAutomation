from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, Request, UploadFile, File,Body
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db

from app.schemas.user_schema import UserListReq
from app.schemas.collection_schema import projetcCreateReq, documentCreateReq, documentListReq
from app.controllers.project_controller import ProjectController, DocumentController

from app.docs.swagger_headers import SwaggerAPIHeaders, SwaggerSessionHeaders
from app.utils.response import success_response, error_response
# from app.middlewares.auth_middleware import verify_admin_session
from app.utils.postman_engine import PostmanScriptEngine
from app.utils.universal_runner import UniversalJSExecutor
from app.models.tbl_collections import Collection # Import your Collection model
from app.models.tbl_api_endpoints import ApiEndpoint
projectRouter = APIRouter(prefix="/project", tags=["Project Management"], dependencies=[Depends(SwaggerAPIHeaders)])
documentRouter = APIRouter(prefix="/document", tags=["Document Management"], dependencies=[Depends(SwaggerAPIHeaders)])

# # ---------------- Project Flow ----------------

@projectRouter.post("/save" )
def save_project(payload: projetcCreateReq, request: Request, db: Session = Depends(get_db)):
    return ProjectController.project_save(db, payload, request)

@projectRouter.post("/list")
def project_list(payload: UserListReq, db: Session = Depends(get_db)):
    return ProjectController.list_projects(db,payload)

@projectRouter.get("/details/{id}")
def project_details(id: int, db: Session = Depends(get_db)):
    return ProjectController.get_project(db, id)

@projectRouter.delete("/delete/{id}")
def project_delete(id: int,request: Request,db: Session = Depends(get_db)):
    return ProjectController.delete_project(db, id, request)

# @projectRouter.post("/execute-and-save/{collection_id}")
# async def execute_and_save(
#     collection_id: int, 
#     payload: dict, 
#     db: Session = Depends(get_db)
# ):
#     # 1. Fetch the record
#     collection = db.query(Collection).filter(Collection.id == collection_id).first()
#     if not collection:
#         raise HTTPException(status_code=404, detail="Collection not found")

#     # 2. Run the JS Executor
#     # (Passing current DB env_vars)
#     execution_data = UniversalJSExecutor.execute(
#         # payload.get("event", [{}])[0].get("script", {}).get("exec", []),
#         # collection.env_vars
#         payload.get("script", {}).get("exec", []),  # Directly access script -> exec
#         collection.env_vars
#     )

#     # 3. EDIT: Update the DB with the new environment state
#     if "full_environment" in execution_data:
#         # Update the JSON column with the final state from JS
#         collection.env_vars = execution_data["full_environment"]
        
#         # 4. Save to Database
#         db.add(collection)
#         db.commit()
#         db.refresh(collection)

#     return {
#         "status": "Variables Updated in DB",
#         "updated_at": collection.updatedAtFormatted,
#         "current_env": collection.env_vars
#     }


# @projectRouter.post("/execute-and-save/{collection_id}")
# async def execute_and_save(
#     collection_id: int, 
#     payload: dict, 
#     db: Session = Depends(get_db),
#     api_id: int = Header(..., alias="Api-Id") 
# ):
#     # 1. Fetch the Collection (to get the environment variables)
#     collection = db.query(Collection).filter(Collection.id == collection_id).first()
#     if not collection:
#         raise HTTPException(status_code=404, detail="Collection not found")

#     # 2. Fetch the specific API Endpoint
#     endpoint = db.query(ApiEndpoint).filter(
#         ApiEndpoint.id == api_id,
#         ApiEndpoint.collection_id == collection_id
#     ).first()

#     if not endpoint:
#         raise HTTPException(status_code=404, detail="API ID not found in this collection")

#     # 3. MERGE GLOBAL ENV + ENDPOINT DATA
#     # Start with collection-level variables (like base_url, Secret_Key)
#     combined_context = collection.env_vars.copy() if collection.env_vars else {}
    
#     # Inject endpoint-specific data
#     combined_context["current_api_id"] = endpoint.id
#     combined_context["db_header"] = endpoint.headers
#     combined_context["db_body"] = endpoint.request_body

#     # 4. Run the JS Executor
#     script_lines = payload.get("script", {}).get("exec", [])
#     execution_data = UniversalJSExecutor.execute(script_lines, combined_context)

#     # 5. Return everything in the response
#     return {
#         "status": "Success",
#         "read_from_collection_env": collection.env_vars,
#         "read_from_endpoint": {
#             "id": endpoint.id,
#             "headers": endpoint.headers,
#             "body": endpoint.request_body
#         },
#         "js_result": execution_data.get("modified_vars")
#     }
@projectRouter.post("/execute-and-save/{collection_id}")
async def execute_and_save(
    collection_id: int, 
    payload: dict, 
    db: Session = Depends(get_db),
    api_id: int = Header(..., alias="Api-Id") 
):
    # 1. Fetch the Collection
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # 2. Fetch the specific API Endpoint
    endpoint = db.query(ApiEndpoint).filter(
        ApiEndpoint.id == api_id,
        ApiEndpoint.collection_id == collection_id
    ).first()

    if not endpoint:
        raise HTTPException(status_code=404, detail="API ID not found in this collection")

    # 3. MERGE GLOBAL ENV + ENDPOINT DATA
    combined_context = collection.env_vars.copy() if collection.env_vars else {}
    combined_context["current_api_id"] = endpoint.id
    combined_context["db_header"] = endpoint.headers
    combined_context["db_body"] = endpoint.request_body

    # 4. Run the JS Executor
    script_lines = payload.get("script", {}).get("exec", [])
    execution_data = UniversalJSExecutor.execute(script_lines, combined_context)

    # --- 5. UPDATE LOGIC (NEW) ---
    if "full_environment" in execution_data:
        updated_env = execution_data["full_environment"]

        # A. Update Endpoint-specific columns if they were modified in JS
        # We look for the specific keys we injected earlier
        if "db_header" in updated_env:
            endpoint.headers = updated_env.pop("db_header") 
        
        if "db_body" in updated_env:
            endpoint.request_body = updated_env.pop("db_body")

        # B. Update Global Collection Env Vars
        # Remove the helper IDs so they don't clutter the global env_vars
        updated_env.pop("current_api_id", None)
        
        # Save the remaining variables back to the collection
        collection.env_vars = updated_env

        # 6. Commit changes to Database
        db.add(endpoint)
        db.add(collection)
        db.commit()
        db.refresh(endpoint)
        db.refresh(collection)

    # 7. Return everything in the response
    return {
        "status": "Success - Read and Updated",
        "updated_collection_env": collection.env_vars,
        "updated_endpoint": {
            "id": endpoint.id,
            "headers": endpoint.headers,
            "body": endpoint.request_body
        },
        "js_result": execution_data.get("modified_vars")
    }
# # ---------------- Document Flow ----------------

@documentRouter.post("/save" )
def save_document(payload: documentCreateReq, request: Request, db: Session = Depends(get_db)):
    return DocumentController.document_save(db, payload, request)

@documentRouter.post("/list")
def document_list(payload: documentListReq, db: Session = Depends(get_db)):
    return DocumentController.list_documents(db,payload)

@documentRouter.get("/details/{id}")
def document_details(id: int, db: Session = Depends(get_db)):
    return DocumentController.get_document(db, id)

@documentRouter.delete("/delete/{id}")
def document_delete(id: int,request: Request,db: Session = Depends(get_db)):
    return DocumentController.delete_document(db, id, request)



@documentRouter.post("/upload")
async def upload_document_file(files: List[UploadFile] = File(...), project_id: int = 1, request: Request = None, db: Session = Depends(get_db)):
    if not files:
        return error_response("No files uploaded", code = 4002)
    userId = "U-98WZ41BUTTOM" #request.state.userId
    return DocumentController.handle_upload_documents(db, request, userId, project_id, files)

