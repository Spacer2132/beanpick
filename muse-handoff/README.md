# Muse 감사 작업 넘기기 — 사용 순서

## 1. 로컬 PC에서 원문 묶음 만들기 (5분)

앱으로 수집을 한 번 돌린 **직후**에 실행한다. 원문 저장소는 7일이 지나면 자동으로 지워진다.

```powershell
cd <beanpick 폴더>
node muse-handoff/export-audit-evidence.cjs
```

- `audit-input/` 폴더가 생긴다 (`manifest.json` + 상품별 `products/<id>.json`)
- 네트워크 접속 없음, `.env` 읽지 않음. 읽는 곳:
  - `%LOCALAPPDATA%\BeanPick\smartstore-detail-cache`
  - `%LOCALAPPDATA%\BeanPick\raw-observations`
  - `%LOCALAPPDATA%\BeanPick\ocr-cache` 와 저장소 `.ocr-cache`
- 출력 마지막의 **커버리지** 줄을 확인하라. `noEvidenceBeyondSnapshot`이 절반을 넘으면 경고가 뜬다 → 수집을 돌리고 다시 실행.

## 2. 넘기기 전 점검

- [ ] `audit-input/manifest.json`의 `redactions` 수 확인, 상품 파일 2~3개를 열어 토큰·쿠키 같은 게 없는지 눈으로 확인
- [ ] (선택) `.wiki/wiki/topics/publish-hang-postmortem.md`, `.wiki/raw/notes/agent-working-standards.md`를 `audit-input/wiki/`에 복사
- [ ] Muse 약관에서 무료 토큰이 데이터 공유(contributor) 조건인지 확인

## 3. Muse에 넣기

- 별도 브랜치(예: `audit/golden-dataset`)를 만들고 `audit-input/`을 그 브랜치에만 올리거나 업로드로 첨부
  (`audit-input/`은 main에 커밋하지 않는 것을 권장 — 상세 페이지 원문 수 MB)
- 지시문: `muse-handoff/MUSE-TASK.md` 전체를 붙여넣기
- Muse는 **Phase 0 후 멈춘다.** `audit/PHASE-0-REPORT.md`의 증거 커버리지 표를 보고
  - 판정 가능 상품이 충분하면 → "Phase 1 진행" 승인
  - 부족하면 → 요청한 추가 자료를 로컬에서 뽑아 준 뒤 승인

## 4. 결과 받은 뒤

- `npm run audit:data` 가 로컬에서 도는지 확인
- `recommended-fixes.md`의 수정은 Muse가 아니라 로컬(또는 Claude Code)에서 한 건씩 적용하고,
  `npm run audit:data -- --before <이전 products.json>` 으로 사라진 값이 없는지 본 뒤 실제 발행으로 검증
