/**
 * RP-01 — Carga de la portada de SGI-FIIS en un navegador real (k6 v2.x).
 *
 * Módulo browser de k6 (API estable desde k6 >= v0.55 / v2):
 *   import { browser } from 'k6/browser'  ->  browser.newPage({ viewport })
 * (NO existe chromium.launch en k6 v2; verificado con k6 v2.3.0.)
 *
 * Qué mide (Trends, la unidad es ms o bytes según el nombre):
 *   - section_ready_ms           : navigationStart -> sección #noticias lista.
 *   - images_download_window_ms  : ventana (fin - inicio) de descarga de las 3 imágenes.
 *   - image_body_bytes           : bytes decodificados/transferidos de cada imagen (tag recurso).
 *   - image_download_ms          : duración de la entrada de Performance de cada imagen (tag recurso).
 *   - page_body_bytes            : suma de transferSize de TODOS los recursos de la página.
 *   - rp01_dcl_ms / rp01_load_ms : Navigation Timing (domContentLoaded / load).
 *
 * Uso:
 *   TARGET=http://127.0.0.1:4173 JSON_OUT=k6/salidas/rp01.json k6 run k6/rp01_carga_pagina.js
 * Opcional: K6_BROWSER_HEADLESS=false para ver el navegador (Windows); en CI
 * (ubuntu-latest) se inyecta K6_BROWSER_PATH y K6_BROWSER_HEADLESS=true.
 */
import { browser } from 'k6/browser';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const ready = new Trend('section_ready_ms', true);
const download = new Trend('images_download_window_ms', true);
const bytes = new Trend('image_body_bytes', false);
const imgDuration = new Trend('image_download_ms', false);
const pageBytes = new Trend('page_body_bytes', false);

export const options = {
  scenarios: {
    navegar: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '90s',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: { checks: ['rate==1'] },
};

const OBJETIVO = __ENV.TARGET || 'http://127.0.0.1:4173';

export default async function () {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(OBJETIVO, { waitUntil: 'domcontentloaded' });
    await page.locator('#noticias .news-card').first().waitFor();

    const m = await page.evaluate(async () => {
      const section = document.querySelector('#noticias');
      section.scrollIntoView({ behavior: 'instant' });
      const urls = [...section.querySelectorAll('.news-card')].map((e) =>
        (getComputedStyle(e).backgroundImage.match(/url\(["']?([^"')]+)/) || [])[1],
      ).filter(Boolean);
      // Descarga total de las tres imágenes de fondo y doble rAF (pintado final).
      await Promise.all(
        urls.map(async (url) => {
          const img = new Image();
          img.src = url;
          try {
            await img.decode();
          } catch {
            /* la imagen ya podía estar en caché; no invalida la medición */
          }
        }),
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const porNombre = (frase) =>
        performance
          .getEntriesByType('resource')
          .filter((e) => e.name.includes(frase) && e.encodedBodySize > 0);
      const imagenes = ['convocatorias', 'congresos', 'reconocimineto'].map((frase) => {
        const entradas = porNombre(frase);
        return {
          recurso: frase,
          n: entradas.length,
          bytes: entradas.reduce((a, e) => a + (e.transferSize || e.decodedBodySize || 0), 0),
          ms: Math.round(entradas.length ? Math.max(...entradas.map((e) => e.duration)) : 0),
        };
      });
      const nav = performance.getEntriesByType('navigation')[0] || {};
      return {
        n: imagenes.reduce((a, i) => a + i.n, 0),
        ready: Math.round(performance.now()),
        bytes: imagenes.reduce((a, i) => a + i.bytes, 0),
        ventana: Math.round(
          Math.max(
            ...porNombre('assets').map((e) => e.responseEnd),
            performance.now(),
          ) - Math.min(...porNombre('assets').map((e) => e.startTime), Infinity),
        ),
        imagenes,
        pageAssetsBytes: performance
          .getEntriesByType('resource')
          .reduce((a, e) => a + (e.transferSize || 0), 0),
        dcl: Math.round(nav.domContentLoadedEventEnd || 0),
        load: Math.round(nav.loadEventEnd || 0),
        url: location.href,
      };
    });

    ready.add(m.ready);
    download.add(m.ventana);
    pageBytes.add(m.pageAssetsBytes);
    for (const img of m.imagenes) {
      bytes.add(img.bytes, { recurso: img.recurso });
      imgDuration.add(img.ms, { recurso: img.recurso });
    }
    check(m, {
      'tres respuestas decodificadas': (v) => v.n === 3 && v.bytes > 0,
      'sección de noticias lista': (v) => v.ready > 0 && v.ready < 60_000,
    });
    console.log('RP01 ' + JSON.stringify(m));
  } finally {
    await page.close();
  }
}

/** Resumen completo (todas las métricas, incluidas las series por tag) en JSON_OUT. */
export function handleSummary(data) {
  const salidas = {};
  if (__ENV.JSON_OUT) {
    salidas[__ENV.JSON_OUT] = JSON.stringify(data, null, 2);
  }
  return salidas;
}
