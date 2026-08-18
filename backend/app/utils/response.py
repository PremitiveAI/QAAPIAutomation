# app/utils/response.py
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from typing import Any, Optional


# --------------------------------------------
# SUCCESS RESPONSE (Always returns JSON)
# --------------------------------------------
# def success_response(
#     message: str,
#     data: Optional[Any] = None,
#     code: int = 0
# ):
#     return JSONResponse(
#         status_code=200,
#         content={
#             "Success": {
#                 "message": message,
#                 "data": data
#             },
#             "Code": code,
#             "Error": None
#         }
#     )
def success_response(
    message: Optional[str] = None,  # message is now optional
    data: Optional[Any] = None,
    code: int = 0
):
    # Build Success dict
    success_content = {}
    
    if message:  # Include message only if provided
        success_content["message"] = message
    
    if data:  # Include data only if provided and not empty
        success_content["data"] = data

    return JSONResponse(
        status_code=200,
        content={
            "Success": success_content,
            "Code": code,
            "Error": None
        }
    )

# --------------------------------------------
# ERROR RESPONSE (THROWS EXCEPTION → STOPS EXECUTION)
# Best used inside dependencies / middleware
# --------------------------------------------
def throw_error_response(
    message: str,
    code: int = 5000
):
    """
    Throws HTTPException with HTTP 200 status
    but in your custom response structure.
    """
    raise HTTPException(
        status_code=200,
        detail={
            "Success": None,
            "Code": code,
            "Error": {
                "message": message
            }
        }
    )


# --------------------------------------------
# ERROR RESPONSE (RETURN JSON)
# Good for controller-level returns
# --------------------------------------------
def error_response(
    message: str = "Error",
    code: int = 5000
):
    return JSONResponse(
        status_code=200,
        content={
            "Success": None,
            "Code": code,
            "Error": {
                "message": message
            }
        }
    )