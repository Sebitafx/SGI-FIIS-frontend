/**
 * Utilidades compartidas del experimento RV-01 (regresión visual).
 *
 * Garantías del protocolo:
 *  - Idioma fijado antes de que la app cargue (i18next detecta primero localStorage).
 *  - Toda llamada al API se responde con JSON fijo, de modo que el contenido
 *    visible depende solo del código, no de un backend externo.
 *  - Cada captura espera red en reposo, fuentes listas, imágenes de fondo
 *    decodificadas, animaciones desactivadas y el puntero lejos de la región.
 *
 * Ejecutar siempre desde la RAÍZ del repositorio.
 */
import { expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Idioma del experimento (clave usada por i18next en src/i18n/index.ts). */
export const IDIOMA = 'es';

/** Umbral por canal RGB: una diferencia menor no se considera cambio real. */
export const TOLERANCIA_CANAL = 10;

/** Busca la raíz del proyecto (directorio con package.json) trepando desde cwd. */
export function raizProyecto(): string {
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

/** Fija el idioma en localStorage antes de la primera navegación. */
export async function fijarIdioma(page: Page): Promise<void> {
  await page.addInitScript((lang: string) => {
    window.localStorage.setItem('sgi_lang', lang);
  }, IDIOMA);
}

/**
 * Intercepta todas las llamadas al API y responde con JSON fijo:
 *  - /api/v1/auth/public-stats  -> null (la página conserva sus cifras de respaldo)
 *  - /api/v1/calls/vigent       -> []   (tarjeta de convocatoria con texto de respaldo)
 *  - /api/v1/auth/public-groups -> []   (carrusel de grupos con sus valores por defecto)
 *  - resto (calls, research-lines, etc.) -> []
 *
 * Las pantallas muestran el mismo contenido en ambas revisiones del experimento,
 * sin depender de un backend real.
 */
export async function simularBackend(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const cuerpo = url.includes('public-stats') ? 'null' : '[]';
    await route.fulfill({ status: 200, contentType: 'application/json', body: cuerpo });
  });
}

/** Espera a que NovedadesPage termine de cargar convocatorias (spinner fuera). */
export async function esperarListo(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.loading-spinner')).toHaveCount(0);
}

/** CSS inyectado para congelar transiciones en capturas deterministas. */
export const CSS_SIN_ANIMACIONES = '* { transition: none !important; animation: none !important; }';

/**
 * Prepara la página para una captura reproducible:
 *  1. red en reposo y fuentes listas;
 *  2. imágenes de fondo (estilo inline) descodificadas;
 *  3. transiciones congeladas;
 *  4. puntero alejado de la región (evita estados :hover);
 *  5. doble rAF para asegurar el pintado.
 */
export async function prepararCaptura(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const nodos = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="background-image"]'),
    );
    for (const nodo of nodos) {
      const m = getComputedStyle(nodo).backgroundImage.match(/url\(["']?([^"')]+)/);
      if (!m) {
        continue;
      }
      const img = new Image();
      img.src = m[1];
      await img.decode().catch(() => undefined);
    }
  });
  await page.addStyleTag({ content: CSS_SIN_ANIMACIONES });
  await page.mouse.move(3, 3);
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        requestAnimationFrame(() => requestAnimationFrame(() => res()));
      }),
  );
}

/** Resultado de la comparación de dos capturas. */
export interface ResultadoDiferencia {
  width: number;
  height: number;
  /** Píxeles con diferencia real (mayor que la tolerancia en algún canal). */
  changed: number;
  /** Píxeles totales de la región. */
  total: number;
}

/**
 * Comparador del control de sensibilidad de RV-01.
 * Decodifica ambas capturas PNG (pngjs) y cuenta píxeles distintos con la
 * tolerancia por canal TOLERANCIA_CANAL. Si se pasa una ruta de salida, escribe
 * una imagen de diferencias donde cada píxel alterado se pinta de rojo.
 */
export function contarDiferencias(
  base: PNG,
  actual: PNG,
  salidaDiff?: string,
): ResultadoDiferencia {
  if (base.width !== actual.width || base.height !== actual.height) {
    throw new Error(
      `Dimensiones de captura distintas: ${base.width}x${base.height} vs ${actual.width}x${actual.height}`,
    );
  }
  const diff = new PNG({ width: actual.width, height: actual.height });
  let changed = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    const dR = Math.abs(base.data[i] - actual.data[i]);
    const dG = Math.abs(base.data[i + 1] - actual.data[i + 1]);
    const dB = Math.abs(base.data[i + 2] - actual.data[i + 2]);
    if (dR > TOLERANCIA_CANAL || dG > TOLERANCIA_CANAL || dB > TOLERANCIA_CANAL) {
      changed += 1;
      diff.data[i] = 255;
      diff.data[i + 1] = 0;
      diff.data[i + 2] = 0;
      diff.data[i + 3] = 255;
    } else {
      // Sin diferencia: se conserva el píxel de la base
      diff.data[i] = base.data[i];
      diff.data[i + 1] = base.data[i + 1];
      diff.data[i + 2] = base.data[i + 2];
      diff.data[i + 3] = 255;
    }
  }
  const resultado: ResultadoDiferencia = {
    width: actual.width,
    height: actual.height,
    changed,
    total: actual.width * actual.height,
  };
  if (salidaDiff) {
    fs.writeFileSync(salidaDiff, PNG.sync.write(diff));
  }
  return resultado;
}
