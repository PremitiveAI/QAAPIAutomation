from app.scheduler.scheduler import scheduler
from app.scheduler.tasks import execute_job
from app.scheduler.job_manager import build_cron_data, build_interval_data


def load_jobs_from_db(jobs):
    for job in jobs:
        payload = {"collection_id": job.collection_id} #job.payload
        if job.job_type == "cron":
            scheduler.add_job(
                execute_job,
                trigger="cron",
                **{k: v for k, v in build_cron_data(job).items() if v},
                kwargs={"payload": payload},
                id=job.job_id,
                replace_existing=True
            )

        elif job.job_type == "interval":
            scheduler.add_job(
                execute_job,
                trigger="interval",
                **{k: v for k, v in build_interval_data(job).items() if v},
                kwargs={"payload": payload},
                id=job.job_id,
                replace_existing=True
            )
