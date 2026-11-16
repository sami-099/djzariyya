"""Production entry point: `python -m server`.

Uvicorn handles SIGTERM/SIGINT itself: it stops accepting connections,
lets in-flight requests finish, then exits.
"""

import logging
import logging.config

import uvicorn

from .config import Settings
from .logs import LOG_CONFIG


def main() -> None:
    settings = Settings.from_env()
    logging.config.dictConfig(LOG_CONFIG)
    logging.getLogger("darija").info(
        "starting",
        extra={"port": settings.port, "version": settings.version, "commit": settings.commit},
    )
    uvicorn.run(
        "server.main:app",
        host=settings.host,
        port=settings.port,
        log_config=LOG_CONFIG,
        access_log=False,  # replaced by the JSON request log in app.py
    )


if __name__ == "__main__":
    main()
