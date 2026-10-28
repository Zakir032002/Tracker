/* Sanctuary: a moonlit ocean that listens.
   Everything is driven by audio levels from the sound engine:
   waves -> swell height, rain -> falling streaks, thunder -> sky flashes,
   temple / bowl -> ripples, binaural -> two interfering wave sources.
   (Visual beating is always slowed to well under 1 Hz; no strobing.) */
import * as THREE from 'three';
import { damp, glowTexture, clamp } from './util.js';

const HEIGHT_GLSL = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform vec4 uRip[6];
uniform float uBeatOn;
uniform float uBeatK;

float baseH(vec2 p) {
  float h = 0.0;
  h += sin(p.x * 0.33 + uTime * 0.55) * 0.55;
  h += sin(p.y * 0.47 + p.x * 0.21 + uTime * 0.78) * 0.38;
  h += sin(dot(p, vec2(0.82, 0.57)) * 0.95 + uTime * 1.05) * 0.2;
  h += sin(dot(p, vec2(-0.31, 0.95)) * 1.8 + uTime * 1.5) * 0.09;
  return h;
}
float ripples(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 9.0) {
      float d = length(p - r.xy);
      float front = age * 2.1;
      float env = exp(-abs(d - front) * 1.1) * exp(-age * 0.42);
      h += sin((d - front) * 4.5) * env * r.w;
    }
  }
  return h;
}
float beatH(vec2 p) {
  if (uBeatOn < 0.01) return 0.0;
  vec2 a = vec2(-4.5, -7.0);
  vec2 b = vec2( 4.5, -7.0);
  float da = length(p - a);
  float db = length(p - b);
  float s1 = sin(da * 1.7 - uTime * 1.3);
  float s2 = sin(db * (1.7 + uBeatK) - uTime * 1.3);
  return (s1 + s2) * 0.07 * uBeatOn / (1.0 + 0.05 * (da + db));
}
float H(vec2 p) { return baseH(p) * uAmp + ripples(p) + beatH(p); }
`;

export function createSanctuary() {
  const root = new THREE.Group();

  /* ---- ocean ---- */
  const oceanU = {
    uTime: { value: 0 },
    uAmp: { value: 0.3 },
    uVis: { value: 0 },
    uFlash: { value: 0 },
    uRip: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uBeatOn: { value: 0 },
    uBeatK: { value: 0.12 },
    uCam: { value: new THREE.Vector3() },
    uHorizon: { value: new THREE.Color('#33424e') },
    uTop: { value: new THREE.Color('#0c1218') },
    uDeep: { value: new THREE.Color('#05090c') },
    uMoonDir: { value: new THREE.Vector3(-0.25, 0.22, -1).normalize() },
    uMoonPower: { value: 1 },
    uCS: { value: 0 },
  };
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 90, 220, 180),
    new THREE.ShaderMaterial({
      uniforms: oceanU,
      transparent: true,
      vertexShader: /* glsl */ `
        ${HEIGHT_GLSL}
        varying vec2 vP;
        varying vec3 vW;
        void main() {
          vec3 pos = position;
          vec4 w = modelMatrix * vec4(pos, 1.0);
          vP = w.xz;
          pos.z = H(vP); // plane is rotated: local z becomes world y
          vec4 world = modelMatrix * vec4(pos, 1.0);
          vW = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        ${HEIGHT_GLSL}
        varying vec2 vP;
        varying vec3 vW;
        uniform vec3 uCam, uHorizon, uTop, uDeep, uMoonDir;
        uniform float uFlash, uVis, uMoonPower, uCS;
        void main() {
          float e = 0.07;
          float h = H(vP);
          float hx = H(vP + vec2(e, 0.0));
          float hz = H(vP + vec2(0.0, e));
          vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
          vec3 V = normalize(uCam - vW);
          float fres = pow(1.0 - max(dot(n, V), 0.0), 3.5);
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHorizon, uTop, clamp(R.y * 1.6, 0.0, 1.0));
          float md = max(dot(R, uMoonDir), 0.0);
          float spec = (pow(md, 900.0) * 3.0 + pow(md, 60.0) * 0.35 + pow(md, 8.0) * 0.06) * uMoonPower;
          vec3 col = mix(uDeep, sky, fres * 0.9 + 0.05);
          col += spec * vec3(0.95, 0.92, 0.84);
          col += (sky + 0.12) * uFlash * 0.9;
          float crest = smoothstep(0.55, 1.1, h * 1.0);
          col += crest * 0.05;
          float dist = length(vW.xz - uCam.xz);
          col = mix(col, uHorizon * (1.0 + uFlash), smoothstep(20.0, 62.0, dist));
          if (uCS > 0.5) col = linearToOutputTexel(vec4(col, 1.0)).rgb;
          gl_FragColor = vec4(col, uVis);
        }`,
    })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.4;
  ocean.frustumCulled = false;
  root.add(ocean);

  /* ---- rain ---- */
  const N = 4500;
  const seeds = new Float32Array(N * 2 * 4);
  const ends = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = Math.random();
    const b = Math.random();
    const c = Math.random();
    const d = Math.random();
    for (let k = 0; k < 2; k++) {
      seeds.set([a, b, c, d], (i * 2 + k) * 4);
      ends[i * 2 + k] = k;
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  rg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  rg.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const rainU = { uTime: { value: 0 }, uRain: { value: 0 }, uWind: { value: 0.3 }, uVis: { value: 0 }, uColor: { value: new THREE.Color('#b9c6d1') } };
  const rain = new THREE.LineSegments(
    rg,
    new THREE.ShaderMaterial({
      uniforms: rainU,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; attribute float aEnd;
        uniform float uTime, uRain, uWind, uVis;
        varying float vA;
        void main() {
          float speed = 13.0 + aSeed.w * 9.0;
          float y = mod(aSeed.y * 24.0 - uTime * speed, 24.0) - 4.0;
          vec3 p = vec3((aSeed.x - 0.5) * 38.0, y, -1.0 - aSeed.z * 28.0);
          p.x += y * uWind * 0.08;
          float len = 0.5 + aSeed.w * 0.6;
          p.y += aEnd * len;
          p.x -= aEnd * len * uWind * 0.08;
          float thr = fract(aSeed.x * 37.3 + aSeed.z * 11.7);
          float vis = step(thr, uRain);
          vA = vis * (1.0 - aEnd * 0.8) * (0.22 + (1.0 - aSeed.z) * 0.4) * uVis;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main() { gl_FragColor = vec4(uColor, vA); }`,
    })
  );
  rain.frustumCulled = false;
  root.add(rain);

  /* ---- moon ---- */
  const moonGlowTex = glowTexture(256);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonGlowTex, color: 0xcfd8e2, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonGlow.scale.setScalar(26);
  function moonTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
    g.clip();
    const base = g.createRadialGradient(S * 0.4, S * 0.38, 10, S / 2, S / 2, S / 2);
    base.addColorStop(0, '#f4f0e6');
    base.addColorStop(0.7, '#d9d4c7');
    base.addColorStop(1, '#a9a69d');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = `rgba(90,88,84,${0.04 + Math.random() * 0.07})`;
      g.beginPath();
      g.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 26, 0, 7);
      g.fill();
    }
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function sunTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2 - 2);
    grd.addColorStop(0, '#fffaf0');
    grd.addColorStop(0.55, '#ffe6b0');
    grd.addColorStop(0.9, '#f7c987');
    grd.addColorStop(1, 'rgba(247,201,135,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.5, 64), new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true, opacity: 1, fog: false }));
  const moonPos = new THREE.Vector3(9.5, 6.4, -34);
  moon.position.copy(moonPos);
  moonGlow.position.copy(moonPos).add(new THREE.Vector3(0, 0, -0.1));
  root.add(moonGlow, moon);
  oceanU.uMoonDir.value.copy(moonPos).normalize();

  const moonTex = moon.material.map;
  const sunTex = sunTexture();
  let palette = 'dark';
  function setPalette(name) {
    if (name === palette) return;
    palette = name;
    const rose = name === 'rose';
    moon.material.map = rose ? sunTex : moonTex;
    moon.material.needsUpdate = true;
    moonGlow.material.color.set(rose ? 0xffd9a0 : 0xcfd8e2);
    moonGlow.material.blending = THREE.AdditiveBlending;
    oceanU.uHorizon.value.set(rose ? '#f7d2ac' : '#33424e');
    oceanU.uTop.value.set(rose ? '#e9a6b9' : '#0c1218');
    oceanU.uDeep.value.set(rose ? '#4a2a42' : '#05090c');
    rainU.uColor.value.set(rose ? '#fff3ee' : '#b9c6d1');
  }

  let flash = 0;
  let rippleIdx = 0;
  let lastTemple = 0;
  let lastBowl = 0;
  let thunderLatch = false;
  let time = 0;

  function ripple(x, z, strength = 0.35) {
    oceanU.uRip.value[rippleIdx].set(x, z, time, strength);
    rippleIdx = (rippleIdx + 1) % 6;
  }

  function update(dt, t, lv, vis, camPos) {
    time += dt;
    oceanU.uTime.value = time;
    rainU.uTime.value = time;
    oceanU.uCam.value.copy(camPos);
    oceanU.uVis.value = vis;
    rainU.uVis.value = vis;
    ocean.visible = rain.visible = moon.visible = moonGlow.visible = vis > 0.01;

    const rainAmt = clamp(Math.max(lv.rainLight * 0.5, lv.rainWindow * 0.6, lv.rainHeavy), 0, 1);
    oceanU.uAmp.value = damp(oceanU.uAmp.value, 0.22 + lv.waves * 1.15 + rainAmt * 0.28 + lv.thunder * 0.15, 1.5, dt);
    rainU.uRain.value = damp(rainU.uRain.value, rainAmt, 1.2, dt);
    rainU.uWind.value = 0.25 + lv.rainHeavy * 0.9 + lv.thunder * 0.5;

    // thunder: flash on the rising edge of the file's own loudness
    if (lv.thunderPulse > 0.5 && !thunderLatch) {
      flash = 0.55 + Math.random() * 0.25;
      thunderLatch = true;
    }
    if (lv.thunderPulse < 0.25) thunderLatch = false;
    flash = damp(flash, 0, 5, dt);
    oceanU.uFlash.value = flash * vis;

    // bells / bowls: ripple on the transient
    if (lv.templePulse > 0.55 && time - lastTemple > 1.2) {
      ripple((Math.random() - 0.5) * 3, -3 - Math.random() * 2, 0.5);
      lastTemple = time;
    }
    if (lv.bowlPulse > 0.5 && time - lastBowl > 1.2) {
      ripple((Math.random() - 0.5) * 2, -2.5 - Math.random(), 0.42);
      lastBowl = time;
    }

    oceanU.uBeatOn.value = damp(oceanU.uBeatOn.value, lv.beatOn ? 1 : 0, 1.5, dt);
    // visual difference between the two sources: slow and calm, never faster than ~0.5 Hz
    oceanU.uBeatK.value = 0.1 + clamp(lv.beatHz, 0.5, 40) * 0.004;

    // the moon dims behind weather
    const cover = clamp(rainAmt * 0.85 + lv.thunder * 0.3, 0, 0.95);
    oceanU.uMoonPower.value = 1 - cover;
    moon.material.opacity = (1 - cover * 0.85) * vis;
    moonGlow.material.opacity = (0.5 - cover * 0.35 + flash * 0.4) * vis;
  }

  return { root, update, ripple, setPalette, uniforms: oceanU, get flash() { return flash; } };
}
