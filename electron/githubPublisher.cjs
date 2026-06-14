const DEFAULT_OWNER = 'Spacer2132';
const DEFAULT_REPO = 'beanpick';
const DEFAULT_BRANCH = 'main';
const DEFAULT_PATH = 'docs/products.json';

function buildGithubSnapshot(products, publishedAt = new Date().toISOString()) {
  const safeProducts = Array.isArray(products) ? products : [];

  return {
    publishedAt,
    count: safeProducts.length,
    products: safeProducts,
  };
}

function githubContentsUrl({ owner = DEFAULT_OWNER, repo = DEFAULT_REPO, path = DEFAULT_PATH, branch = DEFAULT_BRANCH } = {}) {
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'BeanPick',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function readExistingSha({ fetchImpl, token, owner, repo, path, branch }) {
  const response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
    headers: githubHeaders(token),
  });

  if (response.ok) {
    const json = await response.json();
    return json?.sha || '';
  }

  if (response.status === 404) return '';

  const message = await response.text().catch(() => '');
  throw new Error(message || `GitHub 파일 확인 실패 (${response.status})`);
}

async function publishProductsToGitHub({
  products,
  token = process.env.GITHUB_TOKEN || '',
  owner = DEFAULT_OWNER,
  repo = DEFAULT_REPO,
  path = DEFAULT_PATH,
  branch = DEFAULT_BRANCH,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
} = {}) {
  if (!token) {
    return { ok: false, error: 'GitHub 토큰이 없습니다. .env 파일의 GITHUB_TOKEN= 뒤에 토큰을 붙여넣고 앱을 다시 실행해주세요.' };
  }

  try {
    const snapshot = buildGithubSnapshot(products, now());
    const sha = await readExistingSha({ fetchImpl, token, owner, repo, path, branch });
    const body = {
      message: `Update BeanPick iPhone snapshot (${snapshot.count} products)`,
      content: Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64'),
      branch,
    };

    if (sha) body.sha = sha;

    const response = await fetchImpl(githubContentsUrl({ owner, repo, path, branch }), {
      method: 'PUT',
      headers: githubHeaders(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `GitHub 게시 실패 (${response.status})`);
    }

    const json = await response.json();
    return {
      ok: true,
      count: snapshot.count,
      publishedAt: snapshot.publishedAt,
      path: json?.content?.path || path,
      commitSha: json?.commit?.sha || '',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'GitHub 게시 중 알 수 없는 오류가 발생했습니다.',
    };
  }
}

module.exports = {
  buildGithubSnapshot,
  publishProductsToGitHub,
};
