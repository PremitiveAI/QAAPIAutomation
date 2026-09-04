from app.database.connection import SessionLocal
from app.controllers.test_case_controller import TestCaseController

def execute_job(payload: dict):
    print("🚀 Scheduler Job Executing...")
    print("Payload:", payload)

    collection_id = payload.get("collection_id")

    if not collection_id:
        print("❌ collection_id not found in payload")
        return

    # ✅ Manually create DB session (NO Depends here)
    db = SessionLocal()
    try:
        TestCaseController.run_scheduler_test_case(db=db, collection_id=collection_id)
        print(f"✅ Executed scheduler for collection: {collection_id}")

    except Exception as e:
        print("❌ Scheduler execution failed:", str(e))

    finally:
        db.close()