"""Runtime configuration, read from environment variables.

Keeping configuration in the environment means the same build can run
unchanged in every environment.
"""

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _app_version() -> str:
    with open(ROOT / "pyproject.toml", "rb") as f:
        return tomllib.load(f)["project"]["version"]


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    commit: str
    version: str
    wordbank_path: Path
    static_dir: Path

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            # 127.0.0.1 is only reachable from this machine. Inside a
            # container set HOST=0.0.0.0 or nothing outside can connect.
            host=os.environ.get("HOST", "127.0.0.1"),
            port=int(os.environ.get("PORT", "8000")),
            commit=os.environ.get("COMMIT_SHA", "dev")[:7],
            version=_app_version(),
            wordbank_path=Path(os.environ.get("WORDBANK_PATH", ROOT / "data" / "wordbank.json")),
            static_dir=Path(os.environ.get("STATIC_DIR", ROOT / "dist")),
        )
