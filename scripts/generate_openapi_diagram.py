from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "server" / "openapi.json"
OUT_DIR = ROOT / "docs" / "api-diagram"
SVG_PATH = OUT_DIR / "openapi-overview.svg"

CARD_WIDTH = 520
COLUMN_GAP = 28
ROW_GAP = 28
PAGE_PADDING = 40
TITLE_HEIGHT = 120
CARD_HEADER_HEIGHT = 48
CARD_PADDING = 18
LINE_HEIGHT = 24
COLUMN_COUNT = 3

BG = "#F8FAFC"
INK = "#0F172A"
MUTED = "#475569"
BORDER = "#CBD5E1"
ACCENT = "#16A34A"
ACCENT_BG = "#DCFCE7"
CARD_BG = "#FFFFFF"


def load_spec() -> dict[str, Any]:
    return json.loads(SPEC_PATH.read_text(encoding="utf-8"))


def escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def chunk_text(value: str, limit: int = 48) -> list[str]:
    words = value.split(" ")
    if not words:
        return [value]

    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines or [value]


def collect_sections(spec: dict[str, Any]) -> list[dict[str, Any]]:
    grouped: dict[str, list[str]] = {}
    for path, path_item in (spec.get("paths") or {}).items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                continue
            tag = "Other"
            if isinstance(operation, dict) and operation.get("tags"):
                tag = str(operation["tags"][0])
            grouped.setdefault(tag, []).append(f"{method.upper():<6} {path}")

    sections: list[dict[str, Any]] = []
    for tag, lines in sorted(grouped.items(), key=lambda item: item[0].lower()):
        wrapped_lines: list[str] = []
        for line in sorted(lines):
            wrapped_lines.extend(chunk_text(line))
        height = CARD_HEADER_HEIGHT + CARD_PADDING * 2 + len(wrapped_lines) * LINE_HEIGHT
        sections.append(
            {
                "title": tag,
                "endpoint_count": len(lines),
                "lines": wrapped_lines,
                "height": height,
            }
        )
    return sections


def place_sections(sections: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    column_heights = [PAGE_PADDING + TITLE_HEIGHT for _ in range(COLUMN_COUNT)]
    placed: list[dict[str, Any]] = []

    for section in sorted(sections, key=lambda item: item["height"], reverse=True):
        column = min(range(COLUMN_COUNT), key=lambda idx: column_heights[idx])
        x = PAGE_PADDING + column * (CARD_WIDTH + COLUMN_GAP)
        y = column_heights[column]
        placed.append({**section, "x": x, "y": y})
        column_heights[column] += section["height"] + ROW_GAP

    total_height = max(column_heights) + PAGE_PADDING
    return placed, total_height


def render_svg(placed: list[dict[str, Any]], total_height: int, total_endpoints: int) -> str:
    width = PAGE_PADDING * 2 + COLUMN_COUNT * CARD_WIDTH + (COLUMN_COUNT - 1) * COLUMN_GAP
    total_groups = len(placed)

    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{total_height}' viewBox='0 0 {width} {total_height}'>",
        f"<rect width='{width}' height='{total_height}' fill='{BG}'/>",
        f"<text x='{PAGE_PADDING}' y='62' font-family='Helvetica, Arial, sans-serif' font-size='34' font-weight='700' fill='{INK}'>SkillStorm API Overview</text>",
        (
            f"<text x='{PAGE_PADDING}' y='96' font-family='Helvetica, Arial, sans-serif' font-size='18' "
            f"fill='{MUTED}'>Source: server/openapi.json • {total_endpoints} endpoints • {total_groups} functional groups</text>"
        ),
    ]

    for section in placed:
        x = section["x"]
        y = section["y"]
        title = escape_xml(section["title"])
        parts.append(
            f"<rect x='{x}' y='{y}' width='{CARD_WIDTH}' height='{section['height']}' rx='18' fill='{CARD_BG}' stroke='{BORDER}' stroke-width='1.5'/>"
        )
        parts.append(
            f"<rect x='{x + 1}' y='{y + 1}' width='{CARD_WIDTH - 2}' height='{CARD_HEADER_HEIGHT}' rx='17' fill='{ACCENT_BG}'/>"
        )
        parts.append(
            f"<text x='{x + CARD_PADDING}' y='{y + 31}' font-family='Helvetica, Arial, sans-serif' font-size='22' font-weight='700' fill='{ACCENT}'>{title}</text>"
        )
        parts.append(
            f"<text x='{x + CARD_WIDTH - CARD_PADDING}' y='{y + 31}' text-anchor='end' font-family='Helvetica, Arial, sans-serif' font-size='16' font-weight='700' fill='{MUTED}'>{section['endpoint_count']} endpoints</text>"
        )

        cursor_y = y + CARD_HEADER_HEIGHT + CARD_PADDING + 2
        for line in section["lines"]:
            parts.append(
                f"<text x='{x + CARD_PADDING}' y='{cursor_y}' font-family='Menlo, Monaco, &quot;Courier New&quot;, monospace' font-size='15.5' fill='{INK}'>{escape_xml(line)}</text>"
            )
            cursor_y += LINE_HEIGHT

    parts.append("</svg>")
    return "\n".join(parts)


def main() -> None:
    spec = load_spec()
    sections = collect_sections(spec)
    placed, total_height = place_sections(sections)
    total_endpoints = sum(section["endpoint_count"] for section in sections)
    svg = render_svg(placed, total_height, total_endpoints)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SVG_PATH.write_text(svg, encoding="utf-8")
    print(SVG_PATH.relative_to(ROOT))


if __name__ == "__main__":
    main()
