from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List, Any, Literal
from enum import Enum

class CollectionResponse(BaseModel):
    id: str #encrypted collection_id
    name: str
    collection_type: str

class EnvironmentCreate(BaseModel):
    env_name: str
    variables: Dict[str, str]
    

class CollectionUpdate(BaseModel):
    name: str  

class EnvironmentUpdate(BaseModel):
    variables: Dict[str, str]
    class Config:
        json_schema_extra = {
            "example": {
                "variables": {
                    # "base_url": "https://api.example.com",
                    # "auth_token": "",
                    # "timestamp": "2026-01-13T12:30:00"
                }
            }
        }
    
class ApiUpdateRequest(BaseModel):
    headers: Optional[Dict]
    query_params: Optional[Dict]
    request_body: Optional[Dict]


class generationTestCateReq(BaseModel):
    apiId: int
    comment: str

class saveTestCateReq(BaseModel):
    apiId: int
    testCase: List[Dict]


# Save API Request  
class QueryParam(BaseModel):
    key: str
    value: Any

class Script(BaseModel):
    exec: Optional[List[str]] = []

class preRequestEvent(BaseModel):
    listen: Literal["prerequest"]
    script: Script

class postRequestEvent(BaseModel):
    listen: Literal["test"]
    script: Script
class saveAPIReq(BaseModel):
    apiId: int

    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None    
    
    query_params: Optional[List[QueryParam]] = None
    headers: Optional[Dict[str, Any]] = None
    request_body: Optional[Dict[str, Any]] = None

    pre_request_script: Optional[preRequestEvent] = None
    post_request_script: Optional[postRequestEvent] = None




class reportListReq(BaseModel):
    search: Optional[str] = ""
    # filter: Optional[Dict[str, Any]] = {}
    # startDate: Optional[str] = None
    # endDate: Optional[str] = None
    sort: Optional[str] = "createdAt"
    order: Optional[str] = "DESC"
    limit: Optional[int] = 5
    offset: Optional[int] = 0
    
class CollectionNameUpdate(BaseModel):
    name: str
    
class CollectionListRequest(BaseModel):
    search: Optional[str] = ""
    filter: str | None = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    sort: Optional[str] = "createdAt"
    order: Optional[str] = "DESC"
    limit: Optional[int] = 10
    offset: Optional[int] = 0

class ReorderByArrayRequest(BaseModel):
    collection_id:str
    api_ids: List[int]   # array of API IDs in desired order





class JobType(str, Enum):
    cron = "cron"
    interval = "interval"

class SchedulerCreateReq(BaseModel):
    # ─────────────── BASIC INFO ───────────────
    job_name: str
    job_type: JobType

    # ─────────────── CRON FIELDS (DEFAULT = "*") ───────────────
    cron_year: Optional[str] = Field(default="*", example="2025")
    cron_month: Optional[str] = Field(default="*", example="1-12")
    cron_day: Optional[str] = Field(default="*", example="1-31")
    cron_week: Optional[str] = Field(default="*", example="1-53")
    cron_day_of_week: Optional[str] = Field(default="*", example="mon,tue,wed,thu,fri,sat,sun")
    cron_hour: Optional[str] = Field(default="*", example="0-23")
    cron_minute: Optional[str] = Field(default="*", example="0-59")
    cron_second: Optional[str] = Field(default="*", example="0-59")

    # ─────────────── INTERVAL FIELDS ───────────────
    interval_seconds: Optional[int] = Field(default=0, ge=0)
    interval_minutes: Optional[int] = Field(default=0, ge=0)
    interval_hours: Optional[int] = Field(default=0, ge=0)

    # ─────────────── COMMON FIELDS ───────────────
    collection_id: int
    # payload: Optional[Dict] = {}
    timezone: Optional[str] = "Asia/Kolkata"

    # ─────────────── VALIDATIONS ───────────────
    @validator("cron_year", "cron_month", "cron_day", "cron_week",
               "cron_day_of_week", "cron_hour", "cron_minute", "cron_second",
               pre=True, always=True)
    def default_cron_star(cls, v):
        return v if v not in (None, "", "null") else "*"

    @validator("job_type")
    def validate_job_type(cls, v):
        if v not in ["cron", "interval"]:
            raise ValueError("job_type must be cron or interval")
        return v

    @validator("interval_seconds", "interval_minutes", "interval_hours", always=True)
    def validate_interval_fields(cls, v, values):
        if values.get("job_type") == "interval":
            return v or 0
        return v

    @validator("cron_hour", always=True)
    def validate_cron_required(cls, v, values):
        if values.get("job_type") == "cron" and not v:
            raise ValueError("cron_hour is required for cron job")
        return v


class SchedulerListReq(BaseModel):
    search: Optional[str] = ""
    # filter: Optional[Dict[str, Any]] = {}
    # startDate: Optional[str] = None
    # endDate: Optional[str] = None
    collection_id: Optional[str] = 0    
    sort: Optional[str] = "createdAt"
    order: Optional[str] = "DESC"
    limit: Optional[int] = 5
    offset: Optional[int] = 0


class projetcCreateReq(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    # imageId: Optional[str] = None
    # imagePath: Optional[str] = None
    createdBy: Optional[int] = None
    updatedBy: Optional[int] = None






class RuleItem(BaseModel):
    rule: str
    mandatory: bool

class documentCreateReq(BaseModel):
    id: Optional[int] = None
    project_id: int
    name: str
    rules: Optional[List[RuleItem]] = None
    createdBy: Optional[int] = None
    updatedBy: Optional[int] = None

class documentListReq(BaseModel):
    search: Optional[str] = ""
    project_id: Optional[int] = None
    sort: Optional[str] = "createdAt"
    order: Optional[str] = "DESC"
    limit: Optional[int] = 10
    offset: Optional[int] = 0    