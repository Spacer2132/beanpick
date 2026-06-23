# PaddleOCR 설치 명령:
# python -m pip install --upgrade pip
# python -m pip install paddlepaddle
# python -m pip install paddleocr

import argparse
import contextlib
import io
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def collect_texts(result):
    texts = []
    for page in result or []:
        getter = page.get if hasattr(page, "get") else None
        if not getter:
            continue

        rec_texts = getter("rec_texts") or []
        rec_scores = getter("rec_scores") or []
        for index, text in enumerate(rec_texts):
            value = str(text or "").strip()
            score = rec_scores[index] if index < len(rec_scores) else 1
            if value and score > 0:
                texts.append(value)
    return texts


def main():
    parser = argparse.ArgumentParser(description="Run PaddleOCR for one image.")
    parser.add_argument("image_path")
    parser.add_argument("--lang", default="korean")
    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        return 1

    os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")

    try:
        # PaddleOCR가 모델 로딩 로그를 stdout으로 섞어 내보내서 최종 텍스트만 분리한다.
        with contextlib.redirect_stdout(io.StringIO()):
            from paddleocr import PaddleOCR

            ocr = PaddleOCR(
                lang=args.lang,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
            result = ocr.predict(args.image_path)
        sys.stdout.write("\n".join(collect_texts(result)))
        return 0
    except Exception:
        return 1


if __name__ == "__main__":
    sys.exit(main())
