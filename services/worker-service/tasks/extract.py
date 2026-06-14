"""
tasks/extract.py
─────────────────
Unified text extraction backend.

Routing logic
─────────────
  .pdf              → PyMuPDF for native-text pages  (fast, zero model overhead)
                      OCR pipeline for scanned pages  (PaddleOCR → Surya if needed)
  .docx             → python-docx, segmented by headings / char count
  .csv              → pandas, batched in groups of 10 rows
  .png/.jpg/.jpeg   → OCR pipeline (PaddleOCR → Surya, deskew enabled)

Public API:
    extract_text(file_path, mime_type=None) → list[{"page": int, "text": str}]
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Ensure ocr_service is importable from the ocr-service sibling directory.
#
# Project layout assumed:
#   services/
#     ocr-service/          ← ocr_service package lives here
#       ocr_service/
#         pipeline.py
#         preprocessing/
#         engines/
#         routing/
#         scoring/
#     worker-service/
#       tasks/
#         extract.py        ← this file
#
# We walk up from this file to services/ and then point at ocr-service/.
# ──────────────────────────────────────────────────────────────────────────────

def _ensure_ocr_service_on_path() -> None:
    """Add the directory containing the ocr_service package to sys.path.

    Supports two layouts:
      1. services/worker-service/tasks/ocr-service/ocr_service   (nested copy)
      2. services/ocr-service/ocr_service                        (sibling service, default)

    We try the nested layout first (kept for backward compatibility), then
    fall back to the sibling layout described in pipeline.py / main.py.
    """
    this_file = Path(__file__).resolve()

    # Candidate 1: tasks/ocr-service/ (nested copy next to this file)
    nested_dir = this_file.parent / "ocr-service"

    # Candidate 2: services/ocr-service/ (sibling of worker-service)
    # this_file = services/worker-service/tasks/extract.py
    # -> parents[1] = services/worker-service -> parents[2] = services
    sibling_dir = this_file.parents[2] / "ocr-service"

    for candidate in (nested_dir, sibling_dir):
        if candidate.is_dir() and (candidate / "ocr_service").is_dir():
            candidate_str = str(candidate)
            if candidate_str not in sys.path:
                sys.path.insert(0, candidate_str)
                logger.debug("Added %s to sys.path for ocr_service imports", candidate_str)
            return

    raise ImportError(
        f"ocr-service package not found. Tried:\n"
        f"  - {nested_dir} (expects {nested_dir / 'ocr_service'})\n"
        f"  - {sibling_dir} (expects {sibling_dir / 'ocr_service'})\n"
        "Make sure the ocr_service package exists in one of these locations."
    )


_ensure_ocr_service_on_path()


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────────────

def extract_text(file_path: str, mime_type: str | None = None) -> list[dict]:
    """
    Extracts text from a file, routing to the correct backend by extension.

    Args:
        file_path:  Absolute path to the file on disk.
        mime_type:  Optional MIME hint (unused; kept for API compatibility).

    Returns:
        list[dict] — one dict per page/segment:
            {"page": int, "text": str}

    Raises:
        ValueError: for unsupported file extensions.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext == ".docx":
        return _extract_docx(file_path)
    elif ext == ".csv":
        return _extract_csv(file_path)
    elif ext in (".png", ".jpg", ".jpeg"):
        return _extract_image(file_path)
    else:
        raise ValueError(
            f"Unsupported file extension: '{ext}'. "
            "Supported: .pdf, .docx, .csv, .png, .jpg, .jpeg"
        )


# ──────────────────────────────────────────────────────────────────────────────
# PDF — hybrid: PyMuPDF for digital pages, OCR pipeline for scanned pages
# ──────────────────────────────────────────────────────────────────────────────

