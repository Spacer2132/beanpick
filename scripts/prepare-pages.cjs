const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const docsDir = path.join(rootDir, 'docs');
const productsJsonPath = path.join(docsDir, 'products.json');
const docsIndexPath = path.join(docsDir, 'index.html');
const cloudflareAnalyticsSnippet = [
  '    <!-- Cloudflare Web Analytics -->',
  '    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "0c96780548534d8b96945c17c86e53af"}\'></script>',
  '    <!-- End Cloudflare Web Analytics -->',
].join('\n');

function copyDir(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('dist 폴더가 없습니다. 먼저 npm.cmd run build를 실행해주세요.');
  process.exit(1);
}

const savedProductsJson = fs.existsSync(productsJsonPath)
  ? fs.readFileSync(productsJsonPath)
  : null;

fs.rmSync(docsDir, { recursive: true, force: true });
copyDir(distDir, docsDir);

if (savedProductsJson) {
  fs.writeFileSync(productsJsonPath, savedProductsJson);
}

if (fs.existsSync(docsIndexPath)) {
  const html = fs.readFileSync(docsIndexPath, 'utf8');
  fs.writeFileSync(docsIndexPath, html.replace('  </head>', `${cloudflareAnalyticsSnippet}\n  </head>`));
}

console.log(`GitHub Pages 파일 준비 완료: ${docsDir}`);
