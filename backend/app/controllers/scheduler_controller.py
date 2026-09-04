# app/controllers/scheduler_controller.py

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.tbl_collections import Collection
from app.utils.response import success_response, error_response

from app.repositories.scheduler_repo import format_scheduler_job, create_scheduler_job, get_all_scheduler_jobs, delete_scheduler_job
from app.scheduler.job_manager import remove_job_from_scheduler, list_jobs
from app.scheduler.loader import load_jobs_from_db

def scheduler_create(db: Session, payload, request: Request):
    collection_id = payload.collection_id

    collection = db.query(Collection).filter_by(id=collection_id, status=1).first()
    if not collection: 
        return error_response(f"Collection ID {collection_id} not found", code=4000)
    
    # return payload
    job = create_scheduler_job(db, payload)
    load_jobs_from_db([job])

    deatils = format_scheduler_job(job)

    return success_response(message="scheduler added successfully",
       data = {**deatils}
    )

def scheduler_list(db: Session, payload, request: Request): 
    jobs = get_all_scheduler_jobs(db, payload)
    if not jobs:
        return error_response( message="No scheduler found", code=4000 )
    
    list_jobs()
    
    return success_response(message="scheduler list fetched successfully",
        data={
        "limit": payload.limit,
        "offset": payload.offset,
        "total": jobs.get('total'),
        "schedulers": jobs.get('records') 
    })

def scheduler_delete(db: Session, scheduler_id, request: Request):
    # Remove from DB
    job = delete_scheduler_job(db, scheduler_id)
    
    if not job:
        return error_response( message="No scheduler found", code=4000 )

    # Remove from scheduler
    remove_job_from_scheduler(job.job_id)

    return success_response(
        message = "Job deleted successfully",
        data = {"job_id": job.job_id}
    )