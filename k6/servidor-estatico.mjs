/**
 * Servidor estático mínimo (sin dependencias) para servir un build (dist)
 * del experimento, con respaldo SPA: cualquier ruta sin extensión cae en
 * index.html. Sirve igual en Windows local y en ubuntu-latest de Actions.
 *
 * Uso: node k6/servidor-estatico.mjs <puerto> <directorio>
 * Ejemplo: node k6/servidor-estatico.mjs 4173 "$PWD/dist"
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] || '4173');
const root = path.resolve(process.argv[3] || '.');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(root, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`servidor estático ${root} en http://127.0.0.1:${port}`);
  });
