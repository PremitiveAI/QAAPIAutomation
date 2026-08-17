from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, ForeignKey, Float
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base
from app.services.auth_service import IST

class Environment(Base):
    __tablename__ = "tbl_environments"

    id = Column(Integer, primary_key=True)
    collection_id = Column(Integer, ForeignKey("tbl_collections.id"))
    key = Column(String(255))
    value = Column(String(1024), nullable=True)

    createdAt = Column(DateTime, default=datetime.utcnow)

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

