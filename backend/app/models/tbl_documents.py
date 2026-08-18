from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timedelta, timezone
from app.database.connection import Base
from app.config.env import env


IST = timezone(timedelta(hours=5, minutes=30))
class Documents(Base):
    __tablename__ = "tbl_documents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer,  nullable=True,) #ForeignKey("tbl_projects.id"),
    name = Column(String(255), nullable=True)
    rules = Column(JSONB)
    file_path = Column(String(255), nullable=True)
    result = Column(JSONB)
    status = Column(Integer, default=1)

    createdBy = Column(Integer ,nullable=True) #, ForeignKey("tbl_admin.id")
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedBy = Column(Integer ,nullable=True) #, ForeignKey("tbl_admin.id")
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deletedBy = Column(Integer, nullable=True)
    deletedAt = Column(DateTime, nullable=True)


    # created_by_user = relationship("AdminUsers",foreign_keys=[createdBy],lazy="selectin")
    # updated_by_user = relationship("AdminUsers",foreign_keys=[updatedBy],lazy="selectin")

    # 🔗 relationship
    # project = relationship(
    #     "MasterCategories",
    #     back_populates="subcategories",
    #     lazy="selectin"
    # )


    # FORMATTED PROPERTIES (READ-ONLY)
    @property
    def createdAtFormatted(self):
        return (
            self.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S")
            if self.createdAt else None
        )
 
    @property
    def updatedAtFormatted(self):
        return (
            self.updatedAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S")
            if self.updatedAt else None
        )
    
    # Property to always return full URL
    @property 
    def file_path_url(self): 
        base_url = env("BASE_URL") 
        
        if self.file_path: 
            return base_url + self.file_path.lstrip("/") # avoid double slashes 
        return None
 