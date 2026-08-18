import uuid
from sqlalchemy import Column, Integer, String, Text, SmallInteger, DateTime
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.sql import func
from app.database.connection import Base
from app.services.auth_service import IST
from app.utils.crypto import encrypt_simple_id

class Collection(Base):
    __tablename__ = "tbl_collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    collection_type = Column(String(50),nullable=False)  # postman / swagger
    collection_path = Column(String(512))
    env_path = Column(String(512),nullable=True)
    env_vars = Column(MutableDict.as_mutable(JSON),nullable=True)
    status = Column(SmallInteger, default=1)

    createdBy = Column(Integer, nullable=True)
    createdAt = Column(DateTime,default=datetime.utcnow)
    updatedBy = Column(Integer,nullable=True)
    updatedAt = Column(DateTime,default=datetime.utcnow, onupdate=datetime.utcnow)
    deletedBy = Column(Integer, nullable=True)
    deletedAt = Column(DateTime, nullable=True)
    
    
    # FORMATTED PROPERTIES
    @property
    def createdAtFormatted(self):
        return self.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.createdAt else None

    @property
    def updatedAtFormatted(self):
        return self.updatedAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.updatedAt else None

    @staticmethod 
    def generate_collection_uid(): 
        return f"C-{uuid.uuid4().hex[:8].upper()}"
    
    
# 🔒 Encrypted ID property @property 
    def encrypted_id(self) -> str: 
        """Return encrypted form of the collection ID."""
        return encrypt_simple_id(str(self.id))
