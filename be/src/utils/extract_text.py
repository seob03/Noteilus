#!/usr/bin/env python3
import sys
import json
import fitz  # PyMuPDF


def extract_words(pdf_path: str):
    doc = fitz.open(pdf_path)
    pages = []
    for page_index in range(len(doc)):
        page = doc[page_index]
        rect = page.rect
        width = float(rect.width)
        height = float(rect.height)
        # dict 모드로 블록/라인/스팬 추출 (폰트/사이즈 포함)
        info = page.get_text("dict")
        spans = []
        span_idx = 0
        for block in info.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    # span: {text, size, font, bbox:[x0,y0,x1,y1], ...}
                    text = span.get("text", "")
                    bbox = span.get("bbox", [0, 0, 0, 0])
                    x0, y0, x1, y1 = bbox
                    spans.append({
                        "id": f"{page_index+1}-s{span_idx}",
                        "text": text,
                        "x0": x0, "y0": y0, "x1": x1, "y1": y1,
                        "fontSize": span.get("size", 0),
                        "font": span.get("font", ""),
                        "pageNumber": page_index + 1,
                        "pageWidth": width,
                        "pageHeight": height
                    })
                    span_idx += 1
        pages.append({
            "pageNumber": page_index + 1,
            "pageWidth": width,
            "pageHeight": height,
            "spans": spans
        })
    return pages


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: extract_text.py <pdf_path>"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    try:
        pages = extract_words(pdf_path)
        print(json.dumps({"pages": pages}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)


if __name__ == "__main__":
    main()


