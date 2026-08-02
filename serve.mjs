// Zero-dependency static server for local play and development.
//
// A server is required rather than optional: index.html loads app.js as an ES
// module, and browsers refuse to load module scripts from a file:// page, so
// double-clicking index.html gives a blank screen.
//
//   node serve.mjs              serve on 8000 and open a browser
//   node serve.mjs 9000         serve on a specific port
//   node serve.mjs --no-open    don't launch a browser

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv.slice(2).find((arg) => /^\d+$/.test(arg))) || 8000;
const OPEN_BROWSER = !process.argv.includes('--no-open');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function resolveRequest(url) {
  const clean = decodeURIComponent(url.split('?')[0].split('#')[0]);
  const target = path.join(ROOT, clean === '/' ? 'index.html' : clean);
  // Refuse anything that climbs out of the project folder.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  const file = resolveRequest(req.url);

  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    // The word bank is fetched live; never let a stale build linger in class.
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

// The address other computers on the same network can reach.
function lanAddress() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];

  try {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* no browser to open — the printed URL still works */
  }
}

function announce(port) {
  const lan = lanAddress();
  console.log('');
  console.log('  Watchword is running.');
  console.log('');
  console.log(`    This computer   http://localhost:${port}`);
  if (lan) {
    console.log(`    Same network    http://${lan}:${port}`);
  }
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  if (OPEN_BROWSER) openBrowser(`http://localhost:${port}`);
}

// Announce from one standing listener that reads the port actually bound.
// Passing a callback to listen() instead would queue one per attempt, and a
// failed attempt's callback still fires once a later port succeeds — printing
// a URL nobody is serving.
server.on('listening', () => announce(server.address().port));

// Busy port usually means an old copy is still running — step to the next one.
function listen(port, attemptsLeft) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(`\n  Could not start the server: ${error.message}\n`);
    process.exit(1);
  });

  server.listen(port);
}

listen(PORT, 10);