def _extract_pdf(file_path: str) -> list[dict]:
    """
    Page-by-page PDF extraction.

    Strategy per page:
    - If PyMuPDF finds selectable text → use it directly (fast, no model needed).
    - If the page is blank / image-only → run the OCR pipeline
      (PaddleOCR first; Surya as fallback if confidence < threshold).
    """
    import fitz  # PyMuPDF
    from ocr_service.pipeline import run_ocr_on_image
    from ocr_service.preprocessing.image_processor import pdf_page_to_image

    doc   = fitz.open(file_path)
    pages = []

    try:
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text().strip()

            if text:
                # ── Digital page: native text layer present ────────
                pages.append({"page": page_num + 1, "text": text})
                logger.debug(
                    "PDF page %d: native text (%d chars)", page_num + 1, len(text)
                )

            else:
                # ── Scanned page: no text layer → OCR pipeline ────
                logger.info(
                    "PDF page %d: no native text — running OCR pipeline", page_num + 1
                )
                img    = pdf_page_to_image(file_path, page_num=page_num, dpi=200)
                result = run_ocr_on_image(img, page_num=page_num + 1, deskew=True)

                if result["text"]:
                    pages.append({"page": page_num + 1, "text": result["text"]})
                    logger.info(
                        "  Page %d OCR → model=%s  confidence=%.3f",
                        page_num + 1,
                        result["model_used"],
                        result["confidence_score"],
                    )
                else:
                    logger.warning(
                        "  Page %d: no text after OCR — skipping", page_num + 1
                    )
    finally:
        doc.close()

    logger.info(
        "PDF extraction complete: %d pages with text  (%s)",
        len(pages), os.path.basename(file_path),
    )
    return pages


# ──────────────────────────────────────────────────────────────────────────────
# Standalone image — full OCR pipeline (PaddleOCR → Surya)
# ──────────────────────────────────────────────────────────────────────────────

def _extract_image(file_path: str) -> list[dict]:
    """
    Routes a standalone image file (.png / .jpg / .jpeg) through the OCR
    pipeline.  Deskew is always enabled for tilted scans.
    """
    from ocr_service.pipeline import run_ocr_on_image

    img    = Image.open(file_path).convert("RGB")
    result = run_ocr_on_image(img, page_num=1, deskew=True)

    if result["text"]:
        logger.info(
            "Image OCR (%s) → model=%s  confidence=%.3f",
            os.path.basename(file_path),
            result["model_used"],
            result["confidence_score"],
        )
        return [{"page": 1, "text": result["text"]}]

    logger.warning(
        "Image OCR: no text extracted from '%s'", os.path.basename(file_path)
    )
    return []


# ──────────────────────────────────────────────────────────────────────────────
# DOCX — python-docx, segmented by headings / character count
# ──────────────────────────────────────────────────────────────────────────────

def _extract_docx(file_path: str) -> list[dict]:
    """
    Extracts text from a .docx file using python-docx.
    Segments by heading boundaries or ~1 500-char threshold.
    """
    import docx

    doc = docx.Document(file_path)
    pages, current_segment, segment_index, char_count = [], [], 1, 0

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        current_segment.append(text)
        char_count += len(text)

        if para.style.name.startswith("Heading") or char_count > 1500:
            pages.append({"page": segment_index, "text": "\n".join(current_segment)})
            current_segment, char_count = [], 0
            segment_index += 1

    if current_segment:
        pages.append({"page": segment_index, "text": "\n".join(current_segment)})

    logger.info(
        "DOCX: %d segments from '%s'", len(pages), os.path.basename(file_path)
    )
    return pages


# ──────────────────────────────────────────────────────────────────────────────
# CSV — pandas, batched in groups of 10 rows
# ──────────────────────────────────────────────────────────────────────────────

def _extract_csv(file_path: str) -> list[dict]:
    """
    Extracts text from a .csv file using pandas.
    Groups rows in batches of 10, prefixed with column headers.
    """
    import pandas as pd

    df         = pd.read_csv(file_path)
    headers    = ", ".join(df.columns)
    pages      = []
    chunk_size = 10

    for i in range(0, len(df), chunk_size):
        subset = df.iloc[i : i + chunk_size]
        rows   = [
            f"Row {idx}: " + ", ".join(str(v) for v in row.values)
            for idx, row in subset.iterrows()
        ]
        pages.append({
            "page": i + 1,
            "text": f"Headers: {headers}\n" + "\n".join(rows),
        })

    logger.info(
        "CSV: %d chunks (%d rows) from '%s'",
        len(pages), len(df), os.path.basename(file_path),
    )
    return pages