import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.webp':'image/webp', '.map':'application/json; charset=utf-8' };
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.includes('\0')) { res.writeHead(400); return res.end(); }
  const requested = resolve(root, '.' + pathname);
  if (requested !== root && !requested.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
  let file = requested;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = resolve(file, 'index.html');
    await stat(file);
  } catch {
    if (extname(pathname)) { res.writeHead(404); return res.end(); }
    file = resolve(root, 'index.html');
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':file.endsWith('.html')?'no-cache':'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log('Planner AI web listening on ' + port));
