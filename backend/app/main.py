import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.chat import router as chat_router
from app.api.routes.documents import router as documents_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

# The frontend runs on a different origin (e.g. localhost:3000 vs this
# API's localhost:8000), so without CORS the browser blocks it from ever
# reading a response, even though the request reaches the server fine —
# this is the only way frontend/.env.local's NEXT_PUBLIC_API_URL setup
# actually works from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router)
app.include_router(chat_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Last-resort safety net: every route already catches its own expected
    # failure modes as typed exceptions -> HTTPException. Anything that
    # reaches here is unexpected, so the client gets a generic, sanitized
    # message (never a stack trace or internal error text) while the full
    # detail is logged server-side for debugging.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
