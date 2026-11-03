/**
 * RP-02 — Carga HTTP pura de los recursos pesados de la portada (k6).
 *
 * Escenario: RP02_VUS usuarios virtuales (por defecto 5) golpeando durante
 * RP02_DURATION (por defecto 30 s) cada uno de los tres recursos de la portada
 * (convocatorias / congresos / reconocimineto), ya sea como PNG (revisión ANTES)
 * o como WebP (revisión DESPUÉS). El servidor será el preview estático del
 * build (dist), con Cache-Control no-store para repetir la descarga real.
 *
 * Qué mide:
 *   - http_req_duration / http_reqs / http_req_failed (estándar de k6).
 *   - rp02_tiempo_respuesta : duración de la respuesta, con tag recurso.
 *   - rp02_bytes            : bytes del cuerpo, con tag recurso.
 *
 * Uso:
 *   RP02_URLS='convocatorias=http://127.0.0.1:4173/assets/convocatorias-XXX.png|...'
 *   RP02_VUS=5 RP02_DURATION=30s JSON_OUT=k6/salidas/rp02.json k6 run k6/rp02_recursos.js
 * (El valor de RP02_URLS lo genera `node k6/extraer_assets.mjs <dist> --env`.)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const tiempoRecurso = new Trend('rp02_tiempo_respuesta', false);
const bytesRecurso = new Trend('rp02_bytes', false);

export const options = {
  vus: Number(__ENV.RP02_VUS || 5),
  duration: __ENV.RP02_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};

/** Formato de RP02_URLS: 'recurso=url|recurso=url' (prueba distinta por revisión). */
const pares = String(__ENV.RP02_URLS || '')
  .split('|')
  .filter(Boolean)
  .map((par) => {
    const idx = par.indexOf('=');
    return { recurso: par.slice(0, idx) || 'recurso', url: par.slice(idx + 1) };
  });

export default function () {
  if (pares.length === 0) {
    throw new Error(
      'Define RP02_URLS (recurso=url|recurso=url). Generarlo con: node k6/extraer_assets.mjs <carpeta-dist> --env',
    );
  }
  for (const { recurso, url } of pares) {
    const res = http.get(url);
    check(res, {
      [`status 200 (${recurso})`]: (r) => r.status === 200,
      [`cuerpo con contenido (${recurso})`]: (r) => (r.body ? r.body.length : 0) > 0,
    });
    tiempoRecurso.add(res.timings.duration, { recurso });
    bytesRecurso.add(res.body ? res.body.length : 0, { recurso });
    sleep(0.2); // pausa mínima entre recursos de la misma iteración
  }
}

/** Resumen completo en JSON_OUT (todas las métricas, incluidas las series por tag). */
export function handleSummary(data) {
  const salidas = {};
  if (__ENV.JSON_OUT) {
    salidas[__ENV.JSON_OUT] = JSON.stringify(data, null, 2);
  }
  return salidas;
}
