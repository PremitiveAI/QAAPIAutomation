# app/services/auth_service.py
import base64, hmac, hashlib, json, time, re, random, uuid, traceback
from sqlalchemy.orm import Session,selectinload
# from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import func, or_
from datetime import datetime, timedelta, timezone
# from app.models.users_otp_model import UserOTPTable
# from app.models.users_model import Users
# from app.models.users_session_model import Sessions

# from app.repositories.auth_repository import AuthRepository
from app.utils.response import success_response, error_response
from app.utils.crypto import encrypt_data, decrypt_data
# from app.config.env import env


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
class AuthService:
# ---------------------- Password helpers ----------------------
    @staticmethod
    def hash_password(password: str):
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(password: str, hashed_password: str):
        return pwd_context.verify(password, hashed_password)
   
# ---------------------- Field Validations ----------------------
    @staticmethod
    def validate_username(username: str):
        # username key is missing
        if username is None:
            return error_response("Username field is required", 4023)
       
        if not username or not username.strip():
            return error_response("Username cannot be blank", 4001)

        username = username.strip()

        if len(username) < 3:
            return error_response("Username must be at least 3 characters", 4002)

        if not re.fullmatch(r"^[A-Za-z0-9_]+( [A-Za-z0-9_]+)*$", username):
            return error_response("Username can contain only letters, numbers, and underscore", 4003)

    @staticmethod
    def validate_mobile(mobilenumber: str):
        # mobile key is missing
        if mobilenumber is None:
            return error_response("Mobile field is required", 4020)

        if not mobilenumber or not mobilenumber.strip():
            return error_response("Mobile number cannot be blank", 4004)

        mobilenumber = mobilenumber.strip()

        if not mobilenumber.isdigit():
            return error_response("Mobile number must contain only digits", 4005)

        if not re.fullmatch(r"^[6-9][0-9]{9}$", mobilenumber):
            return error_response("Mobile number must be exactly 10 digits and start with 6,7,8,9",4006)

    @staticmethod
    def validate_password(password: str):
        # password key is missing
        if password is None:
            return error_response("Password field is required", 4021)

        if not password or not password.strip():
            return error_response("Password cannot be blank", 4007)
        password = password.strip()

        if len(password) < 6:
            return error_response("Password must be at least 6 characters long", 4008)

        if not re.search(r"[A-Z]", password):
            return error_response("Password must contain at least one uppercase letter", 4009)

        if not re.search(r"[a-z]", password):
            return error_response("Password must contain at least one lowercase letter", 4010)

        if not re.search(r"[0-9]", password):
            return error_response("Password must contain at least one digit", 4011)

        if not re.search(r"[!@#$%^&*_\-+]", password):
            return error_response("Password must contain at least one special character",4012)

    @staticmethod
    def validate_email(email: str):
        #email key is missing
        if email is None:
            return error_response("Email field is required", 4024)
        
        if not email or not email.strip():
            return error_response("Email cannot be blank", 4013)
        email = email.strip()

        if "@" not in email or "." not in email:
            return error_response("Invalid email format", 4014)
        
    @staticmethod
    def validate_company_name(name: str):
        if name is None:
            return error_response("companyName field is required", 4001)

        name = name.strip()
        if not name:
            return error_response("companyName cannot be blank", 4002)

        if len(name) < 2:
            return error_response("companyName must be at least 2 characters", 4003)

    @staticmethod
    def validate_country(country: str):
        if country is None:
            return error_response("country field is required", 4004)

        country = country.strip()
        if not country:
            return error_response("country cannot be blank", 4005)

    @staticmethod
    def validate_state(state: str):
        if state is None:
            return error_response("state field is required", 4006)

        state = state.strip()
        if not state:
            return error_response("state cannot be blank", 4007)

    @staticmethod
    def validate_city(city: str):
        if city is None:
            return error_response("city field is required", 4008)

        city = city.strip()
        if not city:
            return error_response("city cannot be blank", 4009)

    @staticmethod
    def validate_pincode(pincode: str):
        if pincode is None:
            return error_response("pincode field is required", 4010)

        pincode = pincode.strip()
        if not pincode:
            return error_response("pincode cannot be blank", 4011)

        if len(pincode) != 6 or not pincode.isdigit():
            return error_response("Invalid pincode", 4012)

