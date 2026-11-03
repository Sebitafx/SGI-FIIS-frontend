/**
 * RP-02 (v2) — Carga HTTP pura de los recursos pesados de la portada (k6).
 *
 * Escenario: RP02_VUS usuarios virtuales (por defecto 5) golpeando durante
 * RP02_DURATION (por defecto 30 s) cada uno de los tres recursos de la portada
 * (convocatorias / congresos / reconocimineto), ya sea como PNG (revisión ANTES)
 * o como WebP (revisión DESPUÉS). El servidor será el preview estático del
 * build (dist), con Cache-Control no-store para repetir la descarga real.
 *
 * Cambios respecto a v1 (lecciones aprendidas con k6 v2.3.0):
 *   1. k6 v2 NO expone subseries por tag de un Trend en data.metrics (JSON de
 *      handleSummary), por eso cada recurso tiene su propio trend NOMBRADO:
 *      rp02_convocatorias_ms / rp02_congresos_ms / rp02_reconocimineto_ms y
 *      rp02_<recurso>_bytes. Así el JSON queda legible y el workflow puede
 *      publicar un resumen por recurso con jq sin complicaciones.
 *   2. Se pide responseType: 'binary' para que los bytes del cuerpo se midan
 *      exactos (la v1 decodificaba el binario como texto UTF-8 y quedaba
 *      ~3,5 % por debajo del tamaño real en disco).
 *
 * Uso:
 *   RP02_URLS='convocatorias=http://127.0.0.1:4173/assets/convocatorias-XXX.png|...'
 *   RP02_VUS=5 RP02_DURATION=30s JSON_OUT=k6/salidas/rp02.json \
 *   RESUMEN_OUT=k6/salidas/rp02-resumen.json k6 run k6/rp02_recursos.js
 * (El valor de RP02_URLS lo genera `node k6/extraer_assets.mjs <dist> --env`.)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

/** Recursos adversados del experimento (los genera extraer_assets.mjs). */
const RECURSOS = ['convocatorias', 'congresos', 'reconocimineto'];

/** Un trend por recurso y magnitud: quedarán con nombre propio en el JSON. */
const trendMs = {};
const trendBytes = {};
for (const r of RECURSOS) {
  trendMs[r] = new Trend(`rp02_${r}_ms`);
  trendBytes[r] = new Trend(`rp02_${r}_bytes`);
}

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
    return { recurso: par.slice(0, idx), url: par.slice(idx + 1) };
  });

for (const { recurso } of pares) {
  if (!RECURSOS.includes(recurso)) {
    throw new Error(`Recurso "${recurso}" desconocido. Esperaba: ${RECURSOS.join(', ')}`);
  }
}

export default function () {
  if (pares.length === 0) {
    throw new Error(
      'Define RP02_URLS (recurso=url|recurso=url). Generarlo con: node k6/extraer_assets.mjs <carpeta-dist> --env',
    );
  }
  for (const { recurso, url } of pares) {
    const res = http.get(url, { responseType: 'binary' });
    const bytes = res.body instanceof ArrayBuffer ? res.body.byteLength : 0;
    check(res, {
      [`status 200 (${recurso})`]: (r) => r.status === 200,
      [`cuerpo binario con contenido (${recurso})`]: () => bytes > 0,
    });
    trendMs[recurso].add(res.timings.duration);
    trendBytes[recurso].add(bytes);
    sleep(0.5); // pausa entre recursos de la misma iteración
  }
}

/** Resumen: JSON completo de k6 + un resumen compacto por recurso para el informe. */
export function handleSummary(data) {
  const compacto = {
    meta: {
      vu: __ENV.RP02_VUS || null,
      duracion: __ENV.RP02_DURATION || null,
      revision: __ENV.RP02_ETIQUETA || null,
    },
    recursos: {},
  };
  for (const r of RECURSOS) {
    const ms = data.metrics[`rp02_${r}_ms`];
    const by = data.metrics[`rp02_${r}_bytes`];
    compacto.recursos[r] = {
      peticiones: ms ? ms.values.count : 0,
      mediana_ms: ms ? Math.round(ms.values.med * 100) / 100 : null,
      promedio_ms: ms ? Math.round(ms.values.avg * 100) / 100 : null,
      p95_ms: ms ? Math.round(ms.values['p(95)'] * 100) / 100 : null,
      max_ms: ms ? Math.round(ms.values.max * 100) / 100 : null,
      bytes_mediana: by ? by.values.med : null,
      bytes_promedio: by ? Math.round(by.values.avg) : null,
    };
  }
  compacto.estandar = {
    http_reqs_total: data.metrics.http_reqs?.values.count ?? null,
    http_reqs_por_seg: data.metrics.http_reqs?.values.rate ?? null,
    http_req_failed_rate: data.metrics.http_req_failed?.values.rate ?? null,
    checks_rate: data.metrics.checks?.values.rate ?? null,
    iteraciones: data.metrics.iterations?.values.count ?? null,
  };

  const salidas = {};
  if (__ENV.JSON_OUT) {
    salidas[__ENV.JSON_OUT] = JSON.stringify(data, null, 2);
  }
  if (__ENV.RESUMEN_OUT) {
    salidas[__ENV.RESUMEN_OUT] = JSON.stringify(compacto, null, 2);
  }
  if (Object.keys(salidas).length === 0) {
    salidas['rp02-resumen.json'] = JSON.stringify(compacto, null, 2);
  }
  return salidas;
}
