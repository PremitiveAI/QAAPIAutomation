from sqlalchemy.orm import Session
from app.models.tbl_scheduler_jobs import SchedulerJob
from datetime import datetime, timedelta, timezone
from app.utils.crypto import encrypt_simple_id, decrypt_simple_id

def format_scheduler_job(job):
    return {
        "id": job.id,
        "job_id": job.job_id,
        "job_name": job.job_name,
        "job_type": job.job_type,

        "cron": {
            "year": job.cron_year,
            "month": job.cron_month,
            "day": job.cron_day,
            "week": job.cron_week,
            "day_of_week": job.cron_day_of_week,
            "hour": job.cron_hour,
            "minute": job.cron_minute,
            "second": job.cron_second,
        },

        "interval": {
            "seconds": job.interval_seconds,
            "minutes": job.interval_minutes,
            "hours": job.interval_hours,
        },

        "payload": job.payload,
        "collection_id": encrypt_simple_id(job.collection_id),
        "status": job.status,
        "timezone": job.timezone,
        "created_at": job.createdAtFormatted,
        # "updated_at": job.updatedAt
    }


def create_scheduler_job(db: Session, data):
    job = SchedulerJob(
        job_name=data.job_name,
        job_type=data.job_type.value,

        cron_year=data.cron_year,
        cron_month=data.cron_month,
        cron_day=data.cron_day,
        cron_week=data.cron_week,
        cron_day_of_week=data.cron_day_of_week,
        cron_hour=data.cron_hour,
        cron_minute=data.cron_minute,
        cron_second=data.cron_second,

        interval_seconds=data.interval_seconds,
        interval_minutes=data.interval_minutes,
        interval_hours=data.interval_hours,

        collection_id=data.collection_id,
        timezone=data.timezone,
        status=True
    )

    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_active_jobs(db: Session):
    return db.query(SchedulerJob).filter(
        SchedulerJob.status == True,
        SchedulerJob.deletedAt.is_(None)
    ).all()


def get_all_scheduler_jobs(db: Session, payload):    
    query = db.query(SchedulerJob)
    query = query.filter(SchedulerJob.status == True, SchedulerJob.deletedAt.is_(None))

    # Search
    if payload.search:
        query = query.filter(SchedulerJob.name.ilike(f"%{payload.search}%"))

    # if payload.collection_id:
    #     # query = query.filter(SchedulerJob.collection_id == payload.collection_id)
    #     try:
    #         decoded_id = decrypt_simple_id(payload.collection_id)
    #         query = query.filter(SchedulerJob.collection_id == decoded_id)
    #     except Exception:
    #         return {"total": 0, "records": []}
    if payload.collection_id:
        try:
            decoded_id = decrypt_simple_id(payload.collection_id) # 🔥 decode here
            query = query.filter(SchedulerJob.collection_id == decoded_id)
        except Exception:
            # invalid encrypted id
             return {"total": 0, "records": []}
        
        

    # Date filter (SAFE)
    # if payload.startDate:
    #     try:
    #         if payload.startDate.lower() != "string":
    #             start = datetime.fromisoformat(payload.startDate)
    #             query = query.filter(SchedulerJob.createdAt >= start)
    #     except ValueError:
    #         pass  # ignore invalid date safely

    # if payload.endDate:
    #     try:
    #         if payload.endDate.lower() != "string":
    #             end = datetime.fromisoformat(payload.endDate)
    #             query = query.filter(SchedulerJob.createdAt <= end)
    #     except ValueError:
    #         pass

    # Sorting
    sort_column = getattr(SchedulerJob, payload.sort, SchedulerJob.createdAt)

    if payload.order.upper() == "DESC":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Pagination
    total = query.count()
    records = query.offset(payload.offset).limit(payload.limit).all()

    return { 
        "total": total,  
        "records": [format_scheduler_job(r) for r in records]
        # "records": records 
    }


def delete_scheduler_job(db: Session, id: int):
    job = db.query(SchedulerJob).filter(SchedulerJob.id == id, SchedulerJob.deletedAt.is_(None)).first()

    if not job:
        return None

    # Soft delete
    job.status = False
    job.deletedAt = datetime.utcnow()

    db.commit()
    return job

