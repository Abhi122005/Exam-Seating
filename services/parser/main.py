import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pdf_parser import parse_seating_pdf

load_dotenv()

app = FastAPI(title="Exam Seating PDF Parser")

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_SHARED_SECRET = os.environ.get("BACKEND_SHARED_SECRET", "change-me")


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

    try:
        parsed_rooms, source = parse_seating_pdf(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {exc}") from exc

    rooms_out = [ParsedRoomOut(room_no=r["room_no"], ranges=r["ranges"]) for r in parsed_rooms]

    warning = None
    if not rooms_out:
        warning = (
            "Nothing could be parsed. This usually means the PDF has no text layer "
            "(e.g. it's a scanned image), or it doesn't match either supported layout."
        )

    return ParsePdfResponse(rooms=rooms_out, source=source, warning=warning)
