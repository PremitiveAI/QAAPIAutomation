# app/middleware/exception_handler.py

import traceback
from fastapi import Request, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.logger import get_logger

logger = get_logger("errors")

class GlobalExceptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)

        except RequestValidationError as err:
            logger.error(f"Validation Error: {err.errors()}")
            return JSONResponse(
                status_code=422,
                content={
                    "Success": None,
                    "Code": 422,
                    "Error": {"message": "Validation error", "details": err.errors()},
                },
            )
        
       

        except Exception as err:
            logger.error(f"Unhandled Error: {str(err)}\n{traceback.format_exc()}")
            return JSONResponse(
                status_code=500,
                content={
                    "Success": None,
                    "Code": 5000,
                    "Error": {"message": "Rajesh Internal server error"},
                },
            )

def register_exception_handlers(app: FastAPI):
    app.add_middleware(GlobalExceptionMiddleware)
