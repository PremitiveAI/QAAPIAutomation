
from sqlalchemy.orm import Session, selectinload
from passlib.context import CryptContext
from sqlalchemy import func, or_
from datetime import datetime, timedelta, timezone
from app.utils.response import success_response, error_response
from app.utils.crypto import encrypt_data, decrypt_data
from app.models.tbl_documents import Documents


IST = timezone(timedelta(hours=5, minutes=30))
# IST = pytz.timezone("Asia/Kolkata")

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = "MY_SECRET_KEY_123"

@staticmethod
def read_payload(payload: dict):
        return {
            "search": payload.get("search", ""),
            "filter": payload.get("filter", ""),
            "startDate": payload.get("startDate"),
            "endDate": payload.get("endDate"),
            "sort": payload.get("sort", "createdAt"),
            "order": payload.get("order", "DESC"),
            "limit": payload.get("limit", 10),
            "offset": payload.get("offset", 0)
        }

def _validate_name(name):
    return bool(name and str(name).strip())

def _null_if_empty(value):
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value

def _doc_response(db,obj):    
    cat = {}
    cat['project_id'] = obj.project_id if hasattr(obj, "project_id") else None
    
    data = {
        "id": obj.id,
        "name": obj.name,
        "rules": obj.rules,
        "rulesCount": len(obj.rules or []),
        "result":obj.result,
        "file_path": obj.file_path_url,
        "createdAt": obj.createdAtFormatted,
        "updatedAt": obj.updatedAtFormatted,
        "status": obj.status
    }

    if hasattr(obj, "project_id") and obj.project_id is not None and cat is not None: 
        data.update(cat)
    return data   

def _project_response(db, obj):
    data = {
        "id": obj.id,
        "name": obj.name,
        "description": obj.description,
        "createdAt": obj.createdAtFormatted,
        "updatedAt": obj.updatedAtFormatted,
        "status": obj.status,
    }

    # Document counts
    total_docs = db.query(func.count(Documents.id)).filter(
        Documents.project_id == obj.id,
        Documents.status == 1,
        Documents.deletedAt.is_(None)
    ).scalar()

    pending_docs = db.query(func.count(Documents.id)).filter(
        Documents.project_id == obj.id,
        Documents.status == 1,
        Documents.deletedAt.is_(None),
        (Documents.file_path.is_(None) | (Documents.file_path == ""))
    ).scalar()

    uploaded_docs = db.query(func.count(Documents.id)).filter(
        Documents.project_id == obj.id,
        Documents.status == 1,
        Documents.deletedAt.is_(None),
        Documents.file_path.isnot(None),
        Documents.file_path != ""
    ).scalar()

    data.update({
        "total_docs": total_docs,
        "pending_docs": pending_docs,
        "uploaded_docs": uploaded_docs
    })

    return data



