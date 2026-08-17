from sqlalchemy import Column, Integer, String, Float, Text, SmallInteger, Boolean, ForeignKey, DateTime
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base
from app.services.auth_service import IST

class TestReports(Base):
    __tablename__ = "tbl_test_reports"

    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("tbl_collections.id", ondelete="CASCADE"))
    collection_name = Column(String)
    
    total_apis = Column(Integer, default=0)
    total_tests = Column(Integer, default=0)
    total_passed = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    total_errors = Column(Integer, default=0)
    total_execution_time = Column(Float, default=0)

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

