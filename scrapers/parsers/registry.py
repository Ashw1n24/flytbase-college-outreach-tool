from __future__ import annotations

from parsers.base import BaseParser
from parsers.devfolio import DevfolioParser
from parsers.e_yantra import EYantraParser
from parsers.generic_html import GenericHtmlParser
from parsers.gdsc import GDSCParser
from parsers.gsoc import GSoCParser
from parsers.interiit_tech import InterIITParser
from parsers.playwright_html import PlaywrightHtmlParser
from parsers.sih_pdf import SIHPdfParser

PARSERS: dict[str, BaseParser] = {
    DevfolioParser.name: DevfolioParser(),
    GSoCParser.name: GSoCParser(),
    GDSCParser.name: GDSCParser(),
    EYantraParser.name: EYantraParser(),
    InterIITParser.name: InterIITParser(),
    SIHPdfParser.name: SIHPdfParser(),
    GenericHtmlParser.name: GenericHtmlParser(),
    PlaywrightHtmlParser.name: PlaywrightHtmlParser(),
}


def get_parser(name: str) -> BaseParser:
    parser = PARSERS.get(name)
    if parser is None:
        return PARSERS[GenericHtmlParser.name]
    return parser


def list_parsers() -> list[str]:
    return list(PARSERS.keys())
