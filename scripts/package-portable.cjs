const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const electronDistDir = path.join(rootDir, 'node_modules', 'electron', 'dist');
// 실행 파일은 프로젝트 안 app 폴더에 바로 만든다. (더블클릭하는 그 위치)
const baseOutputDir = path.resolve(rootDir, 'app');
let outputDir = baseOutputDir;
let appDir = path.join(outputDir, 'resources', 'app');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

// 원본 .env를 앱 폴더에 복사할 때, 원본에서 비어있는 값은 앱 쪽에 이미 있는 값을 보존한다.
// (예: GITHUB_TOKEN을 앱 폴더에서만 입력했는데, 패키징할 때 원본의 빈 값으로 덮어써서 사라지는 문제 방지)
function mergeEnvFiles(sourcePath, targetPath) {
  const sourceContent = fs.readFileSync(sourcePath, 'utf8');

  if (!fs.existsSync(targetPath)) {
    copyFile(sourcePath, targetPath);
    return;
  }

  const targetValues = {};
  fs.readFileSync(targetPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (value) targetValues[key] = value;
  });

  const merged = sourceContent.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) return line;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!value && targetValues[key]) return `${key}=${targetValues[key]}`;
    return line;
  }).join('\n');

  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, merged);
}

function copyDir(source, target) {
  ensureDir(target);
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter(sourcePath) {
      const relativePath = path.relative(source, sourcePath).replace(/\\/g, '/');
      if (!relativePath) return true;
      return ![
        '.git',
        'node_modules',
        'output',
      ].some((blocked) => relativePath === blocked || relativePath.startsWith(`${blocked}/`));
    },
  });
}

function copyElectronRuntime() {
  ensureDir(outputDir);

  fs.readdirSync(electronDistDir, { withFileTypes: true }).forEach((entry) => {
    const source = path.join(electronDistDir, entry.name);
    const targetName = entry.name === 'electron.exe' ? 'BeanPick.exe' : entry.name;
    const target = path.join(outputDir, targetName);

    if (entry.isDirectory()) {
      copyDir(source, target);
      return;
    }

    copyFile(source, target);
  });
}

function copyAppFiles() {
  ensureDir(appDir);

  [
    'dist',
    'electron',
    'src',
    'public',
  ].forEach((dirName) => {
    copyDir(path.join(rootDir, dirName), path.join(appDir, dirName));
  });

  [
    'package.json',
    'vite.config.js',
    'index.html',
  ].forEach((fileName) => {
    copyFile(path.join(rootDir, fileName), path.join(appDir, fileName));
  });

  ['.env', '.env.local'].forEach((fileName) => {
    const envPath = path.join(rootDir, fileName);
    if (fs.existsSync(envPath)) {
      mergeEnvFiles(envPath, path.join(outputDir, fileName));
    }
  });
}

function refreshOutputPaths(nextOutputDir) {
  outputDir = nextOutputDir;
  appDir = path.join(outputDir, 'resources', 'app');
}

function packagePortable() {
  copyElectronRuntime();
  copyAppFiles();
}

try {
  packagePortable();
} catch (error) {
  if (!['EBUSY', 'EPERM'].includes(error?.code)) throw error;

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  refreshOutputPaths(`${baseOutputDir}-${timestamp}`);
  packagePortable();
}

console.log(`BeanPick 실행 파일 생성 완료: ${path.join(outputDir, 'BeanPick.exe')}`);
