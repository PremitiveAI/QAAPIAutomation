from typing import Optional
from fastapi import Header
from app.config.env import env


class SwaggerAPIHeaders:
    def __init__(
        self,
        api_token: str = Header(
            default= env('API_TOKEN'), #None,
            alias="PK-apiToken",
            description="Application API token"
        ),
        deviceid: Optional[str] = Header(
            default=None,
            alias="PK-deviceid",
            description="User device ID"
        ),
        role: Optional[str] = Header(
            default="User",
            alias="PK-role",
            description="User role"
        ),
        country: Optional[str] = Header(
            default="IN",
            alias="PK-country",
            description="Country (default IN)"
        ),
        timezone: Optional[str] = Header(
            default="Asia/Kolkata",
            alias="PK-timezone",
            description="User timezone"
        ),
    ):
        self.api_token = api_token
        self.deviceid = deviceid
        self.role = role
        self.country = country
        self.timezone = timezone


class SwaggerSessionHeaders:
    def __init__(
        self,
        api_token: str = Header(
            default= env('API_TOKEN'), #None,
            alias="PK-apiToken",
            description="Application API token (required)"
        ),
        session_token: str = Header(
            default=None,
            alias="PK-sessionToken",
            description="User session token (required)"
        ),
        deviceid: Optional[str] = Header(
            default=None,
            alias="PK-deviceid",
            description="User device ID"
        ),
        role: Optional[str] = Header(
            default="User",
            alias="PK-role",
            description="User role"
        ),
        country: Optional[str] = Header(
            default="IN",
            alias="PK-country",
            description="Country (default IN)"
        ),
        timezone: Optional[str] = Header(
            default="Asia/Kolkata",
            alias="PK-timezone",
            description="User timezone"
        ),
    ):
        self.api_token = api_token
        self.session_token = session_token
        self.deviceid = deviceid
        self.role = role
        self.country = country
        self.timezone = timezone
