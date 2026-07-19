from fastapi import FastAPI

from app.api.routes.chat import router as chat_router
from app.api.routes.documents import router as documents_router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title=settings.app_name)
app.include_router(documents_router)
app.include_router(chat_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
