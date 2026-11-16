"""The web application: API routes, request logging and static files."""

import json
import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings

logger = logging.getLogger("darija")


def load_wordbank(path: Path) -> dict:
    """Read the word bank from disk.

    Raises if it is unusable, so the server refuses to start rather than
    running with no data.
    """
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    categories = data.get("categories") if isinstance(data, dict) else None
    if not isinstance(categories, list) or not categories:
        raise ValueError(f'{path}: expected a non-empty "categories" list')
    return data


def create_app(settings: Settings) -> FastAPI:
    """Build the app from explicit settings, so tests can create their own."""
    wordbank = load_wordbank(settings.wordbank_path)

    # No auto-generated docs pages: the API is three read-only routes.
    app = FastAPI(title="Djzariyya", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        # Health probes arrive every few seconds and would drown out real traffic.
        if request.url.path != "/healthz":
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "ms": round((time.perf_counter() - start) * 1000),
                },
            )
        return response

    @app.get("/healthz")
    def healthz():
        """Liveness/readiness probe for load balancers and orchestrators."""
        return {"status": "ok"}

    @app.get("/api/wordbank")
    def get_wordbank():
        return wordbank

    @app.get("/api/version")
    def get_version():
        return {"version": settings.version, "commit": settings.commit}

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(rest: str):
        return JSONResponse({"error": "Not found"}, status_code=404)

    # The built front end. Mounted last so the routes above win.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="web")
    else:
        logger.warning(
            '%s not found: run "npm run build" first; only the API will respond',
            settings.static_dir,
        )

    return app
