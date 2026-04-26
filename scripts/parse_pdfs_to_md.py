from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import fitz
from ftfy import fix_text
from rapidocr_onnxruntime import RapidOCR


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "docs"
OUT_DIR = ROOT / "Документация" / "md"
ASSETS_DIR = OUT_DIR / "_ocr_debug"

# If direct extraction returns fewer characters than this, treat the page as scan-like.
MIN_DIRECT_TEXT_CHARS = 120

CYRILLIC_MAP = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


@dataclass
class PageResult:
    page_number: int
    method: str
    text: str
    direct_chars: int
    ocr_chars: int


def slugify(value: str) -> str:
    transliterated = "".join(CYRILLIC_MAP.get(char.lower(), char) for char in value)
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = unicodedata.normalize("NFKD", transliterated).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    return slug or "document"


def normalize_text(text: str) -> str:
    text = fix_text(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_direct_text(page: fitz.Page) -> str:
    blocks = page.get_text("blocks")
    parts: list[str] = []
    for block in sorted(blocks, key=lambda item: (round(item[1], 1), round(item[0], 1))):
        text = normalize_text(block[4])
        if text:
            parts.append(text)
    return "\n\n".join(parts).strip()


def extract_ocr_text(page: fitz.Page, engine: RapidOCR, debug_image_path: Path) -> str:
    debug_image_path.parent.mkdir(parents=True, exist_ok=True)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(str(debug_image_path))
    result, _ = engine(str(debug_image_path))
    if not result:
        return ""
    lines = [item[1] for item in result if len(item) > 1 and item[1].strip()]
    return normalize_text("\n".join(lines))


def parse_pdf(pdf_path: Path, engine: RapidOCR) -> tuple[str, dict]:
    doc = fitz.open(str(pdf_path))
    page_results: list[PageResult] = []

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        direct_text = extract_direct_text(page)
        direct_chars = len(direct_text)
        ocr_text = ""
        method = "direct"
        final_text = direct_text

        if direct_chars < MIN_DIRECT_TEXT_CHARS:
            debug_image_path = ASSETS_DIR / f"{slugify(pdf_path.stem)}-page-{page_index + 1:03d}.png"
            ocr_text = extract_ocr_text(page, engine, debug_image_path)
            if len(ocr_text) > direct_chars:
                method = "ocr"
                final_text = ocr_text

        page_results.append(
            PageResult(
                page_number=page_index + 1,
                method=method,
                text=final_text,
                direct_chars=direct_chars,
                ocr_chars=len(ocr_text),
            )
        )

    title = pdf_path.stem
    direct_pages = sum(1 for page in page_results if page.method == "direct")
    ocr_pages = sum(1 for page in page_results if page.method == "ocr")
    total_chars = sum(len(page.text) for page in page_results)

    lines = [
        f"# {title}",
        "",
        "## Metadata",
        "",
        f"- Source PDF: `{pdf_path.name}`",
        f"- Total pages: {doc.page_count}",
        f"- Parsed pages (direct text): {direct_pages}",
        f"- Parsed pages (OCR fallback): {ocr_pages}",
        f"- Total extracted characters: {total_chars}",
        "",
        "## Notes",
        "",
        "- Output prepared for engineering reference and calculator development.",
        "- Pages with weak embedded text were re-parsed using OCR.",
        "",
    ]

    for page in page_results:
        lines.extend(
            [
                f"## Page {page.page_number}",
                "",
                f"_Method: {page.method}; direct chars: {page.direct_chars}; ocr chars: {page.ocr_chars}_",
                "",
                page.text or "_No text extracted from this page._",
                "",
            ]
        )

    md = "\n".join(lines).strip() + "\n"
    meta = {
        "source_pdf": pdf_path.name,
        "pages": doc.page_count,
        "direct_pages": direct_pages,
        "ocr_pages": ocr_pages,
        "total_extracted_characters": total_chars,
        "page_methods": [
            {
                "page": page.page_number,
                "method": page.method,
                "direct_chars": page.direct_chars,
                "ocr_chars": page.ocr_chars,
            }
            for page in page_results
        ],
    }
    return md, meta


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    engine = RapidOCR()
    index: list[dict] = []

    for pdf_path in sorted(PDF_DIR.glob("*.pdf")):
        md, meta = parse_pdf(pdf_path, engine)
        out_name = f"{slugify(pdf_path.stem)}.md"
        out_path = OUT_DIR / out_name
        out_path.write_text(md, encoding="utf-8")
        meta["output_markdown"] = out_path.name
        index.append(meta)
        print(f"parsed {pdf_path.name} -> {out_path.name}")

    index_path = OUT_DIR / "index.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
