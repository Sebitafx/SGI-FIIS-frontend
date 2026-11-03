# Tutorial — Pruebas de Regresión Visual y de Rendimiento en SGI-FIIS

También disponible en: `.github/workflows/mantenimiento-perfectivo.yml`
(pipeline completo) y en el informe del curso (Anexo A).

## Propósito

Reproducir el experimento del curso: un **cambio perfectivo** convierte las
tres fotografías de las tarjetas de noticias de la portada (`convocatorias`,
`congresos`, `reconocimineto`) de PNG a **WebP sin pérdida**. Dos familias de
pruebas garantizan la intervención:

- **RV-01 (Playwright)** — compara capturas de referencia (`baselines`) píxel
  a píxel: la revisión con WebP debe verse **igual** a la revisión con PNG.
- **RP-01 / RP-02 (k6)** — mide la carga de la portada (navegador real) y la
  descarga HTTP de los tres recursos (5 VUs × 30 s), antes y después.

## Prerrequisitos

| Herramienta | Versión | Instalación |
|---|---|---|
| Node.js | 20+ (usa el `lockfile` del repo) | `winget install OpenJS.NodeJS` |
| Dependencias del repo | — | `npm ci` |
| Chromium de Playwright | según `@playwright/test` del lockfile | `npx playwright install chromium` |
| k6 | v2.3.0 (módulo `k6/browser`) | descarga del release oficial de Grafana (`k6-v2.3.0-*-amd64`); en Windows basta `k6.exe` en el `PATH` o en una carpeta conocida |

## Flujo local (paso a paso)

1. **Preparar el entorno**
   ```bash
   npm ci
   npx playwright install chromium
   ```

2. **Construir la revisión ANTES (PNG) y servirla**
   ```bash
   git checkout <sha-antes>   # p.ej. el commit de infraestructura de pruebas
   npm run build
   node k6/servidor-estatico.mjs 4173 "$PWD/dist"
   ```

3. **Generar las baselines (solo la primera vez)**
   ```bash
   BASE_URL=http://127.0.0.1:4173 SNAPSHOT_MODE=update \
   npx playwright test --config=e2e/playwright.config.ts --update-snapshots=all
   ```
   Salida: `e2e/regresion-visual.rv.ts-snapshots/*.png` (→ ignoradas por git).

4. **Pasar a la revisión DESPUÉS (WebP) y verificar**
   ```bash
   git checkout <sha-despues>
   npm run build
   node k6/servidor-estatico.mjs 4174 "$PWD/dist"   # terminal aparte
   BASE_URL=http://127.0.0.1:4174 npx playwright test --config=e2e/playwright.config.ts
   ```
   Con WebP **sin pérdida** las 3 capturas son píxel iguales; el test de
   control (`e2e/control-deteccion.rv.ts`) demuestra además que el comparador
   **sí** detecta una alteración real (injeta un desplazamiento de 14 px y
   exige diferencias > 400). Las cifras quedan en `e2e/control-diff/`.

5. **Medir el rendimiento (campaña por revisión)**
   ```bash
   export TARGET=http://127.0.0.1:4173
   export RP02_URLS="$(node k6/extraer_assets.mjs "$PWD/dist" --env)"
   JSON_OUT=k6/salidas/rp01.json k6 run k6/rp01_carga_pagina.js
   RP02_VUS=5 RP02_DURATION=30s JSON_OUT=k6/salidas/rp02.json k6 run k6/rp02_recursos.js
   ```
   Repetir con la otra revisión; los JSON de `k6/salidas/` son la evidencia.

## Flujo en GitHub Actions (fork)

1. Empujar la rama `mnt/perfectivo-imagenes` → dispara el workflow en modo
   **rápido** (`calidad`, `visual` antes→después, `rp-rapido`).
2. Para la campaña completa: *Actions → mantenimiento-perfectivo → Run workflow*
   con `modo = completo` y `revision_base = <sha del commit ANTES>`; el job
   `rp-completo` mide 3 repeticiones por revisión y arma la tabla comparativa.
3. Artefactos: `rv-baselines` (bisel generadas en la etapa ANTES), `rv-reportes`
   (reportes HTML, diferencias y `control-resultado.json`), `rp-*-json`
   (mediciones k6). Resumen del ciclo visible en la pestaña *Summary*.

## Notas y limitaciones

- Todos los tests fijan idioma (`sgi_lang=es`), simulación del API, animación
  congelada y puntero fuera de la zona; `retries: 0` para no falsar el resultado.
- Las **baselines NO se versionan**: se generan y comparan en el MISMO entorno
  (local o el mismo runner de Actions); así las diferencias no provienen del
  entorno sino del cambio de código.
- El cambio documentado es `src/pages/WelcomePage.css .news-card
  background-size: cover → contain` (`demo/regresion-visual-demo.patch`); la
  demo espera ese fallo y revierte el parche al terminar.
