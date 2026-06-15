const fs = require('node:fs');
const esbuild = require('esbuild');

function loadJsModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const output = esbuild.transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' }).code;
  const module = { exports: {} };

  new Function('exports', 'module', 'require', output)(module.exports, module, () => ({}));
  return module.exports;
}

const publishedSnapshot = loadJsModule('src/services/publishedSnapshot.js');
const githubPublisher = require('../electron/githubPublisher.cjs');
const failures = [];

function expect(condition, message, details = '') {
  if (!condition) failures.push(`${message}${details ? `: ${details}` : ''}`);
}

async function main() {
  const products = [
    { id: 'bean-a', productName: '에티오피아 구지 워시드', price: 22000, tastingNotes: ['자스민'] },
    { id: 'bean-b', productName: '콜롬비아 시드라', price: 32000, tastingNotes: ['복숭아'] },
  ];

  const loaded = await publishedSnapshot.loadPublishedSnapshot(async (url) => ({
    ok: true,
    json: async () => ({ publishedAt: '2026-06-14T00:00:00.000Z', products }),
    url,
  }));
  expect(loaded?.products.length === 2, '웹 스냅샷은 products 배열을 읽어야 합니다', String(loaded?.products?.length));
  expect(loaded?.publishedAt === '2026-06-14T00:00:00.000Z', '웹 스냅샷 게시 시각을 보존해야 합니다', loaded?.publishedAt);

  const missing = await publishedSnapshot.loadPublishedSnapshot(async () => ({ ok: false, status: 404 }));
  expect(missing === null, 'products.json이 없으면 조용히 null을 돌려줘야 합니다');

  const invalid = await publishedSnapshot.loadPublishedSnapshot(async () => ({
    ok: true,
    json: async () => ({ publishedAt: '2026-06-14T00:00:00.000Z', products: 'not-array' }),
  }));
  expect(invalid === null, 'products가 배열이 아니면 스냅샷으로 쓰면 안 됩니다');
  expect(publishedSnapshot.getPublishButtonLabel({ status: 'idle' }) === '아이폰 게시', '대기 중 게시 버튼 문구가 맞아야 합니다');
  expect(publishedSnapshot.getPublishButtonLabel({ status: 'loading' }) === '게시 중', '게시 중 버튼 문구가 맞아야 합니다');
  expect(publishedSnapshot.getPublishButtonLabel({ status: 'success' }) === '게시 완료', '게시 성공 후 버튼 문구가 완료로 남아야 합니다');
  expect(publishedSnapshot.getPublishButtonLabel({ status: 'error' }) === '게시 실패', '게시 실패 후 버튼 문구가 실패로 남아야 합니다');

  const snapshot = githubPublisher.buildGithubSnapshot(products, '2026-06-14T01:02:03.000Z');
  expect(snapshot.count === 2, '게시 JSON에는 상품 개수가 들어가야 합니다', String(snapshot.count));
  expect(snapshot.products[0].id === 'bean-a', '게시 JSON에는 현재 상품 목록이 그대로 들어가야 합니다');

  const calls = [];
  const result = await githubPublisher.publishProductsToGitHub({
    products,
    token: 'ghp_test',
    owner: 'Spacer2132',
    repo: 'beanpick',
    branch: 'main',
    path: 'docs/products.json',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (!options.method) {
        return { ok: true, json: async () => ({ sha: 'old-sha' }) };
      }
      return { ok: true, json: async () => ({ content: { path: 'docs/products.json' }, commit: { sha: 'new-sha' } }) };
    },
    now: () => '2026-06-14T01:02:03.000Z',
  });

  expect(result.ok === true, 'GitHub 게시 성공 결과를 돌려줘야 합니다', JSON.stringify(result));
  expect(calls.length === 2, 'GitHub Contents API는 sha 확인 GET 후 PUT을 호출해야 합니다', String(calls.length));
  expect(calls[0].url.includes('/repos/Spacer2132/beanpick/contents/docs/products.json'), 'GET 주소는 docs/products.json을 가리켜야 합니다', calls[0].url);
  expect(calls[1].options.method === 'PUT', '두 번째 호출은 PUT이어야 합니다', calls[1].options.method);
  expect(calls[1].options.headers.Authorization === 'Bearer ghp_test', '토큰은 Authorization 헤더로 보내야 합니다');

  const putBody = JSON.parse(calls[1].options.body);
  const decoded = JSON.parse(Buffer.from(putBody.content, 'base64').toString('utf8'));
  expect(putBody.sha === 'old-sha', '기존 파일이 있으면 sha를 넣어 갱신해야 합니다', putBody.sha);
  expect(decoded.products.length === 2 && decoded.count === 2, 'PUT 본문에는 base64 JSON 스냅샷이 들어가야 합니다', JSON.stringify(decoded));

  const noToken = await githubPublisher.publishProductsToGitHub({
    products,
    token: '',
    fetchImpl: async () => {
      throw new Error('호출되면 안 됨');
    },
  });
  expect(noToken.ok === false && /GITHUB_TOKEN=/.test(noToken.error), '토큰이 없으면 GitHub를 호출하지 않고 안내해야 합니다', JSON.stringify(noToken));

  const appSource = fs.readFileSync('src/App.jsx', 'utf8');
  expect(
    /bean-price-unit-value/.test(appSource) && /bean-price-unit-suffix/.test(appSource),
    '카드 단가는 가격과 100g 단위를 나눠서 렌더링해야 합니다',
  );

  if (failures.length > 0) {
    console.error('[iphone-webapp:test] 실패');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }

  console.log('[iphone-webapp:test] 통과: 웹 스냅샷 읽기와 GitHub 게시 요청 확인 완료');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
