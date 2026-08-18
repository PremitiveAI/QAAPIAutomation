from pydantic import BaseModel
from typing import Optional

class userOTPGenerateReq(BaseModel):
    mobile: Optional[str] = None
    # email: Optional[str] = None

class userOTPValidateReq(BaseModel):
    mobile: Optional[str] = None
    # email: Optional[str] = None
    otp: int


class UserListReq(BaseModel):
    search: Optional[str] = ""
    filter: Optional[str] = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    sort: Optional[str] = "createdAt"
    order: Optional[str] = "DESC"
    limit: Optional[int] = 10
    offset: Optional[int] = 0

class userSignupReq(BaseModel):    
    username: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None
    email: Optional[str] = None

class userLoginReq(BaseModel):
    mobile: Optional[str] = None
    password: Optional[str] = None


class userEmailLoginReq(BaseModel):
    email: str  # simple string


class userUpdateReq(BaseModel):
    companyName: Optional[str]
    username: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    country: Optional[str]
    state: Optional[str]
    city: Optional[str]
    pincode: Optional[str]
    address: Optional[str]
    gst: Optional[str]
    pan: Optional[str]
    # password: Optional[str]


class userUpdatePasswordReq(BaseModel):
    mobile_number: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None 
    