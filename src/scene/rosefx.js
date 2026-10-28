/* Rosé Aurum ambience: curled 3D petals that tumble down, four-point gold
   sparkles that twinkle, and iridescent pearls that drift. Instanced and
   shader-driven, so hundreds of them cost almost nothing. */
import * as THREE from 'three';
import { damp } from './util.js';

const PETALS = 90;
const SPARKS = 420;
const PEARLS = 26;

export function createRoseFx(envMap) {
  const root = new THREE.Group();

  /* ---------- petals ---------- */
  const base = new THREE.PlaneGeometry(1, 1.35, 6, 8);
  const pg = new THREE.InstancedBufferGeometry();
  pg.index = base.index;
  pg.attributes.position = base.attributes.position;
  pg.attributes.uv = base.attributes.uv;
  const off = new Float32Array(PETALS * 3);
  const seed = new Float32Array(PETALS * 4);
  const col = new Float32Array(PETALS * 3);
  const PALETTE = ['#f9d5db', '#f4bccb', '#ec9fb6', '#fbe4dc', '#f4cfb8', '#efd89a'].map((c) => new THREE.Color(c));
  for (let i = 0; i < PETALS; i++) {
    off.set([(Math.random() - 0.5) * 22, Math.random() * 16 - 8, -Math.random() * 7 - 0.5], i * 3);
    seed.set([Math.random(), 0.5 + Math.random(), 0.4 + Math.random() * 1.4, 0.07 + Math.random() * 0.1], i * 4);
    const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    col.set([c.r, c.g, c.b], i * 3);
  }
  pg.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 3));
  pg.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 4));
  pg.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3));
  pg.instanceCount = PETALS;
  const pu = { uTime: { value: 0 }, uVis: { value: 0 } };
  const petals = new THREE.Mesh(
    pg,
    new THREE.ShaderMaterial({
      uniforms: pu,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 iOff; attribute vec4 iSeed; attribute vec3 iCol;
        uniform float uTime;
        varying vec3 vCol; varying vec2 vUv; varying float vShade;
        mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rz(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
        void main(){
          vUv = uv;
          vCol = iCol;
          float t = uTime;
          vec3 p = iOff;
          p.y = mod(p.y - t * (0.28 + iSeed.y * 0.3) + 8.0, 16.0) - 8.0;
          p.x += sin(t * 0.5 * iSeed.y + iSeed.x * 6.283) * 0.95 + p.y * 0.04;
          p.z += cos(t * 0.42 * iSeed.y + iSeed.x * 6.283) * 0.8;
          vec3 lp = position;
          // cup the petal and curl its tip
          lp.z += (lp.x * lp.x) * 1.4 - max(0.0, lp.y) * max(0.0, lp.y) * 0.5;
          lp *= iSeed.w * 3.0;
          float a = t * iSeed.z + iSeed.x * 6.283;
          mat3 R = rz(a * 0.6) * ry(a) * rx(a * 0.8 + 1.0);
          vec3 n = R * vec3(0.0, 0.0, 1.0);
          vShade = 0.65 + 0.35 * abs(dot(n, normalize(vec3(-0.4, 0.8, 0.5))));
          vec4 mv = modelViewMatrix * vec4(p + R * lp, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uVis;
        varying vec3 vCol; varying vec2 vUv; varying float vShade;
        void main(){
          vec2 q = (vUv - 0.5) * vec2(1.7, 1.0);
          float d = length(q * vec2(1.0, 0.82)) ;
          float shape = smoothstep(0.52, 0.44, d - 0.08 * (vUv.y - 0.5));
          if (shape < 0.02) discard;
          // soft vein + warm edge
          float vein = 0.06 * sin(vUv.x * 40.0) * (1.0 - vUv.y);
          vec3 c = vCol * vShade + vein + vec3(0.1, 0.03, 0.02) * (1.0 - vUv.y);
          c = mix(c, vec3(1.0), smoothstep(0.35, 0.5, d) * 0.25);
          gl_FragColor = vec4(c, shape * uVis * 0.92);
        }`,
    })
  );
  petals.frustumCulled = false;
  root.add(petals);

  /* ---------- sparkles ---------- */
  const sp = new Float32Array(SPARKS * 3);
  const ss = new Float32Array(SPARKS * 2);
  for (let i = 0; i < SPARKS; i++) {
    sp.set([(Math.random() - 0.5) * 24, (Math.random() - 0.5) * 14, Math.random() * 12 - 7], i * 3);
    ss.set([Math.random(), Math.random()], i * 2);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 2));
  const su = { uTime: { value: 0 }, uVis: { value: 0 }, uScale: { value: 400 } };
  const sparks = new THREE.Points(
    sg,
    new THREE.ShaderMaterial({
      uniforms: su,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed; uniform float uTime, uScale; varying float vA; varying float vK;
        void main(){
          vec3 p = position;
          p.y += mod(uTime * (0.04 + aSeed.x * 0.06) + aSeed.y * 14.0, 14.0) - 7.0;
          p.x += sin(uTime * 0.2 + aSeed.y * 20.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = pow(0.5 + 0.5 * sin(uTime * (0.8 + aSeed.x * 2.2) + aSeed.y * 50.0), 3.0);
          float big = step(0.88, aSeed.x);
          gl_PointSize = ((2.2 + aSeed.y * 3.0) + big * 11.0) * uScale / -mv.z * (0.4 + tw * 0.9);
          vA = tw * (0.4 + aSeed.y * 0.6);
          vK = big;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uVis; varying float vA; varying float vK;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q);
          float core = smoothstep(0.16, 0.0, r);
          float armX = smoothstep(0.035, 0.0, abs(q.y)) * smoothstep(0.5, 0.0, abs(q.x));
          float armY = smoothstep(0.035, 0.0, abs(q.x)) * smoothstep(0.5, 0.0, abs(q.y));
          float star = clamp(core + armX + armY, 0.0, 1.0);
          vec3 gold = vec3(0.82, 0.55, 0.1);
          vec3 c = mix(gold, vec3(1.0, 0.97, 0.88), core);
          gl_FragColor = vec4(c, star * vA * uVis);
        }`,
    })
  );
  sparks.frustumCulled = false;
  root.add(sparks);

  /* ---------- pearls ---------- */
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff4f1, roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    sheen: 1, sheenColor: new THREE.Color('#ffc6d6'), iridescence: 0.7, iridescenceIOR: 1.4,
    envMap, envMapIntensity: 1.2, transparent: true,
  });
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 28, 20), pearlMat, PEARLS);
  pearls.frustumCulled = false;
  const pd = [];
  for (let i = 0; i < PEARLS; i++) pd.push({ x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 10, z: -Math.random() * 6 - 1.5, r: 0.04 + Math.pow(Math.random(), 2.4) * 0.15, p: Math.random() * 6.28, s: 0.3 + Math.random() * 0.5 });
  root.add(pearls);
  const dummy = new THREE.Object3D();

  let vis = 0;
  function update(dt, t, target, pointer, light) {
    vis = damp(vis, target, 2.5, dt);
    root.visible = vis > 0.01;
    if (!root.visible) return;
    pu.uTime.value = t;
    su.uTime.value = t;
    pu.uVis.value = vis;
    su.uVis.value = vis;
    pearlMat.opacity = vis;
    for (let i = 0; i < PEARLS; i++) {
      const d = pd[i];
      dummy.position.set(d.x + Math.sin(t * d.s + d.p) * 0.5 - pointer.x * 0.3 * (1 + d.z * 0.05), d.y + Math.cos(t * d.s * 0.8 + d.p) * 0.6 - pointer.y * 0.2, d.z);
      dummy.scale.setScalar(d.r * (0.7 + 0.3 * vis));
      dummy.updateMatrix();
      pearls.setMatrixAt(i, dummy.matrix);
    }
    pearls.instanceMatrix.needsUpdate = true;
    root.position.x = -pointer.x * 0.35;
    root.position.y = -pointer.y * 0.2;
  }
  function setScale(h) {
    su.uScale.value = h * 0.034;
  }

  return { root, update, setScale };
}
