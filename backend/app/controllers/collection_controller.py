from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.tbl_collections import Collection
from app.models.tbl_api_endpoints import ApiEndpoint
from app.models.tbl_environments import Environment
from app.schemas.collection_schema import  ReorderByArrayRequest
from app.services.collection_service import get_environment_service, list_collections_service, update_environment_service, upload_collection_service,get_single_api_service,update_collection_name_service,reorder_by_array_service
from app.utils.response import error_response, success_response
# from app.utils.response import error_response
# from app.utils.crypto import encrypt_data
from app.utils.crypto import encrypt_simple_id, decrypt_simple_id
# from app.utils.crypto import encrypt_id, decrypt_id
# from app.utils.crypto import decrypt_id # ✅ import the right one



def upload_collection_controller(db, file):
    #Validate file type
    if not file.filename.lower().endswith(".json"):
        return error_response("Only JSON files are allowed",code=400)
    
    result = upload_collection_service(db, file)

    return success_response("Collection uploaded successfully",result)

# 
def list_apis_controller(db, collection_id: str):
    # decrypted_id = decrypt_simple_id(collection_id)
    # apis = db.query(ApiEndpoint).filter_by(collection_id=collection_id).all()
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err: 
        return err
    apis = (
        db.query(ApiEndpoint)
        .filter(ApiEndpoint.collection_id == decrypted_id)
        # .order_by(ApiEndpoint.api_order.asc())  # ✅ ORDER BY
        .order_by(ApiEndpoint.api_order.asc(), ApiEndpoint.updatedAt.desc())
        .all()
    )
    
    if not apis:
        return error_response( f"No APIs found for collection id {collection_id}", code=404)

    data = [
            {
                "id":api.id,  #Encrypted ID
                "api_order": api.api_order,  # ✅
                "name": api.name,
                "method": api.method,
                "url": api.url,
                "headers": api.headers,
                "query_params": api.query_params,
                "request_body": api.request_body,
                "response_body": api.response_body,
            }
            for api in apis
        ]
    return success_response("API list fetched successfully",data)


def get_collection_controller(db, collection_id: str):
    # decrypted_id = int(decrypt_id(collection_id))
    decrypted_id,err = decrypt_simple_id(collection_id,"collection_id")
    if err:
        return err   
    collection = db.query(Collection).filter_by(id=decrypted_id).first()
    if not collection:
        return error_response( f"Collection with id {collection_id} not found", code=404)

    return success_response(
        "Collection fetched successfully",
        {
            "id": encrypt_simple_id(collection.id),
            "name": collection.name,
            "collection_type": collection.collection_type,
            "collection_path": collection.collection_path,
            "env_path": collection.env_path
        }
    )

def update_environment_controller(db, collection_id: str, env):
    # decrypted_id = decrypt_simple_id(collection_id)
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err:
        return err

    result = update_environment_service(db, decrypted_id, env)

    if not result:
        return error_response(message=f"Collection with id {collection_id} not found",code=404)
    return success_response("Environment updated successfully", result)


def get_single_api_controller(db: Session, collection_id: str, api_id: int):
    # decrypted_collection_id = decrypt_simple_id(collection_id)
    decrypted_collection_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err: 
        return err
    api = get_single_api_service(db, decrypted_collection_id , api_id)


    if not api:
        return error_response(f"API with id {api_id} does not belong to collection {collection_id}", code=404)

    # API found
    api["collection_id"] = encrypt_simple_id(str(api["collection_id"]))  # re-encrypt
    return success_response( "API fetched successfully",api)
    
def get_environment_controller(db, collection_id: str):
    # decrypted_id = decrypt_simple_id(collection_id)
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err:
        return err
    
    result = get_environment_service(db, decrypted_id)
    
    if not result:
        return error_response("Environment not found ", code=404)
    # result["collection_id"] = decrypt_simple_id(str(result["collection_id"])) # re-encrypt
    return success_response( "Environment fetch successfully",data=result
)
    
def update_collection_name_controller(db: Session,collection_id: str,payload):
    # decrypted_id = decrypt_simple_id(collection_id)
    decrypted_id, err = decrypt_simple_id(collection_id, "collection_id")
    if err:
        return err
    
    result = update_collection_name_service(db,decrypted_id,payload.name)
    if not result:
        raise HTTPException(status_code=404,detail="Collection not found")
    return success_response("Collection name updated successfully", result)

def collection_list_controller(db: Session, payload):
    result = list_collections_service(db, payload)

    if not result:
        return error_response( message="No collections found",code=404)
    return success_response("Collection list fetched successfully", data=result)
    # return success_response(
    #     message="Collection list fetched successfully",
    #     data=result
    # )
    # Encrypt IDs in list 
    # for c in result["collections"]:
    #     c["id"] = decrypt_simple_id(str(c["id"]))
    # return success_response("Collection list fetched successfully", data=result)

# def update_single_api_order_controller(db, payload: UpdateApiOrderRequest):
#     return update_single_api_order_service(db, payload.collection_id, payload.api_id, payload.new_order)
def reorder_by_array_controller(db, payload: ReorderByArrayRequest): 
    # decrypted_collection_id = decrypt_simple_id(payload.collection_id)
    # api_ids remain plain integers
    decrypted_collection_id, err = decrypt_simple_id(payload.collection_id, "collection_id")
    if err:
        return err
    result = reorder_by_array_service(db, decrypted_collection_id, payload.api_ids)
    return result
    # if result and "updated" in result["data"]: 
    #     # api_id stays plain 
    #     pass
    # result["data"]["collection_id"] = encrypt_simple_id(str(result["data"]["collection_id"])) 
    # return result
    # return reorder_by_array_service(db, payload.collection_id, payload.api_ids)
    
