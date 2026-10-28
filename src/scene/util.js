import * as THREE from 'three';

/* frame-rate independent smoothing: current -> target */
export const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/* soft radial sprite texture, used for glows and dust */
export function glowTexture(size = 128, inner = 0.0, stops = null) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  (stops || [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [0.6, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]).forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const hsl = (h, s, l) => new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);
