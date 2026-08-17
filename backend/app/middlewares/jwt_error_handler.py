# app/middleware/jwt_error_handler.py

from fastapi.responses import JSONResponse
from fastapi import FastAPI
from jose import JWTError

def register_jwt_error_handler(app: FastAPI):

    @app.exception_handler(JWTError)
    async def jwt_exception_handler(_, __):
        return JSONResponse(
            status_code=401,
            content={
                "Success": None,
                "Code": 4010,
                "Error": {"message": "Invalid or expired token"},
            },
        )
