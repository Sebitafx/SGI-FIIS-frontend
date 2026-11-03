/**
 * RV-01 — conservación visual de la portada (sección de noticias) de SGI-FIIS.
 *
 * Flujo experimental (protocolo del curso de Mantenimiento de Software):
 *   1. Revisión ANTERIOR (imágenes PNG):
 *        SNAPSHOT_MODE=update npx playwright test --config=e2e/playwright.config.ts \
 *          --update-snapshots=all
 *      Genera las baselines con los nombres fijos usados en este archivo.
 *   2. Revisión POSTERIOR (imágenes WebP sin pérdida):
 *        npx playwright test --config=e2e/playwright.config.ts
 *      Compara contra esas mismas baselines: con WebP sin pérdida la diferencia
 *      esperada es 0 píxeles.
 *
 * Portrait del módulo:
 *   - home:     rejilla #noticias .news-grid (las tres tarjetas juntas).
 *   - novedades: banner de reconocimientos y banner de congresos
 *               (los selectores conmutan con los enlaces .sidebar-link).
 *
 * Determinismo: helpers.ts fija idioma, simula el API, espera fuentes e
 * imágenes y congela animaciones; el config fija viewport, locale, timezone y
 * retries = 0.
 */
import { expect, test } from '@playwright/test';
import { fijarIdioma, prepararCaptura, simularBackend } from './helpers';

test.describe('RV-01 - conservación visual del módulo de noticias', () => {
  test('home: rejilla de noticias con las tres tarjetas', async ({ page }) => {
    await fijarIdioma(page);
    await simularBackend(page);
    await page.goto('/');

    const rejilla = page.locator('#noticias .news-grid');
    await expect(rejilla).toBeVisible();
    await rejilla.scrollIntoViewIfNeeded();
    await prepararCaptura(page);

    await expect(rejilla).toHaveScreenshot('home-rejilla-noticias-baseline.png', {
      animations: 'disabled',
      caret: 'hide',
    });
  });

  test('novedades: banner de reconocimientos', async ({ page }) => {
    await fijarIdioma(page);
    await simularBackend(page);
    await page.goto('/novedades');

    // El contenido depende de convocatorias; se espera el fin del spinner.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.loading-spinner')).toHaveCount(0);

    // Los tres enlaces del menú lateral existen siempre; el índice 1 es
    // "Reconocimiento" (independiente del texto del locale).
    await page.locator('.sidebar-menu a.sidebar-link').nth(1).click();
    const banner = page.locator('#novedades-reconocimientos .about-info-card');
    await expect(banner).toBeVisible();
    await banner.scrollIntoViewIfNeeded();
    await prepararCaptura(page);

    await expect(banner).toHaveScreenshot('novedades-banner-reconocimientos-baseline.png', {
      animations: 'disabled',
      caret: 'hide',
    });
  });

  test('novedades: banner de congresos', async ({ page }) => {
    await fijarIdioma(page);
    await simularBackend(page);
    await page.goto('/novedades');

    await page.waitForLoadState('networkidle');
    await expect(page.locator('.loading-spinner')).toHaveCount(0);

    // El índice 2 del menú lateral es "Congresos".
    await page.locator('.sidebar-menu a.sidebar-link').nth(2).click();
    const banner = page.locator('#novedades-congresos .about-info-card');
    await expect(banner).toBeVisible();
    await banner.scrollIntoViewIfNeeded();
    await prepararCaptura(page);

    await expect(banner).toHaveScreenshot('novedades-banner-congresos-baseline.png', {
      animations: 'disabled',
      caret: 'hide',
    });
  });
});
