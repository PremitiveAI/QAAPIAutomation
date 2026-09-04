from fastapi import APIRouter, File, UploadFile, Request, Response, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.docs.swagger_headers import SwaggerAPIHeaders

from app.controllers.collection_controller import *
from app.controllers.test_case_controller import TestCaseController, APIController
from app.controllers.scheduler_controller import scheduler_create, scheduler_list, scheduler_delete

from app.schemas.collection_schema import EnvironmentCreate, generationTestCateReq, saveTestCateReq, reportListReq, EnvironmentUpdate, CollectionNameUpdate, CollectionListRequest,ReorderByArrayRequest, SchedulerCreateReq, SchedulerListReq #saveAPIReq
from app.schemas.api_schema import SaveAPIReq
from app.services.collection_service import update_environment_service, upload_environment_service

from app.utils.response import success_response
from app.utils.crypto import decrypt_simple_id, encrypt_id # ✅ FIX: import here

collectionRouter = APIRouter(prefix="/collections", tags=["Collection Management"], dependencies=[Depends(SwaggerAPIHeaders)])
environmentRouter = APIRouter(prefix="/environment", tags=["Environment Management"], dependencies=[Depends(SwaggerAPIHeaders)])
apiRouter = APIRouter(prefix="/api", tags=["APIs Management"], dependencies=[Depends(SwaggerAPIHeaders)])
testRouter = APIRouter(prefix="/api-test", tags=["Test Case Management"], dependencies=[Depends(SwaggerAPIHeaders)])
resultRouter = APIRouter(prefix="/report", tags=["Report Management"], dependencies=[Depends(SwaggerAPIHeaders)])
schedulerRouter = APIRouter(prefix="/scheduler", tags=["Scheduler Management"],dependencies=[Depends(SwaggerAPIHeaders)])



############################# Collection Flow #############################

@collectionRouter.post("/upload")
def upload_collection_json(file: UploadFile, db: Session = Depends(get_db)):
    return upload_collection_controller(db, file)

@collectionRouter.get("/{collection_id}")
def get_collection_details(collection_id: str, db: Session = Depends(get_db)):
  return get_collection_controller(db, collection_id)

@collectionRouter.post("/{collection_id}/update-name")
def update_collection_name(collection_id: str, payload: CollectionNameUpdate,db: Session = Depends(get_db)):
    return update_collection_name_controller(db, collection_id, payload)

@collectionRouter.post("/list")
def collection_list_api(payload: CollectionListRequest,db: Session = Depends(get_db)):
    return collection_list_controller(db, payload)

@collectionRouter.post("/reorder_api")
def reorder_api(payload: ReorderByArrayRequest, db: Session = Depends(get_db)):
    return reorder_by_array_controller(db, payload)


############################# Environment Flow #############################

@environmentRouter.post("/{collection_id}/environment/upload")
def upload_environment_json_file(collection_id: str,file: UploadFile = File(...),db: Session = Depends(get_db)):
    # decrypted_id = decrypt_simple_id(collection_id)
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err: 
        return err
    return upload_environment_service(db, decrypted_id, file)

@environmentRouter.get("/{collection_id}/environment")
def get_environment_details(collection_id: str, db: Session = Depends(get_db)):
    return get_environment_controller(db, collection_id)

@environmentRouter.post("/{collection_id}/environment/update")
def update_environment_variables(collection_id: str,payload: EnvironmentUpdate,db: Session = Depends(get_db)):
    # decrypted_id = decrypt_simple_id(collection_id)
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err: 
        return err
    return update_environment_service(db, decrypted_id, payload)




############################# APIs Flow #############################

@apiRouter.get("/{collection_id}/apis")
def get_api_list(collection_id: str, db: Session = Depends(get_db)):
    return list_apis_controller(db, collection_id)

@apiRouter.get("/{collection_id}/apis/{api_id}")
def get_api_details(collection_id: str, api_id: int, db: Session = Depends(get_db)):
    return get_single_api_controller(db, collection_id, api_id)

@apiRouter.post("/{collection_id}/apis")
def save_api_details(collection_id: str, payload: SaveAPIReq, request: Request, db: Session = Depends(get_db)):
    return APIController.save_api(db, collection_id, payload, request)



############################# Test Flow #############################

@testRouter.post("/generation")
def generation_test_case(payload: generationTestCateReq, request: Request, db: Session = Depends(get_db)):
    return TestCaseController.generate_test_case(db, payload, request)

@testRouter.post("/save")
def save_test_case(payload: saveTestCateReq, request: Request, db: Session = Depends(get_db)):
    return TestCaseController.save_test_case(db, payload, request)

@testRouter.get("/run/{collection_id}")
async def run_test_case(collection_id: str, request: Request, db: Session = Depends(get_db)):
    return await TestCaseController.run_test_case(db, collection_id, request)




############################# Report Flow #############################

@resultRouter.post("/list")
def get_report_list(payload: reportListReq, request: Request, db: Session = Depends(get_db)):
    return TestCaseController.get_report_list(db, payload, request)

@resultRouter.get("/details/{report_id}")
def get_report_details(report_id: int, request: Request, db: Session = Depends(get_db)):
    return TestCaseController.get_report_details(db, report_id, request)

@resultRouter.get("/details/{report_id}/api/{api_id}")
def get_api_test_report(report_id: int, api_id: int, request: Request, db: Session = Depends(get_db)):
    return TestCaseController.get_api_test_report(db, report_id, api_id, request)




############################# Scheduler Flow #############################

@schedulerRouter.post("/create")
def create_scheduler(payload: SchedulerCreateReq, request: Request, db: Session = Depends(get_db)):
    return scheduler_create(db, payload, request)

@schedulerRouter.post("/list")
def list_schedulers(payload: SchedulerListReq, request: Request, db: Session = Depends(get_db)):
    return scheduler_list(db, payload, request)

@schedulerRouter.delete("/delete/{scheduler_id}")
def delete_scheduler(scheduler_id: int, request: Request,db: Session = Depends(get_db)):
    return scheduler_delete(db, scheduler_id, request)