# ---------------------- JWT Token ----------------------
    @staticmethod
    def generate_token(username: str, mobile: str):
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "username": username,
            "mobile": mobile,
            "exp": int(time.time()) + 3600
        }

        header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
        payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")

        signature = hmac.new(
            SECRET_KEY.encode(),
            f"{header_b64}.{payload_b64}".encode(),
            hashlib.sha256
        ).digest()

        signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")

        return f"{header_b64}.{payload_b64}.{signature_b64}"

    # ---------------------- Signup ----------------------
    @staticmethod
    def create_user(db: Session, username: str, mobile: str, password: str, email: str):

        result = AuthService.validate_username(username)
        if result:
            return result

        result = AuthService.validate_mobile(mobile)
        if result:
            return result

        result = AuthService.validate_password(password)
        if result:
            return result

        result = AuthService.validate_email(email)
        if result:
            return result
        
        existing = db.query(Users).filter(
            (Users.mobile == mobile) | (Users.email  == email )
        ).first()

        if existing:
            return error_response("Mobile or Email already exists")

        hashed = AuthService.hash_password(password)
        new_user = Users(username=username, mobile=mobile, password=hashed, email=email, status=1)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return success_response(
            "User created successfully",
            {
                "userId": new_user.id,
                "username": new_user.username,
                "mobile": new_user.mobile,
                "email": new_user.email,
                "status": new_user.status
            },
        )

    # ---------------------- get User data ----------------------
    @staticmethod
    def get_user(db: Session, userId: str):

        userData = db.query(Users).filter(Users.userId == userId, Users.status == 1).first()
        if not userData:
            return error_response("User not exists")

        return success_response(
            message=None,  # No message will be included
            data={
                "userId": userData.userId,
                "username": userData.username,
                "mobile": userData.mobile,
                "mobile": userData.mobile,
                "email": userData.email,
                "companyName": userData.companyName,
                "status": userData.status
            }
        )
    
    # ---------------------- Login ----------------------
    @staticmethod
    def login_user(db: Session, mobile: str, password: str):
        # AuthService.validate_mobile(mobile)
        # AuthService.validate_password(password)
        result = AuthService.validate_mobile(mobile)
        if result:
            return result

        result = AuthService.validate_password(password)
        if result:
            return result

        user = db.query(Users).filter(Users.mobile == mobile, Users.status == 1).first()

        if not user:
            return error_response("User not found OR inactive", code=404)

        if not AuthService.verify_password(password, user.password):
            return error_response("Incorrect password", code=505)

        # token = AuthService.generate_token(user.username, user.mobile)
        token = encrypt_data({
            'userId':user.userId,
            'mobile':user.mobile
            })

        session = Sessions(userId=user.userId, session_token=token)
        db.add(session)
        db.commit()

        return success_response(
            "Login successful",
            {
                "userId": user.userId,
                "username": user.username,
                "email": user.email,
                "session_token": token,
            }
        )
# ---------------------- Logout ----------------------
    @staticmethod
    def logout(db: Session, session_token: str):
        session = db.query(Sessions).filter(
            Sessions.session_token == session_token,
            Sessions.status == 1
        ).first()

        if not session:
            return error_response(4017, "Invalid or expired session token")
    
        session.status = -1
        session.updatedAt = datetime.utcnow()

        db.commit()
        return success_response("Logout successful",{})

