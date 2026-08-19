"""
Parses a seating-allocation PDF into a unified "room -> roll-number ranges"
structure. Two real source formats are supported:

1. "Hall Allocation Summary" (the real KTU/college internal-exam format):

       Hall: 301
       Year Batch From To Count Absentees
       2 C CS24C08 CS24C25 18
       4 C CS22C20 CS22C31 12

   Already organized per room/hall, gives roll-number *ranges* (not a full
   list), plus a Year/Batch label and a stated Count for that range.

2. The older "Subject: CODE -N Nos" style table (per-subject comma lists of
   individual roll numbers inside one table cell), kept for compatibility.

Both are normalized into the same shape: for each room, a list of ranges
{roll_from, roll_to, label, count}. A single roll number is just a range
where roll_from == roll_to. Ranges are NOT expanded into individual roll
numbers -- roll numbers here don't increment in a fixed, predictable way
(a batch letter "rolls over" to the next letter at a class-size boundary
that varies), so guessing intermediate values would risk generating roll
numbers that don't exist. Instead, matching a student's roll number is a
lexicographic "is this string between roll_from and roll_to" check, which
handles the letter rollover correctly on its own because all roll numbers
here share the same fixed format/length.

Caveats surfaced to the admin via the API response:
  - Needs a PDF with an actual text layer. A scanned/photographed page has
    no text layer and this will find nothing -- that needs OCR instead,
    which isn't wired in here.
  - Row reconstruction clusters words by vertical position rather than
    trusting the PDF's own line breaks, specifically because column text
    can otherwise merge across line/page boundaries in some PDF exports.
"""

import io
import re
from typing import TypedDict

import pdfplumber


class ParsedRange(TypedDict):
    roll_from: str
    roll_to: str
    label: str | None
    count: int | None


class ParsedRoom(TypedDict):
    room_no: str
    ranges: list[ParsedRange]


HALL_HEADER_RE = re.compile(r"^Hall\s*:\s*(\S+)", re.IGNORECASE)
HALL_SUMMARY_MARKER = "Hall Allocation Summary"

# "2 C CS24C08 CS24C25 18" -> Year, Batch, From, To, Count, [Absentees]
HALL_ROW_RE = re.compile(
    r"^(\d+)\s+([A-Za-z])\s+([A-Za-z0-9]+)\s+([A-Za-z0-9]+)\s+(\d+)(?:\s+(\d+))?\s*$"
)

SUBJECT_HEADER_RE = re.compile(
    r"\d+\)\s*Subject\s*:\s*(?P<code>[A-Za-z0-9]+)\s*-\s*\d+\s*Nos?",
    re.IGNORECASE,
)
ROLL_TOKEN_RE = re.compile(r"[A-Za-z]{2,6}\d{2,3}[A-Za-z]{0,3}\d{0,4}")


def _reconstruct_lines(page, y_tol: float = 3) -> list[str]:
    """
    Group words into text lines by vertical position instead of trusting
    the PDF's own line breaks (which can merge across a line or page
    boundary in some exports). Returns one string per visual line, words
    left-to-right.
    """
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return []

    words.sort(key=lambda w: (round(w["top"] / y_tol), w["x0"]))

    lines: list[list] = []
    current_key = None
    current: list = []
    for w in words:
        key = round(w["top"] / y_tol)
        if current_key is None or key == current_key:
            current.append(w)
            current_key = key
        else:
            lines.append(current)
            current = [w]
            current_key = key
    if current:
        lines.append(current)

    return [" ".join(w["text"] for w in ln) for ln in lines]


def _parse_hall_allocation_summary(file_bytes: bytes) -> list[ParsedRoom] | None:
    """Returns None if this document doesn't contain a Hall Allocation
    Summary section at all (caller should try the other format instead)."""
    rooms: list[ParsedRoom] = []
    current_room: ParsedRoom | None = None
    found_section = False

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if HALL_SUMMARY_MARKER in page_text:
                found_section = True
            if not found_section:
                continue

            for raw_line in _reconstruct_lines(page):
                line = raw_line.strip()
                if not line:
                    continue

                hall_match = HALL_HEADER_RE.match(line)
                if hall_match:
                    if current_room and current_room["ranges"]:
                        rooms.append(current_room)
                    current_room = {"room_no": hall_match.group(1), "ranges": []}
                    continue

                if current_room is None:
                    continue  # haven't hit a "Hall:" header yet

                row_match = HALL_ROW_RE.match(line)
                if row_match:
                    year, batch, roll_from, roll_to, count, _absentees = row_match.groups()
                    current_room["ranges"].append(
                        {
                            "roll_from": roll_from.upper(),
                            "roll_to": roll_to.upper(),
                            "label": f"Year {year} \u00b7 Batch {batch.upper()}",
                            "count": int(count),
                        }
                    )

        if current_room and current_room["ranges"]:
            rooms.append(current_room)

    return rooms if found_section else None


def _split_subject_blocks(raw_text: str) -> list[ParsedRange]:
    headers = list(SUBJECT_HEADER_RE.finditer(raw_text))
    if not headers:
        rolls = ROLL_TOKEN_RE.findall(raw_text)
        return [
            {"roll_from": r.upper(), "roll_to": r.upper(), "label": "UNKNOWN", "count": 1}
            for r in rolls
        ]

    ranges: list[ParsedRange] = []
    for i, match in enumerate(headers):
        code = match.group("code").upper()
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(raw_text)
        chunk = raw_text[start:end]
        for roll in ROLL_TOKEN_RE.findall(chunk):
            ranges.append(
                {"roll_from": roll.upper(), "roll_to": roll.upper(), "label": code, "count": 1}
            )
    return ranges


def _parse_subject_list_tables(file_bytes: bytes) -> list[ParsedRoom]:
    rooms: list[ParsedRoom] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if not row or len(row) < 3:
                        continue
                    room_no_cell, _total_cell, register_cell = row[0], row[1], row[2]
                    if not room_no_cell or not register_cell:
                        continue
                    if room_no_cell.strip().lower() in ("room no", "room no.", ""):
                        continue
                    ranges = _split_subject_blocks(register_cell)
                    if ranges:
                        rooms.append({"room_no": room_no_cell.strip(), "ranges": ranges})
    return rooms


def parse_seating_pdf(file_bytes: bytes) -> tuple[list[ParsedRoom], str]:
    """
    Returns (rooms, source) where source is "hall_summary" or "subject_list",
    so the caller/admin knows which format was detected.
    """
    hall_rooms = _parse_hall_allocation_summary(file_bytes)
    if hall_rooms is not None:
        return hall_rooms, "hall_summary"

    return _parse_subject_list_tables(file_bytes), "subject_list"
