from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response
from app.utils.logger import get_logger
from app.utils.crypto import mask_sensitive
import time
import json

logger = get_logger("requests")

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        start_time = time.time()

        # ---------------- READ REQUEST BODY ----------------
        req_body_bytes = await request.body()

        try:
            req_body = req_body_bytes.decode("utf-8")
        except:
            req_body = "<binary>"

        req_body = mask_sensitive(req_body)

        # Rebuild request so downstream can read body again
        async def receive_again():
            return {"type": "http.request", "body": req_body_bytes}

        request = Request(request.scope, receive=receive_again)

        # ---------------- GET RESPONSE ----------------
        response = await call_next(request)

        # ---------------- READ RESPONSE BODY ----------------
        res_body = b""
        async for chunk in response.body_iterator:
            res_body += chunk

        # Convert for logging
        try:
            res_body_text = res_body.decode("utf-8")
        except:
            res_body_text = "<binary>"

        # ---------------- REBUILD RESPONSE (IMPORTANT) ----------------
        final_response = Response(
            content=res_body,                   # original response body
            status_code=response.status_code,
            headers=dict(response.headers),    # keep same headers
            media_type=response.media_type
        )

        # ---------------- LOG IN SINGLE LINE ----------------
        duration = round((time.time() - start_time) * 1000, 2)

        log_line = {
            "method": request.method,
            "url": request.url.path,
            "status": response.status_code,
            "duration_ms": duration,
            "client_ip": request.client.host,
            "request_body": req_body,
            "response_body": res_body_text
        }

        logger.info(json.dumps(log_line))

        return final_response