# ---------------------- Update Password ----------------------
    @staticmethod
    def update_password(db: Session, mobile_number: str, new_password: str, confirm_password: str):

        #Check password match
        if new_password != confirm_password:
            return error_response("Passwords do not match", 4020)
        
         #Validate mobile
        error = AuthService.validate_mobile(mobile_number)
        if error:
            return error
        
        #Validate password format
        error = AuthService.validate_password(new_password)
        if error:
            return error

        #Check user exists
        user = (
            db.query(Users)
            .filter(
                (Users.mobile == str(mobile_number)) |
                (getattr(Users, "mobilenumber", None) == str(mobile_number))
            )
            .filter(Users.status == 1)
            .first()
        )
        if not user:
            return error_response("User not found with this mobile number", 4021)

        #Hash & Update password
        hashed_password = AuthService.hash_password(new_password)
        user.password = hashed_password
        db.commit()
        db.refresh(user)
        return success_response("Password updated successfully",None)

# ---------------------- Generate otp ----------------------

    @staticmethod
    def generate_otp(db: Session, mobile: str = None):

        if not mobile:
            return error_response("Mobile is required",400)

        # Safe Validations
        if mobile:
            error = AuthService.validate_mobile(mobile)
            if error:
                return error

        # ----------------------------
        #  ✅ Check if mobile exists in DB (Users table)
        # ----------------------------
        from app.models.users_model import Users
        user_exists = db.query(Users).filter(
            Users.mobile == mobile,
            Users.status == 1
        ).first()

        if not user_exists:
            return error_response("Mobile number not found", 404)

        otp = random.randint(100000, 999999)

        query = db.query(UserOTPTable).filter(UserOTPTable.status == 1)

        if mobile:
            query = query.filter(UserOTPTable.mobile == mobile)

        existing_otp = query.first()

        if existing_otp:
            existing_otp.otp = otp
            existing_otp.failOtpAttempt = 0
            existing_otp.updatedAt = datetime.utcnow()
        else:
            new_otp = UserOTPTable(
                mobile=mobile,
                otp=otp,
                otpType="LOGIN",
                status=1
            )
            db.add(new_otp)

        db.commit()

        return success_response(
            "OTP generated successfully",
            {
                "mobile": mobile,
            }
        )

# ---------------------- Validate OTP (Mobile OR Email) ----------------------
    @staticmethod
    def validate_otp(db: Session, mobile: str = None, email: str = None, otp: int = None):

        if not mobile and not email:
            return error_response("Mobile is required",400)

        if not otp:
            return error_response("OTP is required",401)

        query = db.query(UserOTPTable).filter(UserOTPTable.status == 1)

        if mobile:
            query = query.filter(UserOTPTable.mobile == mobile)

        # if email:
        #     query = query.filter(UserOTPTable.email == email)

        record = query.first()

        if not record:
            return error_response("OTP not found",402)

        #OTP Attempt Limit
        if record.failOtpAttempt >= 3:
            return error_response("OTP attempts exceeded. Please generate new OTP",403)

        #OTP Match Check
        if record.otp != otp:
            record.failOtpAttempt += 1
            db.commit()
            return error_response("Invalid OTP",404)

        #OTP Verified Successfully → Deactivate OTP
        record.status = 0
        db.commit()

        return success_response(
            "OTP validated successfully",
            {
                "mobile": mobile,
                # "email": email
            }
        )
