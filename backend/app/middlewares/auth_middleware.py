from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.utils.response import success_response, error_response, throw_error_response
from app.config.env import env
from app.utils.crypto import decrypt_data, encrypt_data
# from app.services.session_service import get_user_session, is_device_blocked



ALLOWED_PATHS = ["/", "/docs","/redoc","/openapi.json"]

class UserApiVerifyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        # 🚀 Allow static files without token
        if request.url.path.startswith("/storage"):
            return await call_next(request)        

        # Skip allowed URLs
        if request.url.path in ALLOWED_PATHS:
            return await call_next(request)
        
        api_token = request.headers.get("PK-apiToken")

        if not api_token:
            return error_response("API Token required", code=5001)
        
        if api_token != env('API_TOKEN'):
            return error_response("Invalid API Token", code=5002)

        # Set defaults
        request.state.country = request.headers.get("PK-country", env("DEFAULT_COUNTRY", "IN"))
        request.state.timezone = request.headers.get("PK-timezone", env("DEFAULT_TZ", "Asia/Kolkata"))
        request.state.dialing_code = 1 if request.state.country == "CA" else 91
        request.state.base_url = str(request.base_url).rstrip("/")

        return await call_next(request)


class UserSessionVerifyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        # Skip allowed URLs
        if request.url.path in ALLOWED_PATHS:
            return await call_next(request)

        session_token = request.headers.get("PK-sessionToken")
        deviceId = request.headers.get("PK-deviceid")
        user_role = request.headers.get("PK-role", "User")
        country = request.headers.get("PK-country", "IN")

        dialing_code = 1 if country == "CA" else 91

        if not session_token:
            return error_response("Session token required", code=5002)

        # DB session check
        auth = '' #get_user_session(session_token, dialing_code)
        # if not auth:
        #     return error_response("Invalid or expired session", code=5003)

        if auth.myStatus == 0:
            return error_response("Account blocked by admin", code=5010)

        # Decrypt token
        decrypt = decrypt_data(session_token)
        if not decrypt or auth.userId != decrypt.get("id"):
            return error_response("Session token mismatch", code=5004)

        # Device blocking logic
        if deviceId and auth.sessionType != "WEB":
            # from app.models.block_device_model import BlockDevice
            block = await BlockDevice.find_one(deviceId, user_role)
            if block:
                return error_response("Device blocked by admin", code=5011)

        # Attach session to request
        request.state.userId = decrypt.get("id")
        request.state.business_id = auth.myBusinessId
        request.state.dialing_code = auth.myDialingCode
        request.state.mobile = auth.myMobile
        request.state.business_status = auth.myEmployeeStatus

        return await call_next(request)

    
# --- Dependency for session verification Middleware ---
def verify_session(request: Request, response: Response,  db=Depends(get_db)):
    session_token = request.headers.get("PK-sessionToken")
    user_role = request.headers.get("PK-role", "User")
    deviceId = request.headers.get("PK-deviceid")
    country = request.headers.get("PK-country", "IN")
    dialing_code = 1 if country == "CA" else 91

    if not session_token:
        return throw_error_response("Session token required", code=5002)
    

    # auth = get_user_session(db, session_token, dialing_code)
    
    if not auth:
        return throw_error_response("Invalid or expired session", code=5003)

    if auth["userStatus"]==0:
        return throw_error_response("Account blocked by admin", code=5010)
    
    decrypt = decrypt_data(session_token)
    print('decrypt ===> ====> : ', decrypt)

    if not decrypt or auth['userId'] != decrypt.get("userId"):
        return throw_error_response("Session token mismatch", code=5004)
    
    # # Device blocking logic
    # if deviceId and auth.sessionType != "WEB":
    #     from app.models.block_device_model import BlockDevice
    #     block = await BlockDevice.find_one(deviceId, user_role)
    #     if block:
    #         return error_response("Device blocked by admin", code=5011)


    # Attach session to request
    request.state.sessionId = auth['sessionId']
    request.state.session_token = auth['session_token']
    request.state.deviceId = auth['deviceId']
    request.state.sessionType = auth['sessionType']
    request.state.lastLoginTime = auth['lastLoginTime']
    request.state.sessionStatus = auth['sessionStatus']
    request.state.userId = auth['userId']
    request.state.username = auth['username']
    request.state.mobile = auth['mobile']
    request.state.dialingCode = auth['dialingCode']
    request.state.userStatus = auth['userStatus']

    return True
# --- Dependency for ADMIN session verification ---