/**
 * RV-01 — Control de sensibilidad del detector de regresión visual.
 *
 * Propósito (metodología del experimento): demostrar que el comparador NO es
 * insensible. Se toman DOS capturas de la misma región (#noticias .news-grid)
 * y se comparan contra la MISMA baseline generada por regresion-visual.rv.ts:
 *
 *   A) captura LIMPIA de la revisión actual  -> píxeles distintos <                            300
 *   B) captura con CSS inyectado (translate) -> píxeles distintos > 400
 *
 * Con WebP sin pérdida en B) la diferencia es 0; en A) es el valor de aceptación.
 * Salidas (como evidencia): e2e/control-diff/
 *   - control-limpio-actual.png / control-limpio-diff.png
 *   - control-inyectado-actual.png / control-inyectado-diff.png
 *   - control-resultado.json (números usados en el informe)
 *
 * El test corre SOLO en corridas de verificación (cuando la baseline ya existe):
 *   - Se omite si SNAPSHOT_MODE está definido (corrida de generación "antes").
 * - Se ejecuta igual en local y en GitHub Actions (e2e determinista).
 */
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import {
  contarDiferencias,
  fijarIdioma,
  prepararCaptura,
  raizProyecto,
  simularBackend,
  TOLERANCIA_CANAL,
} from './helpers';

const RAIZ = raizProyecto();
/**
 * Ruta de la baseline del spec principal. Debe coincidir EXACTO con la
 * snapshotPathTemplate del config: {snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}
 * (snapshotDir = testDir = <raíz>/e2e; testFileDir = '' porque el spec está directo en e2e/).
 */
const BASELINE = path.join(
  RAIZ,
  'e2e',
  'regresion-visual.rv.ts-snapshots',
  'home-rejilla-noticias-baseline.png',
);
const DIR_SALIDA = path.join(RAIZ, 'e2e', 'control-diff');

test.describe('RV-01 - control de sensibilidad del comparador visual', () => {
  /** Alteración controlada: la primera tarjeta se desplaza 14 px (CSS en runtime). */
  const CSS_ALTERACION = '#noticias .news-card:first-child { transform: translateX(14px) !important; }';

  test('el comparador responde a una alteración controlada y presume la revisión', async ({ page }) => {
    // El modo update NO es una corrida de verificación (aún no hay baseline).
    test.skip(!!process.env.SNAPSHOT_MODE, 'Corrida de generación (update): el control se evalúa al verificar.');
    test.skip(!fs.existsSync(BASELINE), `No existe la baseline ${BASELINE}; genera antes el modo update.`);

    await fijarIdioma(page);
    await simularBackend(page);
    await page.goto('/');
    const rejilla = page.locator('#noticias .news-grid');
    await expect(rejilla).toBeVisible();
    await rejilla.scrollIntoViewIfNeeded();
    await prepararCaptura(page);

    fs.mkdirSync(DIR_SALIDA, { recursive: true });
    const basePNG = PNG.sync.read(fs.readFileSync(BASELINE));

    // ── A) captura limpia: la revisión actual debe reproducir la baseline ──
    const limpiaBuf = await rejilla.screenshot({ animations: 'disabled' });
    fs.writeFileSync(path.join(DIR_SALIDA, 'control-limpio-actual.png'), limpiaBuf);
    const rLimpia = contarDiferencias(
      basePNG,
      PNG.sync.read(limpiaBuf),
      path.join(DIR_SALIDA, 'control-limpio-diff.png'),
    );

    // ── B) captura con la alteración inyectada: el detector DEBE responder ──
    await page.addStyleTag({ content: CSS_ALTERACION });
    await page.evaluate(
      () =>
        new Promise<void>((res) => {
          requestAnimationFrame(() => requestAnimationFrame(() => res()));
        }),
    );
    const alteradaBuf = await rejilla.screenshot({ animations: 'disabled' });
    fs.writeFileSync(path.join(DIR_SALIDA, 'control-inyectado-actual.png'), alteradaBuf);
    const rAlterada = contarDiferencias(
      basePNG,
      PNG.sync.read(alteradaBuf),
      path.join(DIR_SALIDA, 'control-inyectado-diff.png'),
    );

    const resumen = {
      fecha: new Date().toISOString(),
      baseline: path.relative(RAIZ, BASELINE),
      toleranciaCanal: TOLERANCIA_CANAL,
      umbralMaxLimpio: 300,
      umbralMinInyectado: 400,
      alteracion: CSS_ALTERACION,
      limpia: rLimpia,
      inyectada: rAlterada,
    };
    fs.writeFileSync(
      path.join(DIR_SALIDA, 'control-resultado.json'),
      JSON.stringify(resumen, null, 2),
    );
    console.log('CONTROL-RESULTADO ' + JSON.stringify(resumen));

    expect(rLimpia.changed, 'la revisión sin cambios no debe diferir de la baseline').toBeLessThan(300);
    expect(rAlterada.changed, 'la alteración debe producir una diferencia detectable').toBeGreaterThan(400);
  });
});
