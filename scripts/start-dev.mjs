import net from 'node:net';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 3000);

function portIsAvailable() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', (error) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'EACCES') resolve(true);
      else reject(error);
    });
  });
}

if (!(await portIsAvailable())) {
  console.error(`Port ${port} is already in use. Stop the existing dev server before starting another one.`);
  process.exit(1);
}

const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => child.kill(signal));
}
