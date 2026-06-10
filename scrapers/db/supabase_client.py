from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


def get_supabase_client() -> Client:
    load_dotenv(ROOT_ENV)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the root .env file.",
        )

    return create_client(url, key)
