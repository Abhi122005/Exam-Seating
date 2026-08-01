import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pdf_parser import parse_seating_pdf

load_dotenv()

app = FastAPI(title="Exam Seating PDF Parser")

app.add_middleware(
    CORSMiddleware,
    # Only the Next.js server calls this API server-to-server (never the
    # browser directly), so this doesn't need to be locked to a specific
    # origin -- the real access control is the shared-secret header check
    # below, not CORS.
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_SHARED_SECRET = os.environ.get("BACKEND_SHARED_SECRET", "change-me")


class ParsedRange(BaseModel):
    roll_from: str
    roll_to: str
    label: Optional[str] = None
    count: Optional[int] = None


class ParsedRoomOut(BaseModel):
    room_no: str
    ranges: list[ParsedRange]


class ParsePdfResponse(BaseModel):
    rooms: list[ParsedRoomOut]
    source: str  # "hall_summary" or "subject_list"
    warning: Optional[str] = None


def _check_secret(x_backend_secret: Optional[str]):
    if x_backend_secret != BACKEND_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing backend secret")


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/api/parse-pdf", response_model=ParsePdfResponse)
async def parse_pdf(
    file: UploadFile = File(...),
    x_backend_secret: Optional[str] = Header(default=None),
):
    _check_secret(x_backend_secret)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    file_bytes = await file.read()

    try:
        parsed_rooms, source = parse_seating_pdf(file_bytes)
    except Exception as exc:  # pdfplumber raises various error types on bad files
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}") from exc

    rooms_out = [ParsedRoomOut(room_no=r["room_no"], ranges=r["ranges"]) for r in parsed_rooms]

    warning = None
    if not rooms_out:
        warning = (
            "Nothing could be parsed. This usually means the PDF has no text layer "
            "(e.g. it's a scanned image), or it doesn't match either supported "
            "layout."
        )

    return ParsePdfResponse(rooms=rooms_out, source=source, warning=warning)
