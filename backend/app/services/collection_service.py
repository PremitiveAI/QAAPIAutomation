import json
import os
from fastapi import UploadFile
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc

from app.models.tbl_collections import Collection
from app.models.tbl_api_endpoints import ApiEndpoint
from app.models.tbl_environments import Environment

from app.utils.collection_parser import parse_postman_collection
from app.utils.file_validation import validate_json_file
from app.utils.response import error_response, success_response
from app.utils.storage_helper import save_collection_file
from app.utils.crypto import encrypt_simple_id

# from sqlalchemy.orm.attributes import flag_modified

def upload_collection_service(db, file):
    #data = json.load(file.file)
    data = validate_json_file(file)

    name, apis, env_vars = parse_postman_collection(data)
    
    #derive values
    collection_type = "postman"
    collection_path = f"uploads/collections/{file.filename}"
    env_path = f"uploads/env/{file.filename.replace('.json', '_env.json')}"
    
    

    collection = Collection(
        name=name,
        collection_type=collection_type,
        collection_path=collection_path,
        env_path=env_path
    )
    # collection = Collection(name=name)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    db.flush()   # VERY IMPORTANT

    # Read file bytes ONCE
    file.file.seek(0)
    contents = file.file.read()

    #Save collection file
    collection_path = save_collection_file(
        collection.id,
        file.filename,
        contents,
        is_env=False
    )

    #Create env JSON from detected vars
    env_json = {
        "name": f"{name} Environment",
        "values": [
            {"key": v, "value": "", "enabled": True}
            for v in env_vars
        ]
    }

    env_bytes = json.dumps(env_json, indent=2).encode("utf-8")

    env_path = save_collection_file(
        collection.id,
        "environment.json",
        env_bytes,
        is_env=True
    )

    #Update paths in DB
    collection.collection_path = collection_path
    collection.env_path = env_path
    # convert list → dict
    collection.env_vars = {var: "" for var in env_vars}
    db.commit()
    db.refresh(collection)

    #Save env vars in DB
    for var in env_vars:
        db.add(Environment(
            collection_id=collection.id,
            key=var
        ))

    api_response = []
    order_counter = 1  # ✅ start order


    for api in apis:
        api_obj =ApiEndpoint(
            collection_id=collection.id,
            api_order=order_counter,   # ✅ SET ORDER
            name=api["name"],
            method=api["method"],
            url=api["url"],
            headers=api.get("headers"),
            query_params=api.get("query_params"),
            request_body=api.get("request_body"),
            response_body=api.get("response_body"),
            body_type=api.get("body_type"), # ✅ NEW
            has_env_vars=True if env_vars else False
        )
        db.add(api_obj)
        db.flush()

        api_response.append({
            "id": api_obj.id, 
            "api_order": api_obj.api_order,   # ✅ RETURN ORDER
            "name": api_obj.name,
            "method": api_obj.method,
            "url": api_obj.url,
            "headers": api_obj.headers,
            "query_params": api_obj.query_params,
            "request_body": api_obj.request_body,
            "response_body": api_obj.response_body,
            # "body_type": api_obj.body_type # ✅ return type
        })
        order_counter += 1  # ✅ increment

    db.commit()

    return {
        "id": encrypt_simple_id(collection.id), # 🔒 encrypted
        "name": collection.name,
        "collection_type": collection.collection_type,
        "collection_path": collection.collection_path,
        "env_path": collection.env_path,
        "env_variables": collection.env_vars,
        "total_apis": len(api_response),
        # "environment_variables": env_vars,
        "apis": api_response   #APIs INCLUDED
    }

def get_single_api_service(db, collection_id: int, api_id: int):
    api = (
        db.query(ApiEndpoint)
        .filter(
            ApiEndpoint.id == api_id,
            ApiEndpoint.collection_id == collection_id
        )
        .first()
    )

    if not api:
        return None

    return {
        "id": api.id,
        "collection_id": api.collection_id,
        "api_order": api.api_order,  # ✅
        "name": api.name,
        "method": api.method,
        "url": api.url,
        "headers": api.headers,
        "query_params": api.query_params,
        "request_body": api.request_body,
        "response_body": api.response_body,
        "pre_request_script": api.pre_request_script,
        "post_request_script": api.post_request_script,
        # "body_type": api.body_type, # ✅ include body type
        "test_scenario": api.test_scenario,
        "createdAt": api.createdAtFormatted if hasattr(api, "createdAtFormatted") else None
    }
    
def get_environment_service(db: Session, collection_id: int):
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id)
        .first()
    )

    if not collection:
        return None

    return {
        "collection_id": encrypt_simple_id(str(collection.id)),
        "collection_name": collection.name,
        "env_path": collection.env_path,
        "environment_variables": collection.env_vars or {}
    }

def update_environment_service(db: Session, collection_id: int, payload):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()

    if collection is None:
        return None

    # Always initialize if empty
    # Instead of a loop, replace the whole dictionary.
    # If a key is not in payload.variables, it is now effectively deleted.
    collection.env_vars = payload.variables

    # Manually flag the field as modified.
    # SQLAlchemy often fails to detect changes inside a JSON/Dict column.
    # flag_modified(collection, "env_vars")
    
    db.commit()
    db.refresh(collection)

    return {
        "collection_id": encrypt_simple_id(collection.id),
        "collection_name": collection.name,
        "environment_variables": collection.env_vars
    }
    

