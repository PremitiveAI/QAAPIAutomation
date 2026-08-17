from typing import Any, Dict, List, Optional, Literal, Union
from pydantic import BaseModel, Field, root_validator

from typing import Annotated


from pydantic import BaseModel, model_validator
from typing import Any, List, Literal

class QueryParam(BaseModel):
    key: str
    value: Any

class QueryParamsModel(BaseModel):
    mode: Literal["query"]
    query: List[QueryParam]

    @model_validator(mode="after")
    def validate_query(self):
        if not self.query:
            raise ValueError("query_params.query cannot be empty")

        for item in self.query:
            if not item.key:
                raise ValueError("query param key cannot be empty")

        return self



class RawBody(BaseModel):
    mode: Literal["raw"]
    raw: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_raw(self):
        if not isinstance(self.raw, dict):
            raise ValueError("raw body must be a JSON object")

        if not self.raw:
            raise ValueError("raw body cannot be empty")

        return self



class UrlEncodedItem(BaseModel):
    key: str
    value: Any
    type: Literal["text"] = "text"

class UrlEncodedBody(BaseModel):
    mode: Literal["urlencoded"]
    urlencoded: Optional[List[UrlEncodedItem]] = None

    # @classmethod
    @model_validator(mode="after")
    def normalize_urlencoded(self):
        items = self.urlencoded

        if not items:
            raise ValueError("urlencoded body must contain at least one field")

        for item in items:
            if not item.key:
                raise ValueError("urlencoded field key cannot be empty")

        return self



class FormDataItem(BaseModel):
    key: str
    type: Literal["text", "file"]
    value: Optional[Any] = None
    src: Optional[List[str]] = []

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.type == "text":
            # Ensure value is present and src is empty/None
            if self.value is None:
                raise ValueError(f"Field '{self.key}' is type 'text' and requires a 'value'")
            if self.src:
                raise ValueError(f"Field '{self.key}' is type 'text' and should not contain 'src'")
        
        elif self.type == "file":
            # Ensure src is present and value is empty/None
            if not self.src:
                raise ValueError(f"Field '{self.key}' is type 'file' and requires 'src' (list of paths)")
            if self.value is not None:
                raise ValueError(f"Field '{self.key}' is type 'file' and should not contain 'value'")
                    
        return self
    
class FormDataBody(BaseModel):
    mode: Literal["formdata"]
    formdata: Optional[List[FormDataItem]] = None

    @model_validator(mode="after")
    def validate_formdata(self):
        # Mandatory if mode is 'formdata'
        if self.formdata is None:
            raise ValueError("field 'formdata' is mandatory when mode is 'formdata'")
        if not self.formdata:
            raise ValueError("formdata list cannot be empty")

        for item in self.formdata:
            if not item.key:
                raise ValueError("formdata field key cannot be empty")
            if item.type == "file" and not item.src:
                raise ValueError(f"file field '{item.key}' must contain src")
        return self



RequestBody = Annotated[
    Union[RawBody, UrlEncodedBody, FormDataBody],
    Field(discriminator="mode")
]



# pre and post request validate
class Script(BaseModel):
    exec: Optional[List[str]] = []

class PreRequestEvent(BaseModel):
    listen: Literal["prerequest"]
    script: Script

class PostRequestEvent(BaseModel):
    listen: Literal["test"]
    script: Script



class SaveAPIReq(BaseModel):
    apiId: int
    name: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None

    query_params: Optional[QueryParamsModel] = None
    headers: Optional[Dict[str, Any]] = None
    request_body: Optional[RequestBody] = None

    pre_request_script: Optional[PreRequestEvent] = None
    post_request_script: Optional[PostRequestEvent] = None
    test_scenario: Optional[List[Dict]] = None

    @model_validator(mode="after")
    def validate_method_body(self):
        if self.method in {"GET", "DELETE"} and self.request_body:
            raise ValueError(
                f"HTTP method '{self.method}' does not support request body"
            )
        return self

