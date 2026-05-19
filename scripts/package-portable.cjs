const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const electronDistDir = path.join(rootDir, 'node_modules', 'electron', 'dist');
const baseOutputDir = path.resolve(rootDir, '..', 'output', 'BeanPick-win32-x64');
let outputDir = baseOutputDir;
let appDir = path.join(outputDir, 'resources', 'app');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(source, target) {
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
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
      copyFile(envPath, path.join(outputDir, fileName));
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
