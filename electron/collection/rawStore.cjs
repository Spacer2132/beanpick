// 수집 엔진 교체 4단계: 해석하기 전의 원문을 따로 보관한다.
// 같은 원문을 다시 받지 않고 재해석할 수 있게 하는 것이 목적이다.
// 같은 판매처에서 같은 내용을 다시 만나면 같은 관측 ID가 되어 파일이 하나만 쌓인다.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { createRawObservation } = require('./contract.cjs');

const DEFAULT_MAX_AGE_DAYS = 7;
const DEFAULT_MAX_TOTAL_BYTES = 200 * 1024 * 1024;

function getRawStoreDir() {
  const env = process.env;
  if (env.BEANPICK_RAW_OBSERVATION_DIR) return env.BEANPICK_RAW_OBSERVATION_DIR;
  const base = env.LOCALAPPDATA || env.XDG_CACHE_HOME || (env.HOME ? path.join(env.HOME, '.cache') : '');
  return base ? path.join(base, 'BeanPick', 'raw-observations') : path.join(require('node:os').tmpdir(), 'beanpick-raw-observations');
}

function toFileName(observationId) {
  return String(observationId).replace(/[^a-z0-9]+/gi, '-');
}

function bodyPath(dir, observationId) {
  return path.join(dir, `${toFileName(observationId)}.body.gz`);
}

function metaPath(dir, observationId) {
  return path.join(dir, `${toFileName(observationId)}.meta.json`);
}

function readMeta(dir, observationId) {
  try {
    return JSON.parse(fs.readFileSync(metaPath(dir, observationId), 'utf8'));
  } catch {
    return null;
  }
}

// 원문을 저장한다. 같은 내용을 다시 만나면 본문은 다시 쓰지 않고 마지막 관측 시각만 갱신한다.
function putRawObservation({ channelId, url, body, contentType = 'text/html', fetchedAt = new Date().toISOString(), extractorVersion = '' }) {
  const observation = createRawObservation({ channelId, url, body, contentType, fetchedAt });
  const dir = getRawStoreDir();
  fs.mkdirSync(dir, { recursive: true });

  const previous = readMeta(dir, observation.observationId);
  const target = bodyPath(dir, observation.observationId);
  let reused = true;

  // 이전 실행이 쓰다가 죽으면 잘린 본문이 남는다. 그런 파일은 다시 쓴다.
  let usable = false;
  try {
    usable = fs.statSync(target).size > 0;
  } catch {
    usable = false;
  }

  if (!previous || !usable) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
    // 임시 파일에 쓰고 이름을 바꿔야 중간에 죽어도 잘린 본문이 남지 않는다.
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, zlib.gzipSync(buffer));
    fs.renameSync(temporary, target);
    reused = false;
  }

  const urls = new Set([...(previous?.urls || []), url]);
  const meta = {
    ...observation,
    firstSeenAt: previous?.firstSeenAt || fetchedAt,
    lastSeenAt: fetchedAt,
    seenCount: Number(previous?.seenCount || 0) + 1,
    urls: [...urls],
    extractorVersion: extractorVersion || previous?.extractorVersion || '',
    storedBytes: fs.statSync(target).size,
  };
  fs.writeFileSync(metaPath(dir, observation.observationId), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return { ...meta, reused };
}

function readRawObservation(observationId) {
  const dir = getRawStoreDir();
  const meta = readMeta(dir, observationId);
  if (!meta) return null;
  try {
    return { meta, body: zlib.gunzipSync(fs.readFileSync(bodyPath(dir, observationId))).toString('utf8') };
  } catch {
    return null;
  }
}

function listRawObservations() {
  const dir = getRawStoreDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.meta.json'))
    .map((name) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// 오래되거나 총량을 넘긴 원문부터 지운다. 최근 것을 남긴다.
function pruneRawObservations({ maxAgeDays = DEFAULT_MAX_AGE_DAYS, maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES, now = Date.now() } = {}) {
  const dir = getRawStoreDir();
  const entries = listRawObservations().sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  let keptBytes = 0;
  let removed = 0;

  for (const entry of entries) {
    const seenMs = Date.parse(entry.lastSeenAt || '') || 0;
    const tooOld = seenMs > 0 && seenMs < cutoff;
    const overBudget = keptBytes + Number(entry.storedBytes || 0) > maxTotalBytes;

    if (tooOld || overBudget) {
      try {
        fs.rmSync(bodyPath(dir, entry.observationId), { force: true });
        fs.rmSync(metaPath(dir, entry.observationId), { force: true });
        removed += 1;
      } catch {
        // 지우지 못한 파일은 다음 실행에서 다시 시도한다.
      }
      continue;
    }
    keptBytes += Number(entry.storedBytes || 0);
  }

  return { removed, kept: entries.length - removed, keptBytes };
}

module.exports = {
  getRawStoreDir,
  putRawObservation,
  readRawObservation,
  listRawObservations,
  pruneRawObservations,
};
