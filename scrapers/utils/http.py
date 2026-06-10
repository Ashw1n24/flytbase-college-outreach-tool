from __future__ import annotations

import random
import time
from typing import Any, Optional

import requests
from requests.exceptions import HTTPError, RequestException, Timeout

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; FlytBaseTalentScraper/1.0; "
        "+https://flytbase.com)"
    ),
    "Accept": "text/html,application/json,*/*",
}

RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


def fetch_url(
    url: str,
    *,
    method: str = "GET",
    params: Optional[dict[str, Any]] = None,
    headers: Optional[dict[str, str]] = None,
    timeout: int = 30,
    max_retries: int = 5,
    base_delay: float = 1.0,
) -> requests.Response:
    """HTTP GET/POST with exponential backoff on timeouts and rate limits."""
    merged_headers = {**DEFAULT_HEADERS, **(headers or {})}
    last_error: Optional[Exception] = None

    for attempt in range(max_retries):
        try:
            response = requests.request(
                method,
                url,
                params=params,
                headers=merged_headers,
                timeout=timeout,
            )
            if response.status_code in RETRYABLE_STATUS:
                raise RequestException(
                    f"Retryable status {response.status_code} for {url}",
                )
            response.raise_for_status()
            return response
        except HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 0
            if 400 <= status < 500 and status != 429:
                raise
            last_error = exc
        except (Timeout, RequestException) as exc:
            last_error = exc

        if attempt == max_retries - 1:
            break
        delay = base_delay * (2**attempt) + random.uniform(0, 0.5)
        time.sleep(delay)

    raise RequestException(f"Failed after {max_retries} attempts: {url}") from last_error


def fetch_html(url: str, **kwargs: Any) -> str:
    return fetch_url(url, **kwargs).text


def fetch_json(url: str, **kwargs: Any) -> Any:
    return fetch_url(url, **kwargs).json()
