/**
 * Inventario de los recursos pesados de la portada dentro de un build (dist).
 *
 * Uso:
 *   node k6/extraer_assets.mjs <carpeta-dist>          -> JSON completo + k6/urls.json
 *   node k6/extraer_assets.mjs <carpeta-dist> --env    -> solo la línea RP02_URLS=...
 *
 * Variables:
 *   BASE_URL  (default http://127.0.0.1:4173) -> prefijo de las URLs generadas.
 *   URLS_OUT  (default k6/urls.json)          -> ruta del JSON de inventario.
 *
 * Nota conservadora: el nombre "reconocimineto" (con esa falta ortográfica) es
 * el real del archivo en el proyecto y DEBE mantenerse para que la búsqueda
 * coincida; acepta .png y .webp para servir a ambas revisiones.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');

const distArg = process.argv[2] ?? process.env.DIST ?? path.join(raiz, 'dist');
const dist = path.resolve(distArg);
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const URLS_OUT = path.resolve(process.env.URLS_OUT || path.join(aqui, 'urls.json'));

const NOMBRES = ['convocatorias', 'congresos', 'reconocimineto'];
const carpetaAssets = path.join(dist, 'assets');

if (!fs.existsSync(carpetaAssets)) {
  console.error(`No existe la carpeta de assets: ${carpetaAssets}`);
  process.exit(1);
}

const archivos = fs.readdirSync(carpetaAssets);
const recursos = [];
for (const nombre of NOMBRES) {
  const archivo = archivos.find(
    (f) => f.startsWith(nombre) && /\.(png|webp)$/i.test(f),
  );
  if (!archivo) {
    console.error(`Falta el recurso "${nombre}" en ${carpetaAssets}`);
    process.exit(1);
  }
  const bytes = fs.statSync(path.join(carpetaAssets, archivo)).size;
  recursos.push({
    recurso: nombre,
    archivo,
    bytes,
    url: `${BASE_URL}/assets/${archivo}`,
  });
}

const inventario = {
  generado: new Date().toISOString(),
  base_url: BASE_URL,
  dist,
  total_bytes: recursos.reduce((a, r) => a + r.bytes, 0),
  recursos,
};

const valor = recursos.map((r) => `${r.recurso}=${r.url}`).join('|');

if (!process.argv.includes('--env')) {
  fs.writeFileSync(URLS_OUT, JSON.stringify(inventario, null, 2));
  console.log(JSON.stringify(inventario, null, 2));
  console.log(`Inventario escrito en ${URLS_OUT}`);
  console.log('RP02_URLS=' + valor);
} else {
  // Modo --env: imprime SOLO el valor (sin el prefijo), listo para `export RP02_URLS="$(...)"`
  console.log(valor);
}
