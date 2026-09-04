from app.scheduler.scheduler import scheduler
from app.scheduler.tasks import execute_job

def build_cron_data(job):
    return {
        "year": job.cron_year,
        "month": job.cron_month,
        "day": job.cron_day,
        "week": job.cron_week,
        "day_of_week": job.cron_day_of_week,
        "hour": job.cron_hour,
        "minute": job.cron_minute,
        "second": job.cron_second,
        "timezone": job.timezone
    }


def build_interval_data(job):
    return {
        "seconds": job.interval_seconds,
        "minutes": job.interval_minutes,
        "hours": job.interval_hours
    }




def add_interval_job(job_id, seconds, payload):
    scheduler.add_job(
        execute_job,
        trigger="interval",
        seconds=seconds,
        kwargs={"payload": payload},
        id=job_id,
        replace_existing=True
    )


def add_cron_job(job_id, cron_data, payload):
    scheduler.add_job(
        execute_job,
        trigger="cron",
        **cron_data,
        kwargs={"payload": payload},
        id=job_id,
        replace_existing=True
    )


def remove_job_from_scheduler(job_id: str):
    try:
        scheduler.remove_job(job_id)
        return True
    except Exception:
        return False
    

def list_jobs():
    joblist = scheduler.get_jobs()
    print("joblist =======================> ", joblist)
    return joblist