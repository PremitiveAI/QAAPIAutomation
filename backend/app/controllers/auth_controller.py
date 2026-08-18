#app/controllers/auth_controller.py
from fastapi import Request, Response, HTTPException, Depends
from sqlalchemy.orm import Session
from app.services.auth_service import AuthService
# from app.schemas.password_schema import PasswordUpdate
# from app.schemas.user_schema import userEmailLoginReq
from app.utils.response import success_response, error_response
import re

class AuthController:

    # ---------------------- SIGNUP ----------------------
    @staticmethod
    def signup(db: Session, data):
        return AuthService.create_user(
            db=db,
            username=data.username,
            mobile=data.mobile,
            password=data.password,
            email=data.email
        )

    # @staticmethod
    # def generateOTP(db: Session, data):
    #     return AuthService.login_user(
    #         db=db,
    #         mobile=data.mobile,
    #         password=data.password
    #     )
    
    # @staticmethod
    # def validateOTP(db: Session, data):
    #     return AuthService.login_user(
    #         db=db,
    #         mobile=data.mobile,
    #         password=data.password
    #     )
    # ---------------------- LOGIN ----------------------
    @staticmethod
    def login(db: Session, data):
        return AuthService.login_user(
            db=db,
            mobile=data.mobile,
            password=data.password
        )

    # ---------------------- LOGOUT ----------------------
    @staticmethod
    def logout(db: Session,request: Request):
        session_token = request.headers.get("PK-sessionToken")

        if not session_token:
            return error_response(401, "Session token missing")
         #Call the service method
        return AuthService.logout(db, session_token)
    
    # ---------------------- UPDATE PASSWORD ----------------------
    @staticmethod
    def update_password(db: Session, data):
        return AuthService.update_password(
           db=db,
           mobile_number=data.mobile_number,
           new_password=data.new_password,
           confirm_password=data.confirm_password
        )
    # ---------------------- GET USER DETAILS ----------------------

    @staticmethod
    def getUserDetails(db: Session, request: Request):
        userId = request.state.userId
        return AuthService.get_user(db, userId)

    # ---------------------- GENERATE OTP ----------------------

    @staticmethod
    def generateOTP(db, data):
        return AuthService.generate_otp(
            db=db,
            mobile=data.mobile,
            # email=data.email
        )
    # ---------------------- VALIDATE OTP ----------------------

    @staticmethod
    def validateOTP(db, data):
        return AuthService.validate_otp(
            db=db,
            mobile=data.mobile,
            # email=data.email,
            otp=data.otp
        )
    
    # ---------------------- USER LIST ----------------------
    @staticmethod
    def list_users(db, payload):
        return AuthService.list_users(db, payload)
    
    # ---------------------- LOGIN WITH EMAIL ----------------------

    @staticmethod
    def login_with_email(db: Session, email: str):
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        result = AuthService.login_or_create_user_with_email(db, email)
        return result
    
    # ---------------------- UPDATE USER DETAILS ----------------------

    @staticmethod
    def updateUserDetails(db: Session, request: Request, payload: dict):
        userId = request.state.userId
        return AuthService.update_user(db, userId, payload)