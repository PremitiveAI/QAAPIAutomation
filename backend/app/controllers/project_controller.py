from fastapi import UploadFile, Request
from sqlalchemy.orm import Session
# from rapidfuzz import fuzz
from pathlib import Path
import json, re, math

from app.models.tbl_projects import Projects
from app.models.tbl_documents import Documents
from app.services.project_service import ProjectService, DocumentService
from app.utils.response import success_response, error_response
from app.utils.kyc_document_parser import (ocr_extract_text, extract_details)



# ============================================================
# FILE UTILITIES
# ============================================================
def secure_filename(name: str):
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(name).name)

def save_local_file(user_id: str, employee_id: str , file: UploadFile):
    folder = Path(f"storage/{user_id}/{employee_id}")
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / secure_filename(file.filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return str(path).replace("\\", "/")

def chunk_text(text: str, size=50_000):
    return [text[i:i + size] for i in range(0, len(text), size)]

def normalize(s):
    return " ".join(str(s or "").lower().split())

def is_valid_embedding(vec):
    return (
        isinstance(vec, list)
        and len(vec) > 100
        and all(isinstance(x, (int, float)) and not math.isnan(x) for x in vec)
    )


# ============================================================
# UPDATE DOCUMENT IN DB
# ============================================================
def save_document_and_get_id(db: Session, project_id: str, details: dict):
    doc_id = details.get("id")
    db.query(Documents).filter(Documents.id == doc_id, Documents.project_id == project_id, Documents.status == 1
    ).update({"file_path": details.get("file_path"),"result": details.get("rules")})

    db.commit() # Essential: Push the changes to the database
    # db.refresh(obj)

    updated_doc = db.query(Documents).filter(Documents.id == doc_id, Documents.status == 1).first()
   
    if not updated_doc:
        return None

    data = { 
        "id": updated_doc.id,
        "name": updated_doc.name,
        "result":updated_doc.result,
        "file_path": updated_doc.file_path_url
    }
    return data

def _process_single_file(db: Session, userId: str, project_id:str, file: UploadFile, documents):
    saved_path = save_local_file(userId, project_id, file)
    text = ocr_extract_text(saved_path) # OCR + Extraction

    details = extract_details(text, documents)
    details["file_path"] = saved_path.replace("\\", "/")
   
    updated = save_document_and_get_id(db, project_id, details)     
    return {"details": updated }


class ProjectController:

    @staticmethod
    def project_save(db: Session, payload, request: Request):
        admin_id = 1 # request.state.adminUserId
        if payload.id:
            payload.updatedBy = admin_id
            return ProjectService.update_master(db, Projects, payload.dict(), admin_id)

        payload.createdBy = admin_id
        return ProjectService.create_master(db, Projects, payload.dict(), admin_id)

    @staticmethod
    def list_projects(db: Session, payload):
        return ProjectService.list_projects(db, Projects, payload.dict())

    @staticmethod
    def get_project(db: Session, id: int):
        return ProjectService.get_master_by_id(db, Projects, id)

    @staticmethod
    def delete_project(db: Session, id: int, request: Request):
        admin_id = 1 # request.state.adminUserId
        return ProjectService.delete_master(db, Projects, id, updatedBy=admin_id)
    


class DocumentController:

    @staticmethod
    def document_save(db: Session, payload, request: Request):
        admin_id = 1 # request.state.adminUserId

        if not payload.project_id:
            return error_response("Project id requred", 4040)

        project = db.query(Projects).filter(Projects.id == payload.project_id, Projects.status == 1).first()
        if not project:
            return error_response("Project id not found", 4040)
            
        
        if payload.id:
            payload.updatedBy = admin_id
            return DocumentService.update_doc(db, Documents, payload.dict(), admin_id)

        payload.createdBy = admin_id
        return DocumentService.create_doc(db, Documents, payload.dict(), admin_id)

    @staticmethod
    def list_documents(db: Session, payload):

        if not payload.project_id:
            return error_response("Project id requred", 4040)

        project = db.query(Projects).filter(Projects.id == payload.project_id, Projects.status == 1).first()
        if not project:
            return error_response("Project id not found", 4040)
        
        return DocumentService.list_doc(db, Documents, payload.dict())

    @staticmethod
    def get_document(db: Session, id: int):
        return DocumentService.get_doc(db, Documents, id)

    @staticmethod
    def delete_document(db: Session, id: int, request: Request):
        admin_id = 1 # request.state.adminUserId
        return DocumentService.delete_doc(db, Documents, id, updatedBy=admin_id)
    

    # ============================================================
    # MULTI FILE UPLOAD
    # ============================================================
    def handle_upload_documents(db: Session, request:Request , userId: str, project_id: str, files: list[UploadFile]):
        if not files:
            return error_response("No files uploaded", code=4000)
        
        project = db.query(Projects).filter(Projects.id == project_id, Projects.status == 1).first()
        if not project:
            return error_response("Project id not found", 4040)
        
        documents = db.query(Documents).filter(Documents.project_id == project_id, Documents.status == 1).all()
        if not documents:
            return error_response("documents rules not found", 4040)

        document_rules = []

        for doc in documents:
            document_rules.append({
                "id": doc.id,
                "document_name": doc.name,          # Ensure this matches your column name
                "rules": doc.rules                  # SQLAlchemy usually handles JSON columns as lists automatically
            })

        results, failed = [], []

        for file in files:
            try:
                result = _process_single_file(db, userId, project_id, file, document_rules)
                if result['details']:
                    data = {
                        **result,
                        "filename": file.filename,
                        "message": "File uploaded successfully."
                    }
                else:
                    data= {
                        "details": None,
                        "filename": file.filename,
                        "message": "Upload failed. Mandatory fields are missing or invalid."
                    }

                results.append(data)
            except Exception as e:
                failed.append({
                    "filename": file.filename,
                    "error": str(e)
                })        

        return success_response("Files uploaded successfully",{
            "uploaded": len(results),
            "failed": len(failed),
            "results": results,
            "errors": failed
        })


    