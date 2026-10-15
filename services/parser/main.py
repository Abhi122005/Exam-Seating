import io
import os

import pdfplumber
from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pdf_parser import parse_seating_pdf

load_dotenv()

app = FastAPI(title="Exam Seating PDF Parser")

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Tight CORS: explicit methods/headers only (no wildcard), short max-age.
# The parser is server-to-server (web -> parser with x-backend-secret);
# browsers never need to call it directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["x-backend-secret", "content-type"],
    allow_credentials=False,
    max_age=600,
)

BACKEND_SHARED_SECRET = os.environ.get("BACKEND_SHARED_SECRET", "change-me")

# Upload ceiling. Seating PDFs are normally well under 1 MB, but letterhead
# logos / seals / high-DPI exports inflate size — generous and env-overridable
# to match the web layer (MAX_UPLOAD_MB). Page count is the real resource guard.
MAX_FILE_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "10")) * 1024 * 1024
MAX_PAGES = int(os.environ.get("PARSER_MAX_PAGES", "200"))

IS_PRODUCTION = (
    os.environ.get("ENVIRONMENT", os.environ.get("NODE_ENV", "development")) == "production"
)


class ParsedRange(BaseModel):
    roll_from: str
    roll_to: str
    label: str | None = None
    count: int | None = None


class ParsedRoomOut(BaseModel):
    room_no: str
    ranges: list[ParsedRange]


class ParsePdfResponse(BaseModel):
    rooms: list[ParsedRoomOut]
    source: str
    warning: str | None = None


def _check_secret(x_backend_secret: str | None):
    # Fail closed in production: never validate against the placeholder
    # secret. Local dev keeps the zero-config default.
    if IS_PRODUCTION and BACKEND_SHARED_SECRET == "change-me":
        raise HTTPException(
            status_code=503,
            detail="BACKEND_SHARED_SECRET is not configured",
        )
    if x_backend_secret != BACKEND_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing backend secret")


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/api/parse-pdf", response_model=ParsePdfResponse)
async def parse_pdf(
    file: UploadFile = File(...),
    x_backend_secret: str | None = Header(default=None),
):
    _check_secret(x_backend_secret)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    file_bytes = await file.read()
    # Mirror the web 10 MB cap server-side (defense in depth — the web route
    # already rejects oversize uploads, but the parser must not trust callers).
    if len(file_bytes) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large (max {MAX_FILE_BYTES // (1024 * 1024)} MB)",
        )
    if len(file_bytes) < 5 or not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    # Resource bound: a small PDF can still declare thousands of pages, which
    # would make line reconstruction walk all of them.
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as probe:
            if len(probe.pages) > MAX_PAGES:
                raise HTTPException(
                    status_code=413,
                    detail=f"PDF exceeds the {MAX_PAGES}-page limit",
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse PDF") from None

    try:
        parsed_rooms, source = parse_seating_pdf(file_bytes)
    except Exception:
        # Never reflect raw exception text (may leak paths/versions).
        raise HTTPException(status_code=422, detail="Could not parse PDF") from None

    rooms_out = [ParsedRoomOut(room_no=r["room_no"], ranges=r["ranges"]) for r in parsed_rooms]

    warning = None
    if not rooms_out:
        warning = (
            "Nothing could be parsed. This usually means the PDF has no text layer "
            "(e.g. it's a scanned image), or it doesn't match either supported layout."
        )

    return ParsePdfResponse(rooms=rooms_out, source=source, warning=warning)
