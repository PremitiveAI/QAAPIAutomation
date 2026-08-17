from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

from app.database.connection import engine
from app.utils.logger import get_logger

logger = get_logger(__name__)

# JobStore using SAME PostgreSQL DB
jobstores = {
    "default": SQLAlchemyJobStore(engine=engine)
}

executors = {
    "default": ThreadPoolExecutor(max_workers=10)
}

job_defaults = {
    "coalesce": True,
    "max_instances": 1,
    "misfire_grace_time": 30
}

scheduler = BackgroundScheduler(
    jobstores=jobstores,
    executors=executors,
    job_defaults=job_defaults,
    timezone="Asia/Kolkata"
)

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        logger.info("✅ Scheduler started")
