// 수집 엔진 교체 6단계: 실행 기록 관리자.
// 판매처마다 무엇이 성공·부분·실패였고 얼마나 걸렸는지를 기계가 읽을 수 있게 남긴다.
// 자동게시 로그는 한글이 깨져 사후 분석에 쓰기 어렵다. 이 기록이 7단계 비교의 근거가 된다.
//
// 격리·타임아웃·시간 예산은 이미 수집기와 화면 쪽에 실측으로 정해져 있다.
// 여기서 다시 만들지 않는다. 이 관리자는 기록만 하고 수집 동작을 바꾸지 않는다.
const fs = require('node:fs');
const path = require('node:path');

const { COMPLETENESS, createCollectionRun } = require('./contract.cjs');
const { getChannelId } = require('./registry.cjs');

const MAX_KEPT_RUNS = 50;

let currentRun = null;
let currentRunFile = '';
const sourceRecords = [];

function getRunDir() {
  const env = process.env;
  if (env.BEANPICK_COLLECTION_RUN_DIR) return env.BEANPICK_COLLECTION_RUN_DIR;
  const base = env.LOCALAPPDATA || env.XDG_CACHE_HOME || (env.HOME ? path.join(env.HOME, '.cache') : '');
  return base ? path.join(base, 'BeanPick', 'collection-runs') : path.join(require('node:os').tmpdir(), 'beanpick-collection-runs');
}

function beginRun() {
  if (currentRun) return currentRun;
  const startedAt = new Date().toISOString();
  currentRun = createCollectionRun({ runId: `run:${startedAt}`, startedAt });
  currentRunFile = path.join(getRunDir(), `run-${startedAt.replace(/[:.]/g, '-')}.json`);
  sourceRecords.length = 0;
  return currentRun;
}

// 수집 결과에서 상태를 읽는다.
// 경고가 붙었거나 핵심 결과가 비어 있으면 완전 수집으로 보지 않는다.
// 실패 경로가 형식만 성공으로 돌아오는 판매처가 있어서다(테라로사 API 폴백).
function classifyResult(result) {
  if (!result) return COMPLETENESS.FAILED;
  if (result.ok === false) return COMPLETENESS.FAILED;
  if (result.listCompleteness) return result.listCompleteness;

  const core = Array.isArray(result.products) ? result.products
    : Array.isArray(result.apiRows) ? result.apiRows
      : Array.isArray(result.pages) ? result.pages : null;
  const warned = Boolean(result.warning);

  if (core === null) return warned ? COMPLETENESS.PARTIAL : COMPLETENESS.COMPLETE;
  if (core.length === 0) return warned ? COMPLETENESS.FAILED : COMPLETENESS.EMPTY;
  return warned ? COMPLETENESS.PARTIAL : COMPLETENESS.COMPLETE;
}

// 판매처마다 돌려주는 단위가 다르다. 상품 수와 페이지 수를 같은 칸에 섞으면 나중에 잘못 읽는다.
function measureResult(result) {
  if (Array.isArray(result?.products)) return { itemCount: result.products.length, unit: 'products' };
  if (Array.isArray(result?.apiRows)) return { itemCount: result.apiRows.length, unit: 'rows' };
  if (Array.isArray(result?.pages)) return { itemCount: result.pages.length, unit: 'pages' };
  return { itemCount: 0, unit: 'none' };
}

function persist() {
  if (!currentRun) return;
  try {
    fs.mkdirSync(getRunDir(), { recursive: true });
    const finished = currentRun.finish();
    fs.writeFileSync(currentRunFile, `${JSON.stringify({ ...finished, sources: sourceRecords }, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn('[beanpick:run-manager] 실행 기록 저장 실패:', error?.message || error);
  }
}

// 오래된 기록부터 지운다. 최근 것만 남긴다.
function pruneRuns(maxKept = MAX_KEPT_RUNS) {
  const dir = getRunDir();
  if (!fs.existsSync(dir)) return 0;
  const files = fs.readdirSync(dir).filter((name) => name.startsWith('run-') && name.endsWith('.json')).sort();
  let removed = 0;
  for (const name of files.slice(0, Math.max(0, files.length - maxKept))) {
    try {
      fs.rmSync(path.join(dir, name), { force: true });
      removed += 1;
    } catch {
      // 지우지 못한 기록은 다음 실행에서 다시 시도한다.
    }
  }
  return removed;
}

// 판매처 한 곳의 수집을 감싸 기록한다. 수집 동작과 오류 전달 방식은 그대로 둔다.
async function runSource(sourceId, collect) {
  const run = beginRun();
  const channelId = getChannelId(sourceId);
  const startedMs = Date.now();
  run.beginSource(channelId);

  try {
    const result = await collect();
    const status = classifyResult(result);
    const measured = measureResult(result);
    run.endSource(channelId, { status, itemCount: measured.itemCount });
    sourceRecords.push({
      channelId,
      sourceId,
      status,
      ...measured,
      elapsedMs: Date.now() - startedMs,
      error: null,
      startedAt: new Date(startedMs).toISOString(),
    });
    persist();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '알 수 없는 오류');
    run.endSource(channelId, { status: COMPLETENESS.FAILED, itemCount: 0, error: message });
    sourceRecords.push({
      channelId,
      sourceId,
      status: COMPLETENESS.FAILED,
      itemCount: 0,
      unit: 'none',
      elapsedMs: Date.now() - startedMs,
      error: message,
      startedAt: new Date(startedMs).toISOString(),
    });
    persist();
    // 한 판매처의 실패가 다른 판매처로 번지지 않도록, 오류는 원래 부르던 쪽으로 그대로 돌려보낸다.
    throw error;
  }
}

function getCurrentRunRecord() {
  if (!currentRun) return null;
  return { ...currentRun.finish(), sources: [...sourceRecords] };
}

function listRuns() {
  const dir = getRunDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.startsWith('run-') && name.endsWith('.json'))
    .sort()
    .map((name) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// 테스트가 실행 사이에 상태를 비울 수 있게 한다.
function resetForTest() {
  currentRun = null;
  currentRunFile = '';
  sourceRecords.length = 0;
}

module.exports = {
  getRunDir,
  runSource,
  getCurrentRunRecord,
  listRuns,
  pruneRuns,
  resetForTest,
};