class ProjectService:

    @staticmethod
    def create_master(db, model, payload: dict, userId: int):
        if not _validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj = model(
            name=payload.get("name").strip(),
            description=_null_if_empty(payload.get("description")),
            createdBy=userId,
            updatedBy=userId
            
        )
        # ✅ ADD THIS (do not remove anything)
        if hasattr(model, "category_id"):
            obj.category_id = payload.get("category_id")

        db.add(obj)
        db.commit()

        # RE-QUERY WITH RELATIONSHIPS
        obj = (
            db.query(model)
            # .options(selectinload(model.created_by_user), selectinload(model.updated_by_user))
            .filter(model.id == obj.id)
            .first()
        )
        return success_response("Created successfully",_project_response(db, obj))

    @staticmethod
    def update_master(db, model, payload: dict, updatedBy: int):
        obj = db.query(model).filter(model.id == payload.get("id")).first()

        if not obj:
            return error_response("Record not found", 4040)

        if not _validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj.name = payload["name"].strip()
        obj.description = _null_if_empty(payload.get("description"))
        obj.imageId = _null_if_empty(payload.get("imageId"))
        obj.imagePath = _null_if_empty(payload.get("imagePath"))
        obj.updatedBy = updatedBy
        
        # ✅ ADD THIS (do not remove anything)
        if hasattr(model, "category_id"):
            obj.category_id = payload.get("category_id")


        db.commit()
        db.refresh(obj)   #THIS LINE IS REQUIRED

        return success_response("Updated successfully", _project_response(db,obj))

    @staticmethod
    def get_master_by_id(db, model, id: int):
        obj = db.query(model).filter(model.id == id, model.status == 1).first()

        if not obj:
            return error_response("Record not found", 4040)

        return success_response("Details fetched successfully", _project_response(db,obj))

    @staticmethod
    def delete_master(db, model, id: int, updatedBy=None):
        obj = db.query(model).filter(model.id == id).first()

        if not obj or obj.status == -1:
            return error_response("Record not found", 4040)

        obj.status = -1
        obj.updatedBy = updatedBy
        obj.deletedAt = datetime.utcnow()

        db.commit()
        return success_response("Deleted successfully")

    @staticmethod
    def list_master(db, model, payload: dict):
        search = payload.get("search", "")
        limit = payload.get("limit", 10)
        offset = payload.get("offset", 0)
        order = payload.get("order", "DESC")

        query = db.query(model).filter(model.status == 1)

        if search:
            query = query.filter(model.name.ilike(f"%{search}%"))
    
        query = query.order_by(
            model.id.desc() if order.upper() == "DESC" else model.id.asc()
        )

        total = query.count()
        records = query.offset(offset).limit(limit).all()

        return success_response("List fetched successfully",{
            "count": total,
            "list": [_project_response(db,r) for r in records]
        })

    
    @staticmethod
    def list_projects(db: Session, model, payload: dict):
        search = payload.get("search", "")
        limit = payload.get("limit", 10)
        offset = payload.get("offset", 0)
        order = payload.get("order", "DESC")

        query = db.query(model).filter(model.status == 1)
        if search:
            query = query.filter(model.name.ilike(f"%{search}%"))
        query = query.order_by(model.id.desc() if order.upper() == "DESC" else model.id.asc())

        total = query.count()
        records = query.offset(offset).limit(limit).all()

        return success_response("Project list fetched successfully", {
            "count": total,
            "list": [_project_response(db, r) for r in records]
        })
    
    @staticmethod
    def list_products_minimal(db, model, payload: dict):
      
        search = payload.get("search", "")
        limit = payload.get("limit", 10)
        offset = payload.get("offset", 0)
        order = payload.get("order", "DESC")

        query = db.query(model).filter(model.status == 1)

        if search:
            query = query.filter(model.name.ilike(f"%{search}%"))

        query = query.order_by(
            model.id.desc() if order.upper() == "DESC" else model.id.asc()
        )

        total = query.count()
        records = query.offset(offset).limit(limit).all()

        # Only include id and name
        list_response = [{"id": r.id, "name": r.name} for r in records]

        return success_response("List fetched successfully", {
            "count": total,
            "list": list_response
        })








class DocumentService:

    @staticmethod
    def create_doc(db, model, payload: dict, userId: int):
        if not _validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj = model(
            name=payload.get("name").strip(),
            rules=_null_if_empty(payload.get("rules")),
            createdBy=userId,
            updatedBy=userId            
        )

        if hasattr(model, "project_id"):
            obj.project_id = payload.get("project_id")

        db.add(obj)
        db.commit()

        obj = (
            db.query(model)
            .filter(model.id == obj.id)
            .first()
        )
        return success_response("Created successfully",_doc_response(db, obj))

    @staticmethod
    def update_doc(db, model, payload: dict, updatedBy: int):
        obj = db.query(model).filter(model.id == payload.get("id")).first()

        if not obj:
            return error_response("Record not found", 4040)

        if not _validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj.name = payload["name"].strip()
        obj.rules = _null_if_empty(payload.get("rules"))
        obj.updatedBy = updatedBy
        
        # ✅ ADD THIS (do not remove anything)
        if hasattr(model, "project_id"):
            obj.project_id = payload.get("project_id")


        db.commit()
        db.refresh(obj)   #THIS LINE IS REQUIRED

        return success_response("Updated successfully", _doc_response(db,obj))

    @staticmethod
    def list_doc(db, model, payload: dict):
        search = payload.get("search", "")
        limit = payload.get("limit", 10)
        offset = payload.get("offset", 0)
        order = payload.get("order", "DESC")
        project_id = payload.get("project_id")

        query = db.query(model).filter(model.status == 1)

        if search:
            query = query.filter(model.name.ilike(f"%{search}%"))

        if project_id:
            query = query.filter(model.project_id == project_id)
        
        query = query.order_by(
            model.id.desc() if order.upper() == "DESC" else model.id.asc()
        )

        total = query.count()
        records = query.offset(offset).limit(limit).all()

        return success_response("List fetched successfully", {
            "count": total,
            "list": [_doc_response(db,r) for r in records]
        })

    @staticmethod
    def get_doc(db, model, id: int):
        obj = db.query(model).filter(model.id == id, model.status == 1).first()

        if not obj:
            return error_response("Record not found", 4040)

        return success_response("Details fetched successfully", _doc_response(db,obj))

    @staticmethod
    def delete_doc(db, model, id: int, updatedBy=None):
        obj = db.query(model).filter(model.id == id).first()

        if not obj or obj.status == -1:
            return error_response("Record not found", 4040)

        obj.status = -1
        obj.updatedBy = updatedBy
        obj.deletedAt = datetime.utcnow()

        db.commit()
        return success_response("Deleted successfully")
