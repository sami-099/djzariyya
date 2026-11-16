"""Structured logging: one JSON object per line on stdout.

That is the format container platforms and log collectors expect, and it
makes fields such as status and duration searchable.
"""

import json
import logging
from datetime import UTC, datetime

# Extra fields a log call may attach, e.g. logger.info("request", extra={"status": 200}).
FIELDS = ("method", "path", "status", "ms", "port", "version", "commit")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
        }
        for field in FIELDS:
            if hasattr(record, field):
                entry[field] = getattr(record, field)
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


# Passed to uvicorn so its own messages (startup, shutdown, errors) use the
# same JSON format as the app's.
LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": JsonFormatter}},
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        }
    },
    "root": {"handlers": ["stdout"], "level": "INFO"},
    "loggers": {
        "uvicorn": {"handlers": [], "propagate": True},
        "uvicorn.error": {"handlers": [], "propagate": True},
    },
}
