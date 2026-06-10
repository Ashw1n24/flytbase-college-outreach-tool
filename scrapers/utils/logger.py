from __future__ import annotations

import traceback
from datetime import datetime, timezone
from pathlib import Path


class ScraperLogger:
    """Append-only logger for scraper runs (scraper_log.txt)."""

    def __init__(self, log_path: Path | None = None) -> None:
        self.log_path = log_path or Path(__file__).resolve().parent.parent / "scraper_log.txt"

    def _write(self, level: str, message: str) -> None:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        line = f"[{ts}] [{level}] {message}\n"
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(line)

    def info(self, message: str) -> None:
        self._write("INFO", message)

    def warning(self, message: str) -> None:
        self._write("WARN", message)

    def error(self, message: str, exc: BaseException | None = None) -> None:
        self._write("ERROR", message)
        if exc is not None:
            with self.log_path.open("a", encoding="utf-8") as f:
                f.write(traceback.format_exc())
                f.write("\n")
