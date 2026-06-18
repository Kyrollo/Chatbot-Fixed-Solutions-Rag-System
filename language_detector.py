"""
Pre-OCR language detection helpers.

This detector is intentionally narrow: it chooses between Arabic and English
from the visual appearance of the document before OCR runs.
"""

import io
import os
from typing import BinaryIO, Dict, List


LANGUAGE_PROMPTS = [
    {"name": "arabic", "label": "Arabic text", "languages": ["ar"]},
    {"name": "english", "label": "English text", "languages": ["en"]},
]

_CLIP_MODEL = None
_CLIP_PREPROCESS = None


def _load_clip():
    global _CLIP_MODEL, _CLIP_PREPROCESS

    if _CLIP_MODEL is not None and _CLIP_PREPROCESS is not None:
        return _CLIP_MODEL, _CLIP_PREPROCESS

    try:
        import clip
        import torch
    except ImportError as exc:
        raise ImportError(
            "CLIP is required for pre-OCR language detection.\n"
            "Install a package that provides the `clip` module before using auto detection."
        ) from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    download_root = os.getenv("CLIP_MODEL_DIR")
    _CLIP_MODEL, _CLIP_PREPROCESS = clip.load(
        "ViT-B/32",
        device=device,
        download_root=download_root,
    )
    return _CLIP_MODEL, _CLIP_PREPROCESS


def detect_language_from_pil_image(image) -> Dict:
    """
    Detect whether an image is more likely Arabic or English text.
    """
    import clip
    import torch

    model, preprocess = _load_clip()
    device = next(model.parameters()).device

    image_tensor = preprocess(image.convert("RGB")).unsqueeze(0).to(device)
    text_tensor = clip.tokenize([item["label"] for item in LANGUAGE_PROMPTS]).to(device)

    with torch.no_grad():
        image_features = model.encode_image(image_tensor)
        text_features = model.encode_text(text_tensor)

        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        logits = 100.0 * image_features @ text_features.T
        probs = logits.softmax(dim=-1)[0]

    ranked = sorted(
        (
            {
                "language": item["name"],
                "prompt": item["label"],
                "score": float(prob),
                "suggested_languages": item["languages"],
            }
            for item, prob in zip(LANGUAGE_PROMPTS, probs.tolist())
        ),
        key=lambda item: item["score"],
        reverse=True,
    )
    return {"top": ranked[0], "ranked": ranked}


def detect_languages_for_ocr_pil_image(image) -> List[str]:
    return detect_language_from_pil_image(image)["top"]["suggested_languages"]


def _read_image_from_file(file: BinaryIO):
    try:
        from PIL import Image
    except ImportError as exc:
        raise ImportError(
            "Pillow is required for image language detection.\n"
            "Install it with:  pip install Pillow"
        ) from exc

    current_pos = file.tell()
    data = file.read()
    file.seek(current_pos)
    return Image.open(io.BytesIO(data)).convert("RGB")


def _read_pdf_preview_from_file(file: BinaryIO):
    try:
        from pdf2image import convert_from_bytes
    except ImportError as exc:
        raise ImportError(
            "pdf2image is required for PDF language detection.\n"
            "Install it with:  pip install pdf2image"
        ) from exc

    current_pos = file.tell()
    data = file.read()
    file.seek(current_pos)
    images = convert_from_bytes(data, dpi=150, first_page=1, last_page=1, fmt="RGB")
    if not images:
        raise ValueError("Could not rasterize PDF preview for language detection.")
    return images[0]


def _read_docx_preview_from_file(file: BinaryIO):
    try:
        from docx import Document
        from PIL import Image
    except ImportError:
        return None

    current_pos = file.tell()
    data = file.read()
    file.seek(current_pos)
    doc = Document(io.BytesIO(data))

    for rel in doc.part._rels.values():
        target = getattr(rel, "target_part", None)
        if target is None:
            continue
        content_type = getattr(target, "content_type", "") or ""
        if not content_type.startswith("image/"):
            continue
        blob = getattr(target, "blob", None)
        if not blob:
            continue
        try:
            return Image.open(io.BytesIO(blob)).convert("RGB")
        except Exception:
            continue
    return None


def detect_ocr_languages(file: BinaryIO, file_type: str) -> List[str]:
    """
    Detect OCR languages from a file-like object.

    Returns a list such as ["ar"] or ["en"].
    """
    if file_type == "image":
        preview = _read_image_from_file(file)
    elif file_type == "pdf":
        preview = _read_pdf_preview_from_file(file)
    elif file_type == "docx":
        preview = _read_docx_preview_from_file(file)
        if preview is None:
            return ["ar", "en"]
    else:
        return ["ar", "en"]

    return detect_languages_for_ocr_pil_image(preview)
