const FALLBACK_PX_PER_MM = 96 / 25.4;

let cachedPxPerMm: number | null = null;

/**
 * Converts millimeters to CSS pixels.
 * Uses a one-time runtime measurement with a standards-based fallback.
 */
export function mmToPx(mm: number): number {
  return mm * getPxPerMm();
}

function getPxPerMm(): number {
  if (cachedPxPerMm !== null) {
    return cachedPxPerMm;
  }

  if (typeof document === 'undefined') {
    cachedPxPerMm = FALLBACK_PX_PER_MM;
    return cachedPxPerMm;
  }

  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:1mm;height:0;padding:0;margin:0;border:0;';
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().width;
  document.body.removeChild(probe);

  cachedPxPerMm = measured > 0 ? measured : FALLBACK_PX_PER_MM;
  return cachedPxPerMm;
}
