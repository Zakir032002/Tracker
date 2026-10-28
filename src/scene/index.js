/* Ascend: WebGL scene manager.
   One fixed canvas behind the whole app. The UI drives it through window.A3D:
     A3D.mode('core' | 'skyline' | 'sanctuary' | 'medal', { cx, cy, zoom })
     A3D.set({ progress, hp, dead, quests, week, hue, theme })
     A3D.pulse('complete' | 'crit' | 'level' | 'damage' | 'death' | 'perfect')
     A3D.skyline(days, cols, hue)  /  A3D.onHover(fn)
   Falls back to a no-op stub when WebGL is unavailable. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createCore } from './core.js';
import { createSkyline } from './skyline.js';
import { createSanctuary } from './sanctuary.js';
import { createMedal } from './medal.js';
import { createRoseFx } from './rosefx.js';
import { damp, clamp, hsl } from './util.js';

const noop = () => {};
const stub = { ready: false, mode: noop, set: noop, pulse: noop, skyline: noop, onHover: noop, intro: noop, quality: noop, resize: noop };

function boot() {
  const canvas = document.getElementById('gl');
  if (!canvas) return stub;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('[A3D] WebGL unavailable', e);
    document.documentElement.classList.add('no-webgl');
    return stub;
  }
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = matchMedia('(pointer: coarse)').matches;

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let maxPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75);
  let pr = maxPR;
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* ---------- sky dome ---------- */
  const skyU = {
    uTop: { value: new THREE.Color('#1a1511') },
    uBot: { value: new THREE.Color('#070605') },
    uGlow: { value: new THREE.Color('#d9955f') },
    uGlowAmt: { value: 0.12 },
    uGlowPos: { value: new THREE.Vector2(0.3, 0.5) },
    uFlash: { value: 0 },
    uNight: { value: 0 },
    uAspect: { value: 1 },
    uCS: { value: 0 }, // 1 = convert to display colour space (rose theme)
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vD; varying vec2 vS; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); vS = p.xy / p.w; gl_Position = p; }',
      fragmentShader: /* glsl */ `
        varying vec3 vD; varying vec2 vS;
        uniform vec3 uTop, uBot, uGlow; uniform float uGlowAmt, uFlash, uNight, uAspect, uCS; uniform vec2 uGlowPos;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          float y = clamp(vD.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBot, uTop, smoothstep(0.1, 0.95, y));
          vec2 g = (vS * 0.5 + 0.5) - uGlowPos;
          g.x *= uAspect;
          float d = length(g);
          col += uGlow * uGlowAmt * exp(-d * d * 5.5);
          col += vec3(0.55, 0.62, 0.72) * uFlash * (0.25 + y * 0.6);
          // soft stars in the night sky
          vec2 sg = vS * vec2(uAspect, 1.0) * 150.0;
          vec2 sid = floor(sg);
          vec2 sf = fract(sg) - 0.5;
          float sr = hash(sid);
          vec2 off = (vec2(hash(sid + 1.7), hash(sid + 3.1)) - 0.5) * 0.6;
          float star = step(0.975, sr) * smoothstep(0.16, 0.0, length(sf - off)) * (0.35 + 0.65 * fract(sr * 31.0));
          col += star * uNight * smoothstep(0.32, 0.85, y) * 0.9;
          // fine dither so the dark gradient never bands
          col += (hash(vS * 997.0) - 0.5) / 255.0 * 2.0;
          if (uCS > 0.5) col = linearToOutputTexel(vec4(col, 1.0)).rgb;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  sky.renderOrder = -10;
  scene.add(sky);

  /* ---------- dust motes ---------- */
  const DUST = 1500;
  const dp = new Float32Array(DUST * 3);
  const ds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dp.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 16 - 2], i * 3);
    ds[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1));
  const dustU = { uTime: { value: 0 }, uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color('#e8dcc8') }, uScale: { value: 300 } };
  const dust = new THREE.Points(
    dg,
    new THREE.ShaderMaterial({
      uniforms: dustU,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime, uScale; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.07 + aSeed * 30.0) * 0.8;
          p.y += mod(uTime * (0.03 + aSeed * 0.05) + aSeed * 14.0, 14.0) - 7.0 + sin(uTime * 0.2 + aSeed * 9.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0);
          float big = step(0.94, aSeed);
          gl_PointSize = ((0.9 + aSeed * 1.6) + big * 9.0) * uScale / -mv.z;
          vA = tw * smoothstep(-2.0, -7.0, mv.z) * (0.35 + aSeed * 0.65) * (1.0 - big * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
        }`,
    })
  );
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- actors ---------- */
  const core = createCore(envMap);
  const coreKey = new THREE.DirectionalLight(0xffe6cc, 2.6);
  coreKey.position.set(-4, 5, 6);
  const coreRim = new THREE.DirectionalLight(0x8aa3bd, 1.6);
  coreRim.position.set(5, 2, -4);
  core.root.add(coreKey, coreRim);
  scene.add(core.root);

  const skyline = createSkyline(envMap);
  skyline.root.visible = false;
  scene.add(skyline.root);

  const sanct = createSanctuary();
  scene.add(sanct.root);

  const medal = createMedal(envMap);
  medal.root.visible = false;
  scene.add(medal.root);

  const rosefx = createRoseFx(envMap);
  scene.add(rosefx.root);

  scene.add(new THREE.HemisphereLight(0xfff1de, 0x1a1410, 0.35));
  scene.fog = new THREE.Fog(0x070605, 12, 30);

  /* ---------- state ---------- */
  const W = { core: 1, sky: 0, sanct: 0, medal: 0 }; // current weights
  const T = { core: 1, sky: 0, sanct: 0, medal: 0 }; // target weights
  const view = { cx: 0.3, cy: 0.5, zoom: 1 };
  const tview = { cx: 0.3, cy: 0.5, zoom: 1 };
  let modeName = 'core';
  let theme = 'dark';
  let hue = 24;
  let introK = 0;
  let introOn = false;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, px: 0, py: 0 };
  let hoverCb = noop;
  let lastHover = -2;
  let size = { w: 1, h: 1 };
  let frame = 0;
  let ema = 0.016;
  let lite = false;
  let qualityLevel = 'high';

  const accent = () => hsl(hue, 0.62, 0.62);
  const PAL = {
    dark: { top: '#1a1511', bot: '#070605', glow: 0.14 },
    light: { top: '#efe9de', bot: '#d8d0c1', glow: 0.2 },
    rose: { top: '#fcf0ee', bot: '#f4d2d4', glow: 0.3 },
  };
  const SANCT = { dark: { top: '#0b1219', bot: '#2a3946' }, rose: { top: '#e9a6b9', bot: '#f7d2ac' } };
  const cTop = new THREE.Color();
  const cBot = new THREE.Color();
  const cTop2 = new THREE.Color();
  const cBot2 = new THREE.Color();

  function applyPalette() {
    const rose = theme === 'rose';
    const light = theme !== 'dark';
    const a = accent();
    skyU.uCS.value = rose ? 1 : 0;
    sanct.uniforms.uCS.value = rose ? 1 : 0;
    core.setStyle(rose ? 'rose' : 'obsidian');
    core.setAccent(a);
    if (rose) skyU.uGlow.value.set('#f5d9a0');
    else skyU.uGlow.value.copy(a);
    skyline.setTheme(theme);
    sanct.setPalette(rose ? 'rose' : 'dark');
    medal.setInfo(null, theme);
    dustU.uColor.value.set(light ? '#7a6a55' : '#e8dcc8');
    dust.visible = qualityLevel !== 'low' && !rose;
    renderer.toneMappingExposure = rose ? 0.98 : light ? 0.95 : 1.05;
  }

  function lerpSky() {
    const P = PAL[theme] || PAL.dark;
    const rose = theme === 'rose';
    const S = rose ? SANCT.rose : SANCT.dark;
    const night = W.sanct;
    cTop.set(P.top).lerp(cTop2.set(S.top), night);
    cBot.set(P.bot).lerp(cBot2.set(S.bot), night);
    skyU.uTop.value.copy(cTop);
    skyU.uBot.value.copy(cBot);
    scene.fog.color.copy(cBot);
    skyU.uGlowAmt.value = P.glow * (1 - night * (rose ? 0.4 : 1)) * (0.6 + core.S.energy * 0.5);
    skyU.uNight.value = rose ? 0 : night;
    skyU.uFlash.value = sanct.flash * W.sanct;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    size = { w, h };
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    skyU.uAspect.value = w / h;
    rosefx.setScale(h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / size.w) * 2 - 1;
      pointer.y = -((e.clientY / size.h) * 2 - 1);
      pointer.px = e.clientX;
      pointer.py = e.clientY;
    },
    { passive: true }
  );

  /* ---------- raycast hover for the skyline ---------- */
  const ray = new THREE.Raycaster();
  const v2 = new THREE.Vector2();
  function hoverTest() {
    if (W.sky < 0.6 || !pointer.over) {
      if (lastHover !== -1) {
        lastHover = -1;
        skyline.setHover(-1);
        hoverCb(null);
      }
      return;
    }
    v2.set(pointer.x, pointer.y);
    ray.setFromCamera(v2, camera);
    const i = skyline.pick(ray);
    if (i !== lastHover) {
      lastHover = i;
      skyline.setHover(i);
      if (i < 0) hoverCb(null);
      else {
        const wp = skyline.worldOf(i).project(camera);
        hoverCb({ index: i, day: skyline.days[i], x: (wp.x * 0.5 + 0.5) * size.w, y: (-wp.y * 0.5 + 0.5) * size.h });
      }
    }
  }

  /* ---------- main loop ---------- */
  const clock = new THREE.Clock();
  const levels = () => (window.A && window.A.sound && window.A.sound.levels ? window.A.sound.levels() : ZERO);
  const ZERO = { rainLight: 0, rainWindow: 0, rainHeavy: 0, thunder: 0, thunderPulse: 0, waves: 0, temple: 0, templePulse: 0, bowl: 0, bowlPulse: 0, beatOn: false, beatHz: 10 };

  const camBase = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) {
      clock.getDelta();
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frame++;

    // adaptive quality
    ema = ema * 0.96 + dt * 0.04;
    if (frame % 90 === 0 && qualityLevel === 'high') {
      if (ema > 0.03 && pr > 1) {
        pr = Math.max(1, pr - 0.25);
        renderer.setPixelRatio(pr);
        renderer.setSize(size.w, size.h, false);
      } else if (ema > 0.036 && !lite) {
        lite = true;
        core.lite();
        renderer.shadowMap.enabled = false;
      }
    }

    // weights + view smoothing
    ['core', 'sky', 'sanct', 'medal'].forEach((k) => (W[k] = damp(W[k], T[k], 3.2, dt)));
    view.cx = damp(view.cx, tview.cx, 3, dt);
    view.cy = damp(view.cy, tview.cy, 3, dt);
    view.zoom = damp(view.zoom, tview.zoom, 3, dt);

    if (introOn) introK = Math.min(1, introK + dt / 2.8);
    const ie = introOn ? 1 - Math.pow(1 - introK, 3) : 1;

    // pointer smoothing
    pointer.sx = damp(pointer.sx, pointer.x, 3, dt);
    pointer.sy = damp(pointer.sy, pointer.y, 3, dt);
    const par = reduced ? 0 : 1;

    // camera per mode (blend between configurations)
    const cCore = { z: 9.2 / view.zoom, y: 0, ly: 0 };
    const cSky = { z: 7.6, y: 6.4, ly: 0.0 };
    const cSan = { z: 9, y: 1.7, ly: 1.45 };
    const cMed = { z: 6.4 / view.zoom, y: 0, ly: 0 };
    const bw = W.core + W.sky + W.sanct + W.medal || 1;
    camBase.set(
      pointer.sx * 0.6 * par,
      (cCore.y * W.core + cSky.y * W.sky + cSan.y * W.sanct + cMed.y * W.medal) / bw + pointer.sy * 0.35 * par,
      (cCore.z * W.core + cSky.z * W.sky + cSan.z * W.sanct + cMed.z * W.medal) / bw + (1 - ie) * 6
    );
    camera.position.copy(camBase);
    const ly = (cCore.ly * W.core + cSky.ly * W.sky + cSan.ly * W.sanct + cMed.ly * W.medal) / bw;
    lookAt.set(0, ly, W.sanct > 0.5 ? -12 : 0);
    camera.lookAt(lookAt);
    // shift the whole projection so the world origin lands at (cx, cy) of the screen
    const ox = (0.5 - view.cx) * size.w;
    const oy = (0.5 - view.cy) * size.h;
    camera.setViewOffset(size.w, size.h, ox, oy, size.w, size.h);

    const lv = levels();

    // core
    core.root.visible = W.core > 0.01;
    if (core.root.visible) {
      const s = W.core * ie * (1 + (lv.beatOn ? Math.sin(t * 0.5) * 0.01 : 0));
      core.root.scale.setScalar(Math.max(0.0001, s));
      core.root.position.set(0, Math.sin(t * 0.6) * 0.06, 0);
      core.update(dt, t, { x: pointer.sx * par, y: pointer.sy * par });
    }
    // medal
    medal.root.visible = W.medal > 0.01;
    if (medal.root.visible) {
      medal.root.scale.setScalar(Math.max(0.0001, W.medal * ie));
      medal.update(dt, t, { x: pointer.sx * par, y: pointer.sy * par });
    }
    // rose ambience
    rosefx.update(dt, t, theme === 'rose' ? 1 - W.sanct * 0.25 : 0, { x: pointer.sx * par, y: pointer.sy * par });
    // skyline
    skyline.root.visible = W.sky > 0.01;
    if (skyline.root.visible) {
      const w = skyline.root.userData.width || 14;
      const visW = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
      const fit = clamp((visW * (size.w < 700 ? 0.72 : 0.86)) / w, 0.3, 1.25);
      skyline.root.scale.set(fit, W.sky * clamp(fit * 1.15, 0.45, 1.1), fit);
      skyline.root.position.y = -0.7 + (1 - W.sky) * -2;
      skyline.root.rotation.y = -0.42 + pointer.sx * 0.12 * par + Math.sin(t * 0.15) * 0.04 * par;
      skyline.key.castShadow = renderer.shadowMap.enabled && !lite;
      skyline.setWeight(W.sky);
      skyline.update(dt, t);
      if (frame % 2 === 0) hoverTest();
    }
    // sanctuary
    sanct.update(dt, t, lv, W.sanct, camera.position);

    // dust
    dustU.uTime.value = t;
    dustU.uScale.value = size.h * 0.034;
    dustU.uOpacity.value = (theme === 'light' ? 0.35 : 0.55) * (1 - W.sanct * 0.75);
    dust.position.x = -pointer.sx * 0.4 * par;
    dust.position.y = -pointer.sy * 0.25 * par;

    lerpSky();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);

  /* ---------- public API ---------- */
  const api = {
    ready: true,
    renderer,
    mode(name, opts = {}) {
      modeName = name;
      T.core = name === 'core' ? 1 : 0;
      T.sky = name === 'skyline' ? 1 : 0;
      T.sanct = name === 'sanctuary' ? 1 : 0;
      T.medal = name === 'medal' ? 1 : 0;
      tview.cx = opts.cx ?? 0.5;
      tview.cy = opts.cy ?? 0.5;
      tview.zoom = opts.zoom ?? 1;
      pointer.over = name === 'skyline' && opts.interactive !== false;
      if (reduced) api.settle(); // no camera flights for reduced-motion users
    },
    set(s) {
      if (s.theme && s.theme !== theme) {
        theme = s.theme;
        applyPalette();
      }
      if (s.hue != null && s.hue !== hue) {
        hue = s.hue;
        applyPalette();
      }
      if (s.quests) core.setQuests(s.quests);
      if (s.week) core.setWeek(s.week);
      core.setState(s);
    },
    pulse: (k) => {
      core.pulse(k);
      if (k === 'level' || k === 'perfect') medal.pulse();
    },
    medal: (info) => medal.setInfo(info, theme),
    skyline(days, cols, h, th) {
      skyline.setData(days, cols, h ?? hue, th || theme);
    },
    interactive(on) {
      pointer.over = on;
    },
    onHover(fn) {
      hoverCb = fn || noop;
    },
    ripple: (x, z, s) => sanct.ripple(x, z, s),
    intro() {
      introOn = true;
      introK = 0;
    },
    quality(level) {
      qualityLevel = level;
      if (level === 'low') {
        pr = 1;
        renderer.setPixelRatio(1);
        renderer.setSize(size.w, size.h, false);
        renderer.shadowMap.enabled = false;
        dust.visible = false;
        rosefx.root.userData.low = true;
      } else {
        pr = maxPR;
        renderer.setPixelRatio(pr);
        renderer.setSize(size.w, size.h, false);
        renderer.shadowMap.enabled = true;
        dust.visible = theme !== 'rose';
      }
    },
    settle() {
      Object.keys(W).forEach((k) => (W[k] = T[k]));
      view.cx = tview.cx;
      view.cy = tview.cy;
      view.zoom = tview.zoom;
      introOn = false;
      introK = 1;
      skyline.settle();
    },
    resize,
    get fps() {
      return 1 / ema;
    },
  };
  applyPalette();
  return api;
}

window.A3D = boot();
document.dispatchEvent(new CustomEvent('a3d-ready'));