def upload_environment_service(db: Session, collection_id: int, file: UploadFile):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()

    if not collection:
        return error_response(message=f"Collection with id {collection_id} not found",code=404)

    #Only JSON allowed
    if not file.filename.endswith(".json"):
        return error_response("Only JSON env files allowed",code=400)

    # Save file
    folder = f"storage/collections/{collection_id}"
    os.makedirs(folder, exist_ok=True)

    filename = f"environment_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    file_path = os.path.join(folder, filename)

    content = file.file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    env_json = json.loads(content)

    #Extract Postman env vars
    env_vars = {}
    for item in env_json.get("values", []):
        if item.get("enabled"):
            env_vars[item["key"]] = item.get("value")

    # Save in DB
    collection.env_vars = env_vars
    collection.env_path = file_path

    db.commit()
    db.refresh(collection)

    return success_response(
        "Environment uploaded successfully",
        {
            "id": encrypt_simple_id(collection.id),
            "name": collection.name,
            # "collection_type": collection.collection_type,
            # "collection_path": collection.collection_path,
            "env_path": collection.env_path,
            "env_variables": collection.env_vars
        }
    )

def update_collection_name_service(db: Session,collection_id: int,name: str):
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id)
        .first()
    )

    if not collection:
        return None

    collection.name = name
    db.commit()
    db.refresh(collection)

    return {
        "id": encrypt_simple_id(collection.id),
        "name": collection.name,
        # "collection_type": collection.collection_type,
        # "collection_path": collection.collection_path,
        # "env_path": collection.env_path,
        # "env_vars": collection.env_vars
    }
    
    
def list_collections_service(db: Session, payload):
    query = db.query(Collection)

    # Search
    if payload.search:
        query = query.filter(Collection.name.ilike(f"%{payload.search}%"))

    # Date filter (SAFE)
    if payload.startDate:
        try:
            if payload.startDate.lower() != "string":
                start = datetime.fromisoformat(payload.startDate)
                query = query.filter(Collection.createdAt >= start)
        except ValueError:
            pass  # ignore invalid date safely

    if payload.endDate:
        try:
            if payload.endDate.lower() != "string":
                end = datetime.fromisoformat(payload.endDate)
                query = query.filter(Collection.createdAt <= end)
        except ValueError:
            pass

    # Sorting
    sort_column = getattr(Collection, payload.sort, Collection.createdAt)

    if payload.order.upper() == "DESC":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Pagination
    total = query.count()
    records = (
        query
        .offset(payload.offset)
        .limit(payload.limit)
        .all()
    )

    if not records:
        return None
    
    collections_data = [] 
    for c in records:
        # Fetch APIs for this collection 
        apis = ( 
            db.query(ApiEndpoint) 
            .filter(ApiEndpoint.collection_id == c.id) 
            .order_by(ApiEndpoint.api_order.asc()) 
            .all() 
        )

        api_list = [ 
                { 
                 "id": api.id, 
                 "name": api.name,
                 "url": api.url, 
                 "method": api.method, 
                 "api_order": api.api_order, 
                 "createdAt": api.createdAtFormatted
                } 
                for api in apis
        ]
        
        collections_data.append({
           "id": encrypt_simple_id(c.id), # ✅ short encoded ID
            "name": c.name,
            "createdAt": c.createdAtFormatted,
            "total_apis": len(apis), # ✅ total number of APIs in this collection
            # "apis": api_list
        })
            
    return {
        "total": total, 
        "collections": collections_data
    }
    # return {
    #     "total": total,
    #     # "limit": payload.limit,
    #     # "offset": payload.offset,
    #     "collections": [
    #         {
    #             "id": c.id,
    #             "name": c.name,
    #             # "collection_type": c.collection_type,
    #             # "createdAt": c.createdAt.isoformat() if c.createdAt else None
    #         }
    #         for c in records
    #     ]
    # }
    

def reorder_by_array_service(db: Session,collection_id: int, api_ids: list[int]):
    """
    Update order_id for APIs based on array of api_ids.
    The position in the array determines the new order_id.
    """
    try:
        # Build mapping: api_id -> new order_id
        mapping = {api_id: idx+1 for idx, api_id in enumerate(api_ids)}

        # Fetch all APIs that are in the request
        apis = db.query(ApiEndpoint).filter(ApiEndpoint.id.in_(api_ids)).all()

        # Vidation: check if any requested api_ids are missing in this collection
        found_ids = {api.id for api in apis}
        missing_ids = [api_id for api_id in api_ids if api_id not in found_ids]
        
        if missing_ids: return error_response( f"API IDs {missing_ids} not found in collection {collection_id}", code=4001)
        # if not apis:
        #     return error_response("No APIs found for given IDs", code=404)

        # Update each API's order_id according to mapping
        for api in apis:
            api.api_order = mapping[api.id]
            db.add(api)

        db.commit()

        # Build response showing final mapping
        updated_data = [{"api_id": api.id, "order_id": api.api_order} for api in apis]

        return success_response("API orders updated successfully",{"collection_id": encrypt_simple_id(collection_id), "updated": updated_data })

    except Exception as e:
        db.rollback()
        return error_response(f"Error updating API orders: {str(e)}", code=500)
