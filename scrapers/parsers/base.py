from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.scrape_record import RawParticipant, ScrapeTarget


class BaseParser(ABC):
    name: str = "base"

    @abstractmethod
    def scrape(self, target: ScrapeTarget) -> list[RawParticipant]:
        raise NotImplementedError
