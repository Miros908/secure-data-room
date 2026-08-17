const { spawn, execFileSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const apiPort = Number(process.env.PORT || '4010');
const webPort = Number(process.env.E2E_WEB_PORT || '3100');
const frontendRoot = path.join(__dirname, '..');
const backendRoot = path.join(__dirname, '../../nestjs-backend');

const children = [];
let stopping = false;

function spawnInherit(command, args, cwd, extraEnv) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (stopping || signal) {
      return;
    }
    if (code) {
      stop(code);
    }
  });
  return child;
}

function pidsOnPort(port) {
  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    /* already gone */
  }
}

function killPort(port) {
  for (const pid of pidsOnPort(port)) {
    killPid(pid, 'SIGTERM');
  }
}

function stop(code) {
  if (stopping) {
    return;
  }
  stopping = true;

  for (const child of children) {
    if (child.pid) {
      killPid(child.pid, 'SIGTERM');
    }
  }
  killPort(apiPort);
  killPort(webPort);

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const leftover = [...new Set([...pidsOnPort(apiPort), ...pidsOnPort(webPort)])];
    if (leftover.length === 0) {
      break;
    }
    for (const pid of leftover) {
      killPid(pid, 'SIGKILL');
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }

  process.exit(code);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(0));
}

(async () => {
  await assertPortFree(apiPort, 'API');
  await assertPortFree(webPort, 'web');

  spawnInherit('pnpm', ['start'], backendRoot, { NODE_ENV: 'test' });
  await waitForHttp(apiPort, '/auth/me');
  process.stderr.write(`API ready on ${apiPort}\n`);

  spawnInherit(
    'pnpm',
    ['exec', 'next', 'dev', '--port', String(webPort)],
    frontendRoot,
    {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-e2e',
    },
  );
  await waitForHttp(webPort, '/login');
  process.stderr.write(`Web ready on ${webPort}\n`);
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  stop(1);
});

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/', timeout: 400 },
      (response) => {
        response.resume();
        reject(
          new Error(
            `Port ${port} (${label}) is already in use. Stop the leftover Playwright stack and retry: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
          ),
        );
      },
    );
    req.on('error', () => resolve());
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
  });
}

function waitForHttp(port, requestPath) {
  const deadline = Date.now() + 120_000;

  return new Promise((resolve, reject) => {
    const tick = () => {
      if (stopping) {
        reject(new Error('Stack is stopping'));
        return;
      }

      const req = http.get(
        {
          host: '127.0.0.1',
          port,
          path: requestPath,
          timeout: 800,
        },
        (response) => {
          response.resume();
          resolve();
        },
      );
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Nothing accepted HTTP on ${port}${requestPath}`));
          return;
        }
        setTimeout(tick, 300);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Nothing accepted HTTP on ${port}${requestPath}`));
          return;
        }
        setTimeout(tick, 300);
      });
    };
    tick();
  });
}
