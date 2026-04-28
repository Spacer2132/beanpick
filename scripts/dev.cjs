const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 5173;
const devUrl = `http://127.0.0.1:${port}`;

function waitForPort() {
  return new Promise((resolve) => {
    const check = () => {
      const socket = net.createConnection(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(check, 250);
      });
    };

    check();
  });
}

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronBin = require('electron');

const vite = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: 'inherit',
});

waitForPort().then(() => {
  const electron = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl,
    },
  });

  electron.on('exit', (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
});

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
