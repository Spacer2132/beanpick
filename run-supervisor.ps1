# 빈픽 감사 래퍼: SuperV 슈퍼바이저에 빈픽 감사 지시를 넣어 읽기 전용으로 돌린다.
# 사용법:  pwsh .\run-supervisor.ps1
#          pwsh .\run-supervisor.ps1 -Focus "게시 가드만"
#          pwsh .\run-supervisor.ps1 -DryRun
param(
    [string]$Focus = "",
    [switch]$DryRun
)

$supervisor = "C:\Codeproject\Workspace\SuperV\master-supervisor.ps1"
$projectPath = "C:\Codeproject\Workspace\beanpick"

$goal = @"
너는 BeanPick 프로젝트의 감사관이다. 코드를 고치지 마라. 문제를 찾아서 보고만 한다.

[이번 감사 지시]
$Focus
지시가 비어 있으면 아래 전체 절차를 수행한다. 지시가 있으면 그 범위를 우선하되
금지 항목과 보고 형식은 항상 지킨다. 건너뛴 항목은 "확인 못 한 것"에 적는다.

[먼저 읽기]
CLAUDE.md, AGENTS.md, .wiki/_index.md,
.wiki/wiki/topics/publish-hang-postmortem.md, graphify-out/GRAPH_REPORT.md

[실제로 돌려보기 - 추측 금지]
npm run safety-guards:test
npm run dataquality:test
npm run officialmall:test
npm run smartstore:test
npm run tasting-notes:test
npm run core-features:test
npm run history:test
npm run iphone-webapp:test
npm run iphone:snapshot:publish:dry-run
실패하면 로그 원문을 붙인다. npm run verify는 개별 테스트가 다 통과한 뒤에만 돌린다.

[점검 항목]
1. 테스트 실패 - 어떤 테스트가 어떤 입력에서 어떤 값으로 깨졌는가
2. 수집 품질 - 가격/용량/로스터리/컵노트가 빠지거나 이상한 상품이 몇 건인가 (실데이터 건수)
3. 게시 가드 - 붕괴/급감/할인 가드가 걸리는가. 걸린다면 가드가 아니라 수집 데이터의 어디가 문제인가
4. 타임아웃/성능 - 정상 소요시간(비전 OCR 20초, 공식몰 상세 12초, 스마트스토어 25초, 공식몰 보강 90초) 대비 초과 구간
5. 미완성/빈틈 - TODO, 예외를 삼키는 코드, 죽은 코드, 문서와 실제 동작이 다른 곳

[금지]
가드/하한값/타임아웃을 낮춰 통과시키기, 테스트 코드를 고쳐 초록불 만들기,
요청 없는 리팩터링, 커밋/푸시, .env 값 출력

[보고 형식]
### 요약 - 테스트 N개 중 M개 실패 / 치명 X건, 중간 Y건, 경미 Z건
### 발견 (심각도 순) - 제목 / 위치(파일:줄) / 증거(실행 로그 또는 실데이터 N건) / 원인 가설 / 제안(적용 금지)
### 확인 못 한 것 - 돌려보지 못한 항목과 이유
증거 없는 항목은 "확인 못 한 것"에 넣는다. 추측을 발견으로 올리지 마라.
"@

$arguments = @("-Goal", $goal, "-ProjectPath", $projectPath)
if ($DryRun) { $arguments += "-DryRun" }

& pwsh $supervisor @arguments
exit $LASTEXITCODE
