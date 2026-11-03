/**
 * Configuración de Playwright para el experimento de Pruebas de Regresión Visual
 * (curso de Mantenimiento de Software — SGI-FIIS).
 *
 * Flujo del experimento (ejecutado por el equipo):
 *   1. Compilar la revisión ANTERIOR (imágenes PNG) y levantar `vite preview`.
 *   2. Ejecutar  npx playwright test --config=e2e/playwright.config.ts --update-snapshots=all
 *      -> genera las "baselines" en e2e/visual-regresion.rv.ts-snapshots/.
 *   3. Compilar la revisión POSTERIOR (imágenes WebP sin pérdida) y volver a ejecutar
 *      el mismo comando SIN --update-snapshots -> compara contra las mismas baselines.
 *
 * Determinismo:
 *   - retries: 0 (nada de reintentos que silencien flaky).
 *   - viewport/locale/timezone/colorScheme/deviceScaleFactor fijados de forma explícita.
 *   - El servidor NO se levanta aquí de forma obligatoria: solo si se define la
 *     variable de entorno PW_WITH_SERVER (solo se levanta con `npm run preview`). Así el flujo
 *     local y el workflow de Actions controlan cuándo arranca el servidor.
 *   - Sufijo '-baseline' en TODOS los nombres de snapshot: nombre estable idéntico
 *     en la revisión "antes" y "después" (mismo test genera el mismo nombre).
 *
 * NOTA: los archivos E2E NO terminan en .spec.ts a propósito (usan el sufijo .rv.ts,
 * controlado por testMatch). Así Vitest (npm test) no los ejecuta por accidente,
 * porque su include por defecto (*​*​/*.spec.ts) no coincide.
 *
 * IMPORTANTE: ejecutar siempre desde la RAÍZ del repositorio:
 *   npx playwright test --config=e2e/playwright.config.ts
 */
import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Busca la raíz del proyecto (directorio con package.json) trepando desde cwd. */
function buscarRaizProyecto(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const padre = path.dirname(dir);
    if (padre === dir) {
      break;
    }
    dir = padre;
  }
  return process.cwd();
}

const RAIZ = buscarRaizProyecto();
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  // Carpeta de pruebas del experimento (todos los *.rv.ts de e2e/).
  testDir: path.join(RAIZ, 'e2e'),
  testMatch: '**/*.rv.ts',

  // Plantilla de rutas de snapshots: predecible para la prueba de control
  // (control-deteccion.rv.ts lee la baseline del spec principal por ruta):
  //   e2e/regresion-visual.rv.ts-snapshots/*.png
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',

  // Sin reintentos: una prueba "azul a veces" rompe la hipótesis del experimento.
  retries: 0,
  forbidOnly: !!process.env.CI,

  // fullyParallel con páginas/contextos independientes (cada test crea su propio
  // page con las routes/init-scripts del helper e2e/fixture-page.ts).
  fullyParallel: true,
  // 1 worker por defecto para minimizar interferencias del servidor de preview;
  // ajustable con PW_WORKERS=2..4 sin tocar el código.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,

  timeout: 90_000,
  globalTimeout: 6 * 60_000,

  // Artefactos de corrida fallida (diffs, traces) aparte de los reportes HTML.
  outputDir: path.join(RAIZ, 'e2e', 'test-results'),

  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(RAIZ, 'e2e', 'reports'), open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'es',
    timezoneId: 'America/Lima',
    colorScheme: 'light',
    deviceScaleFactor: 1,

    // Solo guarda evidencia cuando falla (las baselines son los *.png del diff y
    // las copias *.rv.ts-snapshots).
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',

    // Menos ruido para los screenshots en un solo entorno.
    reducedMotion: 'reduce',

    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  expect: {
    timeout: 15_000,
    /* Valores por defecto para TODOS los expect(locator).toHaveScreenshot(...): */
    toHaveScreenshot: {
      /**
       * maxDiffPixels: 300 = margen razonable por jitter de renderizado (antialias,
       * subpíxel del navegador). Con WebP sin pérdida la diferencia esperada es 0:
       * los pixeles decodificados de PNG y WebP lossless son idénticos; solo
       * anti-aliasing del propio navegador puede aportar diferencias residuales.
       * Se refuerzan 'animations: disabled' y 'caret: hide' test por test.
       */
      maxDiffPixels: 300,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  /* Servidor opcional: solo cuando se pida con PW_WITH_SERVER=1 (usado en el
   * workflow de GitHub Actions). Levanta `npm run preview` (vite preview en el
   * puerto 4173 del build ya compilado, dist/) y espera a que responda. */
  webServer: process.env.PW_WITH_SERVER
    ? {
        command: 'npm run preview',
        port: 4173,
        timeout: 90_000,
        reuseExistingServer: true,
      }
    : undefined,

  projects: [
    {
      name: 'chromium-es',
      // Únicamente Chromium: mismo motor en Windows local y en ubuntu-latest de
      // Actions (la versión del navegador queda fijada por @playwright/test).
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
