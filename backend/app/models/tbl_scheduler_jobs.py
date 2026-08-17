import re
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean,
    ForeignKey, DateTime, JSON, CheckConstraint, event, text
)
from sqlalchemy.orm import relationship
from app.database.connection import Base
from app.services.auth_service import IST


class SchedulerJob(Base):
    __tablename__ = "tbl_scheduler_jobs"

    # ==========================
    # PRIMARY
    # ==========================
    id = Column(Integer, primary_key=True, index=True)

    # ==========================
    # IDENTIFICATION
    # ==========================
    job_id = Column(String(255), unique=True, nullable=False)
    job_name = Column(String(200), nullable=False)
    job_type = Column(String(20), nullable=False)

    # ==========================
    # CRON FIELDS
    # ==========================
    cron_year = Column(String(20))
    cron_month = Column(String(20))
    cron_day = Column(String(20))
    cron_week = Column(String(20))
    cron_day_of_week = Column(String(20))
    cron_hour = Column(String(20))
    cron_minute = Column(String(20))
    cron_second = Column(String(20))

    # ==========================
    # INTERVAL FIELDS
    # ==========================
    interval_seconds = Column(Integer)
    interval_minutes = Column(Integer)
    interval_hours = Column(Integer)

    # ==========================
    # META
    # ==========================
    collection_id = Column(Integer, ForeignKey("tbl_collections.id"), nullable=False)
    payload = Column(JSON)
    status = Column(Boolean, default=True)
    timezone = Column(String(50), default="Asia/Kolkata")

    # ==========================
    # AUDIT
    # ==========================
    createdBy = Column(Integer, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)

    updatedBy = Column(Integer, nullable=True)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deletedBy = Column(Integer, nullable=True)
    deletedAt = Column(DateTime, nullable=True)

    # ==========================
    # RELATIONSHIP
    # ==========================
    collection = relationship("Collection", lazy="selectin")

    # ==========================
    # CONSTRAINTS
    # ==========================
    __table_args__ = (
        CheckConstraint("job_type IN ('cron', 'interval', 'date')", name="check_job_type"),
    )

    # ==========================
    # AUTO JOB ID GENERATOR
    # ==========================
    @staticmethod
    def _slugify(text: str) -> str:
        return re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")

    @staticmethod
    def _get_next_id(connection):
        result = connection.execute(
            text("SELECT COALESCE(MAX(id), 0) + 1 FROM tbl_scheduler_jobs")
        )
        return result.scalar()

    @classmethod
    def generate_job_id(cls, mapper, connection, target):
        if target.job_id:
            return

        base_name = cls._slugify(target.job_name)
        next_id = cls._get_next_id(connection)
        target.job_id = f"{base_name}_{next_id}"


    @property
    def createdAtFormatted(self):
        return self.createdAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.createdAt else None

    @property
    def updatedAtFormatted(self):
        return self.updatedAt.astimezone(IST).strftime("%d-%b-%Y %H:%M:%S") if self.updatedAt else None


# ==========================
# SQLALCHEMY EVENT
# ==========================
event.listen(SchedulerJob, "before_insert", SchedulerJob.generate_job_id)

