/* Ascend: the far background. Three slow layers behind everything else:
   - an aurora veil (curtains of colour that drift and breathe)
   - a constellation of linked points that turns with the pointer
   - large out-of-focus bokeh discs at mid depth, for parallax
   Colours and blending follow the theme: additive light on dark, soft ink on the pale themes. */
import * as THREE from 'three';

const HASH = /* glsl */ `
  float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + 1.0), f.x), f.y);
  }`;

export function createBackdrop() {
  const root = new THREE.Group();
  const U = {
    uTime: { value: 0 },
    uK: { value: 1 }, // overall visibility
    uCS: { value: 0 },
    uA: { value: new THREE.Color('#c9824f') },
    uB: { value: new THREE.Color('#4f7f8f') },
    uAmp: { value: 0.14 },
    uScale: { value: 300 },
  };

  /* ---------- aurora veil ---------- */
  const veils = [];
  const veilMat = (seed) =>
    new THREE.ShaderMaterial({
      uniforms: { ...U, uSeed: { value: seed } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uSeed; varying vec2 vUv;
        void main(){
          vUv = uv;
          vec3 p = position;
          float w = p.x * 0.07;
          p.y += (sin(w * 2.1 + uTime * 0.16 + uSeed) * 2.4 + sin(w * 4.7 - uTime * 0.11 + uSeed * 2.0) * 0.9) * (0.3 + uv.y * 0.9);
          p.z += sin(w * 1.3 + uTime * 0.09 + uSeed) * 3.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${HASH}
        uniform float uTime, uSeed, uK, uAmp, uCS; uniform vec3 uA, uB; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
          float side = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          float rays = vn(vec2(vUv.x * 34.0 + uSeed * 9.0, uTime * 0.12 + uSeed));
          float body = vn(vec2(vUv.x * 5.0 - uTime * 0.03, vUv.y * 2.0 + uSeed));
          float a = edge * side * (0.25 + 0.75 * rays * rays) * (0.4 + 0.9 * body);
          vec3 col = mix(uA, uB, clamp(vUv.x + (body - 0.5) * 0.6 + vUv.y * 0.25, 0.0, 1.0));
          if (uCS > 0.5) col = linearToOutputTexel(vec4(col, 1.0)).rgb;
          gl_FragColor = vec4(col, a * uAmp * uK);
        }`,
    });
  [[-31, 7.5, 0.0, 1.3], [-36, 4.5, 2.4, 2.9], [-41, 10, 4.1, 5.2]].forEach(([z, y, rx, seed]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(110, 17, 140, 1), veilMat(seed));
    m.position.set(0, y, z);
    m.rotation.x = -0.12 - rx * 0.02;
    m.frustumCulled = false;
    m.renderOrder = -8;
    veils.push(m);
    root.add(m);
  });

  /* ---------- constellation ---------- */
  const N = 84;
  const pts = [];
  for (let i = 0; i < N; i++) pts.push(new THREE.Vector3((Math.random() - 0.5) * 52, (Math.random() - 0.5) * 24 + 1, -22 - Math.random() * 12));
  const edges = [];
  const deg = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const near = [];
    for (let j = 0; j < N; j++) if (j !== i) near.push([pts[i].distanceTo(pts[j]), j]);
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) {
      const [d, j] = near[k];
      if (d < 6.5 && deg[i] < 3 && deg[j] < 4) {
        edges.push(i, j);
        deg[i]++;
        deg[j]++;
      }
    }
  }
  const lp = new Float32Array(edges.length * 3);
  edges.forEach((idx, n) => lp.set([pts[idx].x, pts[idx].y, pts[idx].z], n * 3));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd9cdb8, transparent: true, opacity: 0.09, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(lg, lineMat);

  const np = new Float32Array(N * 3);
  const ns = new Float32Array(N);
  pts.forEach((p, i) => {
    np.set([p.x, p.y, p.z], i * 3);
    ns[i] = Math.random();
  });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(np, 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(ns, 1));
  const nodeMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color('#f1e6d2') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uScale; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.4 + 0.6 * sin(uTime * (0.4 + aSeed) + aSeed * 50.0) * sin(uTime * 0.23 + aSeed * 11.0);
        gl_PointSize = (2.2 + aSeed * 3.4) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uK, uCS; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = uColor;
        if (uCS > 0.5) col = linearToOutputTexel(vec4(col, 1.0)).rgb;
        gl_FragColor = vec4(col, a * a * max(vA, 0.0) * uK);
      }`,
  });
  const nodes = new THREE.Points(pg, nodeMat);
  nodes.frustumCulled = false;
  const constel = new THREE.Group();
  constel.add(lines, nodes);
  root.add(constel);

  /* ---------- bokeh ---------- */
  const B = 18;
  const bp = new Float32Array(B * 3);
  const bs = new Float32Array(B);
  const bk = new Float32Array(B);
  for (let i = 0; i < B; i++) {
    bp.set([(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 15, -5 - Math.random() * 11], i * 3);
    bs[i] = 0.5 + Math.random();
    bk[i] = Math.random();
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  bg.setAttribute('aSize', new THREE.BufferAttribute(bs, 1));
  bg.setAttribute('aSeed', new THREE.BufferAttribute(bk, 1));
  const bokehMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uBokeh: { value: 0.07 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize, aSeed; uniform float uTime, uScale; varying float vS; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.045 + aSeed * 40.0) * 1.4;
        p.y += sin(uTime * 0.06 + aSeed * 23.0) * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vS = aSeed;
        vA = 0.55 + 0.45 * sin(uTime * 0.18 + aSeed * 30.0);
        gl_PointSize = aSize * 14.0 * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uA, uB; uniform float uK, uBokeh, uCS; varying float vS; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float disc = smoothstep(1.0, 0.9, d);
        float rim = smoothstep(0.62, 0.95, d) * 0.7 + 0.3;
        vec3 col = mix(uA, uB, vS);
        if (uCS > 0.5) col = linearToOutputTexel(vec4(col, 1.0)).rgb;
        gl_FragColor = vec4(col, disc * rim * vA * uBokeh * uK);
      }`,
  });
  const bokeh = new THREE.Points(bg, bokehMat);
  bokeh.frustumCulled = false;
  bokeh.renderOrder = -7;
  root.add(bokeh);

  const mats = [bokehMat, nodeMat, ...veils.map((v) => v.material)];
  const set = (fn) => mats.forEach(fn);
  const additive = (on) => set((m) => ((m.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending), (m.needsUpdate = true)));

  /* theme: [aurora A, aurora B, aurora strength, line colour, line opacity, node colour, bokeh strength, additive?, uCS] */
  const THEMES = {
    dark: ['#c9824f', '#4f7f8f', 0.3, '#d9cdb8', 0.05, '#f1e6d2', 0.13, true, 0],
    light: ['#e2b98a', '#b9c7c2', 0.26, '#7a6a55', 0.08, '#8a7660', 0.18, false, 0],
    rose: ['#f0a2bb', '#f1cf8a', 0.5, '#c99a3d', 0.15, '#b8862c', 0.26, false, 1],
  };
  function setTheme(theme, accent) {
    const T = THEMES[theme] || THEMES.dark;
    U.uA.value.set(T[0]);
    U.uB.value.set(T[1]);
    if (theme === 'dark' && accent) U.uA.value.copy(accent).multiplyScalar(0.85);
    U.uAmp.value = T[2];
    lineMat.color.set(T[3]);
    lineMat.opacity = T[4];
    lineMat.blending = T[7] ? THREE.AdditiveBlending : THREE.NormalBlending;
    nodeMat.uniforms.uColor.value.set(T[5]);
    bokehMat.uniforms.uBokeh.value = T[6];
    U.uCS.value = T[8];
    additive(T[7]);
  }
  setTheme('dark');

  return {
    root,
    setTheme,
    setScale: (h) => (U.uScale.value = h * 0.034),
    /* k: 0..1 visibility from the current mode */
    update(dt, t, k, pointer) {
      root.visible = k > 0.01;
      if (!root.visible) return;
      U.uTime.value = t;
      U.uK.value = k;
      constel.rotation.y = t * 0.006 + pointer.x * 0.05;
      constel.rotation.x = pointer.y * 0.025;
      constel.position.set(-pointer.x * 1.4, -pointer.y * 0.8, 0);
      bokeh.position.set(-pointer.x * 0.9, -pointer.y * 0.55, 0);
      veils.forEach((v, i) => (v.position.x = -pointer.x * (0.6 + i * 0.4)));
    },
  };
}
