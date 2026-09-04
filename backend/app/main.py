from fastapi import FastAPI, Request 
from fastapi.responses import JSONResponse 
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError

from app.database.connection import create_all_tables
from app.middlewares import ( exception_handler, request_logger, jwt_error_handler, auth_middleware )

from app.routes.collection_routes import collectionRouter, apiRouter, testRouter, resultRouter, environmentRouter, schedulerRouter
from app.routes.project_routes import projectRouter, documentRouter
from app.scheduler.scheduler import start_scheduler

app = FastAPI() 

# Middleware 
app.add_middleware(request_logger.RequestLoggingMiddleware) 
app.add_middleware(auth_middleware.UserApiVerifyMiddleware)

# Exception handlers 
exception_handler.register_exception_handlers(app) 
jwt_error_handler.register_jwt_error_handler(app)


app.include_router(projectRouter)
app.include_router(documentRouter)
app.include_router(collectionRouter)
app.include_router(environmentRouter)
app.include_router(apiRouter)
app.include_router(testRouter)
app.include_router(resultRouter)
app.include_router(schedulerRouter)


@app.on_event("startup")
def startup_event():
    create_all_tables()

@app.get("/")
def root():
    return {"message": "FastAPI MVC Running"}

app.mount("/storage", StaticFiles(directory="storage"), name="storage")

@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "Success": None,
            "Code": 1,
            "Error": {"message": exc.errors()[0]["msg"]}
        }
    )
 
@app.on_event("startup")
def start():
    start_scheduler()

































# import requests
# from bs4 import BeautifulSoup
# from fastapi import FastAPI
# from pydantic import BaseModel

# app = FastAPI()

# # -------------------------------
# # INPUT MODEL
# # -------------------------------
# class URLInput(BaseModel):
#     url: str


# # -------------------------------
# # STEP 1: FETCH HTML
# # -------------------------------
# def fetch_html(url):
#     headers = {
#         "User-Agent": "Mozilla/5.0"
#     }
#     res = requests.get(url, headers=headers, timeout=10)
#     return res.text


# # -------------------------------
# # STEP 2: EXTRACT FORM
# # -------------------------------
# def extract_form(html):
#     soup = BeautifulSoup(html, "html.parser")
#     form = soup.find("form")

#     if not form:
#         return None

#     fields = []
#     for tag in form.find_all(["input", "textarea", "select"]):
#         name = tag.get("name")
#         if name:
#             fields.append({
#                 "name": name,
#                 "type": tag.get("type", "text")
#             })

#     return {
#         "action": form.get("action"),
#         "method": form.get("method", "post").lower(),
#         "fields": fields
#     }


# # -------------------------------
# # STEP 3: LLM SIMULATION
# # (Replace with OpenAI later)
# # -------------------------------
# def llm_generate_data(fields):
#     data = {}

#     for field in fields:
#         name = field["name"].lower()

#         if "email" in name:
#             data[field["name"]] = "testuser@gmail.com"
#         elif "phone" in name or "mobile" in name:
#             data[field["name"]] = "9876543210"
#         elif "name" in name:
#             data[field["name"]] = "John Doe"
#         elif "message" in name or "comment" in name:
#             data[field["name"]] = "This is an AI auto-filled form."
#         else:
#             data[field["name"]] = "Test Value"

#     return data


# # -------------------------------
# # STEP 4: SUBMIT FORM
# # -------------------------------
# def submit_form(base_url, form, payload):
#     action = form["action"]

#     if not action.startswith("http"):
#         action = base_url.rstrip("/") + "/" + action.lstrip("/")

#     response = requests.post(action, data=payload)
#     return response.text


# # -------------------------------
# # MAIN API
# # -------------------------------
# @app.post("/auto-fill")
# def auto_fill_form(data: URLInput):
#     html = fetch_html(data.url)
#     form = extract_form(html)

#     if not form:
#         return {"status": "error", "message": "No form found on page"}

#     ai_data = llm_generate_data(form["fields"])
#     response = submit_form(data.url, form, ai_data)

#     return {
#         "status": "success",
#         "form_action": form["action"],
#         "filled_data": ai_data,
#         "response_preview": response[:300]
#     }


# # -------------------------------
# # RUN SERVER
# # -------------------------------
# # Run using:
# # uvicorn auto_form_filler:app --reload












# from playwright.sync_api import sync_playwright
# from fastapi import FastAPI
# from pydantic import BaseModel

# app = FastAPI()

# class URLInput(BaseModel):
#     url: str


# @app.post("/auto-fill")
# def auto_fill(data: URLInput):
#     with sync_playwright() as p:
#         browser = p.chromium.launch(headless=False)  # headless=True for prod
#         page = browser.new_page()

#         page.goto(data.url, timeout=60000)

#         # Wait for form to load
#         page.wait_for_timeout(3000)

#         # 🔹 Auto-detect inputs
#         inputs = page.query_selector_all("input, textarea")

#         form_data = {}

#         for inp in inputs:
#             name = inp.get_attribute("name") or inp.get_attribute("id")

#             if not name:
#                 continue

#             lname = name.lower()

#             if "email" in lname:
#                 value = "test@gmail.com"
#             elif "phone" in lname:
#                 value = "9876543210"
#             elif "name" in lname:
#                 value = "John Doe"
#             elif "message" in lname:
#                 value = "Auto-filled using AI"
#             else:
#                 value = "Test"

#             try:
#                 inp.fill(value)
#                 form_data[name] = value
#             except:
#                 pass

#         # 🔹 Click submit button
#         page.click("button[type='submit']")

#         page.wait_for_timeout(3000)

#         browser.close()

#         return {
#             "status": "success",
#             "filled_data": form_data,
#             "message": "Form submitted successfully"
#         }
