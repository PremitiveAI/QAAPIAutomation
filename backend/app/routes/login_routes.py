# app/routes/login_routes.py

from fastapi import APIRouter, Request, Response, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.controllers.auth_controller import AuthController
from app.database.connection import get_db
from app.docs.swagger_headers import SwaggerAPIHeaders, SwaggerSessionHeaders
from app.middlewares.auth_middleware import verify_session

from app.schemas.user_schema import (UserListReq, userOTPGenerateReq, userOTPValidateReq, userSignupReq, userLoginReq, userEmailLoginReq, userUpdateReq, userUpdatePasswordReq)

# Public Routes (No Session Required)
public_router = APIRouter(
    prefix="/user", tags=["User"],
    dependencies=[Depends(SwaggerAPIHeaders)]  # SHOW HEADERS IN SWAGGER
)

# Protected Routes (Session Required)
protected_router = APIRouter(
    prefix="/user", tags=["User"],
    dependencies=[Depends(SwaggerSessionHeaders), Depends(verify_session)]
)



# @public_router.post("/signup")
# async def signup(request: userSignupReq, response: Response, db: Session = Depends(get_db)):
#     result = AuthController.signup(db, request)
#     return result
   
# @public_router.post("/login")
# async def login(request: userLoginReq, response: Response, db: Session = Depends(get_db) ):
#     result = AuthController.login(db, request)
#     return result

# # @public_router.post("/login-email")
# # async def login_email(payload: userEmailLoginReq, db: Session = Depends(get_db)):
# #     email = payload.email
# #     return AuthController.login_with_email(db, email)

# # @public_router.post("/generate-otp")
# # async def generateOTP(request: userOTPGenerateReq, response: Response, db: Session = Depends(get_db)):
# #     result = AuthController.generateOTP(db, request)
# #     return result

# # @public_router.post("/validate-otp")
# # async def validateOTP(request: userOTPValidateReq, response: Response, db: Session = Depends(get_db)):
# #     result = AuthController.validateOTP(db, request)
# #     return result

# @public_router.put("/update-password")
# async def update_password(request: userUpdatePasswordReq, response :Response ,db: Session = Depends(get_db)):
#     result = AuthController.update_password(db, request)
#     return result





# @protected_router.post("/logout")
# async def logout(request: Request, response: Response,db: Session = Depends(get_db)):
#     result = AuthController.logout(db, request)
#     return result

# @protected_router.post("/list")
# def list_users(payload: UserListReq, db: Session = Depends(get_db)):
#     return AuthController.list_users(db, payload.dict())

# @protected_router.post("/update")
# async def update_user_details(request: Request,payload: userUpdateReq,db: Session = Depends(get_db)):
#     payload_dict = payload.dict(exclude_none=True)
#     result = AuthController.updateUserDetails(db, request, payload_dict)
#     return result

# @protected_router.get("/get")
# async def get_user_details(request: Request, response: Response, db: Session = Depends(get_db) ):
#     result = AuthController.getUserDetails(db, request)
#     return result
