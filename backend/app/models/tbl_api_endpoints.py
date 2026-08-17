from app.utils.crypto import encrypt_data
from sqlalchemy import Column, Integer, String, Text, SmallInteger, Boolean, ForeignKey, DateTime
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base
from app.services.auth_service import IST

class ApiEndpoint(Base):
    __tablename__ = "tbl_api_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("tbl_collections.id", ondelete="CASCADE"))
    api_order = Column(Integer, nullable=False)   # NEW


    name = Column(String(255))
    url = Column(Text)
    method = Column(String(10))

    headers = Column(JSONB)
    query_params = Column(JSONB)
    request_body = Column(JSONB)
    response_body = Column(JSONB)

    pre_request_script = Column(JSONB)
    post_request_script = Column(JSONB)
    
    body_type = Column(String(50), nullable=True) # "form-data", "urlencoded", "query", "json", etc.
    
    test_scenario = Column(JSONB)
    test_case_file = Column(Text)

    has_env_vars = Column(Boolean, default=False)
    status = Column(SmallInteger, default=1)

    createdBy = Column(Integer, nullable=True)
    createdAt = Column(DateTime,default=datetime.utcnow)
    updatedBy = Column(Integer,nullable=True)
    updatedAt = Column(DateTime,default=datetime.utcnow, onupdate=datetime.utcnow)
    deletedBy = Column(Integer, nullable=True)
    deletedAt = Column(DateTime, nullable=True)
    
    
    # # 🎯 Custom __repr__ Method Implementation 🎯
    def __repr__(self):
        """
        Returns a concise, unambiguous, and useful string representation
        of the Users object for debugging and logging.
        """
        # We use an f-string to include key attributes
        return (
                f"<Users(id={self.id}, "
                f"collection_id='{self.collection_id}', "
                f"name='{self.name}', "
                f"url='{self.url}', "
                f"method='{self.method}', "                
                f"headers='{self.headers}', "
                f"query_params='{self.query_params}', "
                f"request_body='{self.request_body}', "
                f"response_body='{self.response_body}', "
                f"test_scenario='{self.test_scenario}', "
                f"has_env_vars='{self.has_env_vars}', "
                f"status={self.status})>"
                )

    # FORMATTED PROPERTIES
    @property
    def createdAtFormatted(self):
        return self.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.createdAt else None

    @property
    def updatedAtFormatted(self):
        return self.updatedAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.updatedAt else None
    
    @property 
    def encrypted_id(self) -> str: return encrypt_data(str(self.id))

