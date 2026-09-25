# FIX-3 설계 — 상세 이미지 OCR에 로스팅 추출 추가 (구현 금지, 설계만)

## 배경
- roast 재현율 6.8% (5/73, `audit/tools/regen-reports.py`). golden에 HIGH/MEDIUM roast 값이 있는데도 앱이 "확인 필요"로 두는 경우가 대부분.
- 원인 분포 (answer-12q.py): roast match=False 135건 중 NOT_IMPLEMENTED 75, PARSER_MISS 23, FALSE_POSITIVE 13, FIELD_MAPPING_ERROR 4.
- 상세 이미지 안에 로스팅 표기(예: "미디엄로스트", "Medium-Dark")가 있지만 텍스트 OCR에는 없는 경우가 있어, Gemini OCR 단계에서 로스팅을 함께 추출하면 복구 가능.

## 현재 프롬프트 (electron/naverShoppingSearch.cjs:948-950, 수정 금지 — 설계안만 제시)
- `GEMINI_NOTE_PROMPT`: 노트 영역의 표현만 원문 그대로, JSON 배열.
- `GEMINI_NOTE_PROMPT_VERSION = 'source-notes-v4'`, `GEMINI_MODEL = 'gemini-3.1-flash-lite'`.
- `GEMINI_EVIDENCE_PROMPT`: 위 + `{text, group, process, scope}` 객체 배열. process는 이미지 전체에서 가공 방식 전사.
- 타임아웃: Gemini 20000ms (1031행), Tesseract 25000ms (1396행) — 변경 금지.

## 변경안 (프롬프트)
`GEMINI_EVIDENCE_PROMPT`의 객체 스키마에 `"roast": "이미지에 명시된 로스팅(배전) 표기 원문 또는 빈 문자열"` 필드 추가. 규칙:
- 노트 영역이든 상품명/제목이든 이미지 전체에서 "로스팅/배전" 관련 표기만 전사. 예: 미디엄로스트, Medium-Dark, 중강배전, 강배전, Light.
- 추측 금지 (process 필드와 동일 원칙). 없으면 빈 문자열.
- `GEMINI_NOTE_PROMPT`(문자열 배열 버전)는 그대로 둔다 — roast는 evidence 객체에만.

## 캐시 버전 영향
- OCR 캐시 키에 prompt version(`source-notes-v4`) + model이 포함되므로, 프롬프트 변경 시 버전 상향(`source-notes-v5`) 필요.
- 재OCR 대상: golden 454건 중 gemini/OCR 근거 상품 202건 (산출 스크립트 인라인 집계). 전체 상품 기준으로는 detailImageUrls 보유 상품 전체가 대상.
- 기존 `source-notes-v4` 캐시는 보존되므로 롤백 가능.

## Gemini 호출 증가량 추정
- 호출 횟수 증가 없음 (동일 이미지 1회 호출에 필드 1개 추가). 토큰 증가: 출력에 roast 필드 추가로 항목당 ~10-20 토큰.
- 단, 캐시 버전 상향으로 202건(골든 기준)의 재OCR 1회성 호출 발생. 타임아웃 변경 없음 (20000ms 유지).

## 검증 계획 (구현 시)
1. 프롬프트 변경 후 `source-notes-v5`로 202건의 재OCR을 별도 캐시에 저장 (기존 캐시 보존).
2. roast 추출 성공률 측정: golden roast HIGH/MEDIUM 73건 중 OCR roast로 복구되는 건수.
3. `npm run audit:data -- <재발행 products.json> --before docs/products.json` 로 "맞다가 틀려진 값" 0건 확인.
4. 오추출(false positive) 샘플 수동 점검 20건: 이미지 내 "로스팅"과 무관한 텍스트(예: "로스팅 날짜")를 roast로 오인하지 않는지.

## 위험
- 이미지 속 "로스팅 일자", "로스팅 후 3일" 같은 문구를 배전도로 오인할 수 있음 → 프롬프트에 "날짜·기간 제외" 명시 필요.
- UNMAPPED_LABEL 6건('중강배전'/'중약배전')은 OCR 추출과 별개로 roastLevel 매핑 테이블 문제 — 함께 처리 시 매핑 추가 필요.
