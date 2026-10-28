/* Rank medallion: a minted coin that shows your level and rank.
   The face is painted to a canvas, so any level/rank text works. */
import * as THREE from 'three';
import { damp, glowTexture } from './util.js';

const SIZE = 512;

export function createMedal(envMap) {
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);

  const metals = {
    dark: { base: '#c98a52', face: '#2a1b10', ink: '#f1d9bd', rim: 0xd99c64 },
    light: { base: '#b89a6a', face: '#efe6d6', ink: '#3a2d1d', rim: 0xc2a36d },
    rose: { base: '#e6b0a0', face: '#fff1ee', ink: '#6b2e3f', rim: 0xe9b8a6 },
  };
  let theme = 'dark';
  let info = { level: 1, rank: 'Seedling' };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;

  function paint() {
    const g = canvas.getContext('2d');
    const m = metals[theme] || metals.dark;
    g.clearRect(0, 0, SIZE, SIZE);
    const grd = g.createRadialGradient(SIZE * 0.4, SIZE * 0.35, 20, SIZE / 2, SIZE / 2, SIZE / 2);
    grd.addColorStop(0, m.face);
    grd.addColorStop(1, theme === 'rose' ? '#f4cfd0' : theme === 'light' ? '#d9ccb4' : '#140d07');
    g.fillStyle = grd;
    g.fillRect(0, 0, SIZE, SIZE);
    g.strokeStyle = m.base;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE * 0.4, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 2;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.arc(SIZE / 2, SIZE / 2, SIZE * 0.44, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    // tick ring
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r1 = SIZE * 0.455;
      const r2 = SIZE * (i % 6 === 0 ? 0.485 : 0.47);
      g.beginPath();
      g.moveTo(SIZE / 2 + Math.cos(a) * r1, SIZE / 2 + Math.sin(a) * r1);
      g.lineTo(SIZE / 2 + Math.cos(a) * r2, SIZE / 2 + Math.sin(a) * r2);
      g.strokeStyle = m.base;
      g.lineWidth = 3;
      g.stroke();
    }
    g.fillStyle = m.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 230px "Instrument Serif", Georgia, serif';
    g.fillText(String(info.level), SIZE / 2, SIZE * 0.47);
    g.font = '500 30px "Geist Mono", ui-monospace, monospace';
    g.globalAlpha = 0.85;
    g.fillText(('LEVEL · ' + info.rank).toUpperCase(), SIZE / 2, SIZE * 0.72);
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  }

  const sideMat = new THREE.MeshStandardMaterial({ color: 0xd99c64, metalness: 1, roughness: 0.28, envMap, envMapIntensity: 1.2 });
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.38, envMap, envMapIntensity: 0.8 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.16, 96, 1), [sideMat, faceMat, faceMat]);
  coin.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.075, 24, 120), sideMat);
  tilt.add(coin, rim);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256), color: 0xd99c64, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(5);
  glow.position.z = -1;
  root.add(glow);

  const key = new THREE.DirectionalLight(0xffe6cc, 2.4);
  key.position.set(-3, 4, 5);
  const rimLight = new THREE.DirectionalLight(0x9fb4cc, 1.2);
  rimLight.position.set(4, 1, -3);
  root.add(key, rimLight);

  let spin = 0;
  let boost = 0;
  function setInfo(i, th) {
    if (i) info = { ...info, ...i };
    if (th && th !== theme) {
      theme = th;
      const m = metals[theme] || metals.dark;
      sideMat.color.set(m.rim);
      glow.material.color.set(m.rim);
      glow.material.blending = theme === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending;
      glow.material.opacity = theme === 'dark' ? 0.18 : 0.12;
    }
    // fonts may arrive late; repaint once they do
    paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
  }
  function pulse() {
    boost = 4;
  }
  function update(dt, t, pointer) {
    boost = damp(boost, 0, 1.5, dt);
    spin += dt * (0.35 + boost);
    tilt.rotation.y = Math.sin(spin * 0.5) * 0.7 + pointer.x * 0.5;
    tilt.rotation.x = -0.15 + pointer.y * 0.3 + Math.sin(t * 0.4) * 0.05;
    root.position.y = Math.sin(t * 0.8) * 0.06;
  }
  paint();
  return { root, update, setInfo, pulse };
}