# ---------------------- USER LIST----------------------
    @staticmethod
    def list_users(db: Session, payload: dict):
        
        p = read_payload(payload)  # <── Clean!

        # query = db.query(Users)
        # 🔹 BASE QUERY (exclude status = -1)
        query = db.query(Users).filter(Users.status != -1)

        # SEARCH
        if p["search"]:
            q = p["search"]
            query = query.filter(
                or_(
                    Users.username.ilike(f"%{q}%"),
                    Users.mobile.ilike(f"%{q}%"),
                    Users.email.ilike(f"%{q}%")
                )
            )

        # DATE FILTERS
        today = datetime.now().date()

        if p["filter"] == "today":
            query = query.filter(func.date(Users.createdAt) == today)

        elif p["filter"] == "thisWeek":
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
            query = query.filter(func.date(Users.createdAt).between(start, end))

        elif p["filter"] == "thisMonth":
            start = today.replace(day=1)
            next_month = start.replace(month=start.month % 12 + 1, day=1) if start.month < 12 else start.replace(year=start.year + 1, month=1, day=1)
            end = next_month - timedelta(days=1)
            query = query.filter(func.date(Users.createdAt).between(start, end))

        elif p["filter"] == "thisYear":
            start = today.replace(month=1, day=1)
            end = today.replace(month=12, day=31)
            query = query.filter(func.date(Users.createdAt).between(start, end))

        elif p["filter"] == "custom" and p["startDate"] and p["endDate"]:
            start = datetime.strptime(p["startDate"], "%d-%b-%Y").date()
            end = datetime.strptime(p["endDate"], "%d-%b-%Y").date()
            query = query.filter(func.date(Users.createdAt).between(start, end))

        # TOTAL RECORDS
        totalRecords = query.count()

        #  SORT
        sort_column = getattr(Users, p["sort"], Users.createdAt)
        sort_order = sort_column.asc() if p["order"].upper() == "ASC" else sort_column.desc()
        query = query.order_by(sort_order)

        #  PAGINATION
        users = query.offset(p["offset"]).limit(p["limit"]).all()
        return success_response(
            "User list fetched successfully",
            {
                "totalRecords": totalRecords,
                "users": [
                    {
                    "userId": u.userId,
                    "username": u.username,
                    "mobile": u.mobile,
                    "email": u.email,
                    "companyName":u.companyName,
                    "country":u.country,
                    "state":u.state,
                    "city":u.city,
                    "pincode":u.pincode,
                    "address":u.address,
                    "gst":u.gst,
                    "pan":u.pan,
                    "createdAt": (u.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if u.createdAt else None)
                    }
                    for u in users
                ]
            }
        )
    
