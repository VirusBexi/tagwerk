// Small static server for trying the built app locally: node tools/serve.mjs
// /__src/ serves the sources, so test code in the browser can load single modules.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../docs/', import.meta.url));
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fromSrc = pathname.startsWith('/__src/');
  const path = normalize(fromSrc ? pathname.slice('/__src/'.length) : pathname).replace(/^([/\\])+/, '');
  if (path.includes('..')) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const file = await readFile(join(fromSrc ? SRC : ROOT, path === '' || path === '.' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || TYPES['.html'], 'Cache-Control': 'no-store' });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end('Nicht gefunden');
  }
}).listen(PORT, () => console.log(`Tagwerk läuft auf http://localhost:${PORT}`));