# ---------------------- lOGIN WITH EMAIL---------------------
    @staticmethod
    def login_or_create_user_with_email(db: Session, email: str):

    # Check user exists
        user = db.query(Users).filter(Users.email == email).first()

        if not user:
            # Create minimal user
            user = Users(
                userId=f"U-{uuid.uuid4().hex[:12].upper()}",
                fullname=None,
                username=None,
                password=None,
                mobile=None,
                dialingCode=None,
                email=email,
                status=1
            )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Deactivate old sessions
        db.query(Sessions).filter(
            Sessions.userId == user.userId,
            Sessions.status == 1
        ).update({Sessions.status: -1})

        db.commit()

         # Create encrypted session token
        session_token = encrypt_data({
            "userId": user.userId,
            "mobile": user.mobile
        })

        new_session = Sessions(
            userId=user.userId,
            session_token=session_token,
            deviceId=None,
            sessionType="WEB",
            status=1
        )

        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        # Response
        return success_response(
            "Login successful",
            {
                "userId": user.userId,
                "email": user.email,
                "session_token": session_token
            }
        )
   # ---------------------- Update User---------------------

    @staticmethod
    def update_user(db: Session, userId: int, payload: dict):

    # Check user exists
        user = db.query(Users).filter(Users.userId == userId, Users.status == 1).first()
        if not user:
            return error_response("User not exists")

        # Required fields validation
        required_fields = ["companyName", "country", "state", "city","mobile","pincode"]

        for field in required_fields:
            if field not in payload or payload[field] is None or str(payload[field]).strip() == "":
                return error_response(f"{field} is required")

        # Run your existing validators
        result = AuthService.validate_username(payload.get("username"))
        if result:
            return result

        result = AuthService.validate_mobile(payload.get("mobile"))
        if result:
            return result

        if "email" in payload and payload.get("email"):  
            result = AuthService.validate_email(payload.get("email"))
            if result:
                return result
            
        result = AuthService.validate_pincode(payload.get("pincode"))
        if result:
            return result
        
        # ADD THIS (Duplicate Mobile Check)
        if "mobile" in payload and payload["mobile"]:
            duplicate_mobile = db.query(Users).filter(
                Users.mobile == payload["mobile"],
                Users.userId != userId,     # ignore current user
                Users.status == 1
            ).first()

        if duplicate_mobile:
            return error_response("Mobile number already exists", 400)

        # Allowed fields which can be updated
        allowed_fields = [
            "companyName", "username", "mobile", "email",
            "country", "state", "city", "address", "pincode",
            "gst", "pan"
        ]

        # Update user data
        for field in allowed_fields:
            if field in payload and payload[field] is not None:
                setattr(user, field, payload[field])

        db.commit()
        db.refresh(user)

        # Return response
        return success_response(
            message="User updated successfully",
            data={
                "userId": user.userId,
                "username": user.username,
                "mobile": user.mobile,
                "email": user.email,
                "companyName": user.companyName,
                "country": user.country,
                "state": user.state,
                "city": user.city,
                "address": user.address,
                "pincode": user.pincode,
                "gst": user.gst,
                "pan": user.pan,
                "status": user.status
            }
        )
    #================= Master Api Feature and Category=========================

    # ================= COMMON VALIDATION =================
    @staticmethod
    def _validate_name(name):
        return bool(name and str(name).strip())
    
    @staticmethod
    def _null_if_empty(value):
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == "":
            return None
        return value
    # ================= COMMON RESPONSE BUILDER ==============
    @staticmethod
    def _master_response(db,obj):
        # FORCE LOAD RELATIONSHIPS
        db.refresh(
            obj,
            attribute_names=["created_by_user", "updated_by_user"]
        )
        return {
            "id": obj.id,
            "name": obj.name,
            "description": obj.description,
            "imageId": obj.imageId,
            "imagePath": obj.imagePath,
            "createdAt": obj.createdAtFormatted,
            "updatedAt": obj.updatedAtFormatted,
            "createdBy": (obj.created_by_user.admin_name if obj.created_by_user else None),
            "updatedBy": (obj.updated_by_user.admin_name if obj.updated_by_user else None),
            "status": obj.status
        }

    # ================= CREATE =================
    @staticmethod
    def create_master(db, model, payload: dict, adminId: int):
        if not AuthService._validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj = model(
            name=payload["name"].strip(),
            description=AuthService._null_if_empty(payload.get("description")),
            # imageId=AuthService._null_if_empty(payload.get("imageId")),
            # imagePath=AuthService._null_if_empty(payload.get("imagePath")),
            createdBy=adminId,
            updatedBy=adminId
        )

        db.add(obj)
        db.commit()
        # RE-QUERY WITH RELATIONSHIPS
        obj = (
            db.query(model)
            .options(
                selectinload(model.created_by_user),
                selectinload(model.updated_by_user)
            )
            .filter(model.id == obj.id)
            .first()
        )
        return success_response("Created successfully",AuthService._master_response(db,obj))

    # ================= UPDATE =================
    @staticmethod
    def update_master(db, model, payload: dict, updatedBy: int):
        obj = db.query(model).filter(model.id == payload.get("id")).first()

        if not obj:
            return error_response("Record not found", 4040)

        if not AuthService._validate_name(payload.get("name")):
            return error_response("Name is required", 4030)

        obj.name = payload["name"].strip()
        obj.description = AuthService._null_if_empty(payload.get("description"))
        obj.imageId = AuthService._null_if_empty(payload.get("imageId"))
        obj.imagePath = AuthService._null_if_empty(payload.get("imagePath"))
        obj.updatedBy = updatedBy

        db.commit()
        db.refresh(obj)   #THIS LINE IS REQUIRED

        return success_response("Updated successfully",AuthService._master_response(db,obj))

    # ================= GET BY ID =================
    @staticmethod
    def get_master_by_id(db, model, id: int):
        obj = db.query(model).filter(
            model.id == id,
            model.status == 1
        ).first()

        if not obj:
            return error_response("Record not found", 4040)

        return success_response("Details fetched successfully",AuthService._master_response(db,obj))

    # ================= DELETE =================
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

    # ================= LIST =================
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

        return success_response(
            "List fetched successfully",
            {
                "totalRecords": total,
                "list": [AuthService._master_response(db,r) for r in records]
            }
        )


