/* The Ascension Core: an armillary sphere.
   - glass gem with a living ember inside (brightness = today's progress)
   - three tilted metal rings; the outer one carries a tick scale
   - a bead orbit for today's quests and a ring of 7 beads for the week */
import * as THREE from 'three';
import { glowTexture, damp, clamp } from './util.js';

const TAU = Math.PI * 2;

export function createCore(envMap) {
  const root = new THREE.Group();
  const tilt = new THREE.Group(); // gentle idle precession
  root.add(tilt);

  const accent = new THREE.Color('#d9955f');
  const brick = new THREE.Color('#b5483a');

  /* ---- glass gem ---- */
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.14,
    metalness: 0,
    transmission: 1,
    thickness: 0.55,
    ior: 1.32,
    attenuationColor: accent.clone(),
    attenuationDistance: 0.9,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    envMap,
    envMapIntensity: 0.55,
    flatShading: true,
    specularIntensity: 1,
  });
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), glass);
  tilt.add(gem);

  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.86, 1)),
    new THREE.LineBasicMaterial({ color: 0xe9dfd0, transparent: true, opacity: 0.22 })
  );
  tilt.add(cage);

  /* ---- ember ---- */
  const emberMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: accent.clone(), emissiveIntensity: 1.6, roughness: 0.4 });
  const ember = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 3), emberMat);
  tilt.add(ember);
  const light = new THREE.PointLight(accent.clone(), 3, 7, 1.8);
  tilt.add(light);

  const haloTex = glowTexture(256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: accent.clone(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(6.5);
  halo.position.z = -3.2;
  root.add(halo);

  /* ---- metal rings ---- */
  const metal = new THREE.MeshStandardMaterial({ color: 0xcfc4b0, metalness: 1, roughness: 0.3, envMap, envMapIntensity: 0.95 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x8a7f6f, metalness: 1, roughness: 0.4, envMap, envMapIntensity: 0.8 });
  const mkRing = (R, tube, mat, tiltX, tiltY) => {
    const holder = new THREE.Group();
    holder.rotation.set(tiltX, tiltY, 0);
    const spin = new THREE.Group();
    holder.add(spin);
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(R, tube, 16, 280), mat));
    tilt.add(holder);
    return { holder, spin };
  };
  const rA = mkRing(1.18, 0.011, metal, 1.15, 0.2);
  const rB = mkRing(1.52, 0.016, darkMetal, 0.35, -0.55);
  const rC = mkRing(1.92, 0.01, metal, -0.7, 0.35);

  /* tick scale on ring B */
  const TICKS = 96;
  const tickGeo = new THREE.BoxGeometry(0.006, 1, 0.012);
  const ticks = new THREE.InstancedMesh(tickGeo, metal, TICKS);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * TAU;
    const long = i % 8 === 0;
    const len = long ? 0.11 : i % 4 === 0 ? 0.07 : 0.04;
    e.set(0, 0, a);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * 1.52, Math.sin(a) * 1.52, 0), q, new THREE.Vector3(1, len, 1));
    ticks.setMatrixAt(i, m4);
  }
  rB.spin.add(ticks);

  /* ---- quest beads (orbit A) ---- */
  const MAX_Q = 14;
  const beadGeo = new THREE.IcosahedronGeometry(0.06, 2);
  const beads = [];
  for (let i = 0; i < MAX_Q; i++) {
    const m = new THREE.MeshPhysicalMaterial({ color: 0x1b1714, roughness: 0.15, metalness: 0.2, clearcoat: 1, emissive: accent.clone(), emissiveIntensity: 0, envMap, envMapIntensity: 1 });
    const mesh = new THREE.Mesh(beadGeo, m);
    mesh.visible = false;
    rA.spin.add(mesh);
    beads.push({ mesh, glow: 0, tgt: 0 });
  }

  /* ---- week beads (orbit C) ---- */
  const weekBeads = [];
  const wGeo = new THREE.SphereGeometry(0.05, 24, 16);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.3, metalness: 0.6, emissive: accent.clone(), emissiveIntensity: 0, envMap });
    const mesh = new THREE.Mesh(wGeo, m);
    const a = -Math.PI / 2 + (i / 7) * TAU;
    mesh.position.set(Math.cos(a) * 1.92, Math.sin(a) * 1.92, 0);
    rC.spin.add(mesh);
    weekBeads.push({ mesh, glow: 0, tgt: 0, today: false, kind: 'future' });
  }

  /* ---- shockwave pool ---- */
  const waves = [];
  const waveGeo = new THREE.RingGeometry(0.98, 1, 160);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.MeshBasicMaterial({ color: accent.clone(), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(waveGeo, m);
    mesh.visible = false;
    root.add(mesh);
    waves.push({ mesh, t: 1, dur: 1.4, from: 0.8, to: 4 });
  }

  /* ---- dynamic state ---- */
  const S = {
    progress: 0, // 0..1 today
    hp: 1,
    dead: false,
    energy: 0.85, // smoothed ember
    spinBoost: 0,
    shake: 0,
    flash: 0,
    sad: 0, // 0..1 damage tint
    hue: accent.clone(),
  };

  function setAccent(color) {
    accent.copy(color);
    glass.attenuationColor.copy(accent);
    halo.material.color.copy(accent);
    light.color.copy(accent);
    waves.forEach((w) => w.mesh.material.color.copy(accent));
  }

  function setQuests(list) {
    beads.forEach((b, i) => {
      const item = list[i];
      b.mesh.visible = !!item;
      if (!item) return;
      const a = (i / Math.max(1, Math.min(list.length, MAX_Q))) * TAU;
      b.mesh.position.set(Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0);
      b.tgt = item.done ? 1 : 0;
      if (item.hue != null) b.mesh.material.emissive.setHSL(item.hue / 360, 0.45, 0.6);
    });
  }

  const KIND_COLOR = { kept: new THREE.Color('#e6b98b'), frozen: new THREE.Color('#9db8cc'), broken: new THREE.Color('#9e4538'), open: new THREE.Color('#e9dfd0'), rest: new THREE.Color('#5a5249'), future: new THREE.Color('#2a2520') };
  function setWeek(list) {
    weekBeads.forEach((b, i) => {
      const d = list[i] || { kind: 'future' };
      b.kind = d.kind;
      b.today = !!d.today;
      b.tgt = d.kind === 'kept' || d.kind === 'frozen' || d.kind === 'broken' ? 1 : d.kind === 'open' ? 0.35 : 0;
      b.mesh.material.emissive.copy(KIND_COLOR[d.kind] || KIND_COLOR.future);
    });
  }

  function setState(s) {
    if (s.progress != null) S.progress = s.progress;
    if (s.hp != null) S.hp = s.hp;
    if (s.dead != null) S.dead = s.dead;
  }

  function pulse(kind) {
    const w = waves.find((x) => x.t >= 1) || waves[0];
    w.t = 0;
    w.mesh.visible = true;
    if (kind === 'level') {
      S.spinBoost = 5;
      S.flash = 1;
      w.dur = 2.4;
      w.to = 4.6;
    } else if (kind === 'damage') {
      S.shake = 1;
      S.sad = 1;
      w.mesh.material.color.copy(brick);
      w.dur = 1;
      w.to = 3;
    } else if (kind === 'death') {
      S.shake = 1.6;
      S.sad = 1;
    } else if (kind === 'perfect') {
      S.spinBoost = 3;
      S.flash = 0.8;
      w.dur = 2;
      w.to = 4;
    } else {
      S.spinBoost = Math.max(S.spinBoost, kind === 'crit' ? 3.5 : 1.6);
      S.flash = Math.max(S.flash, kind === 'crit' ? 0.7 : 0.35);
      w.dur = 1.2;
      w.to = 2.6;
    }
    if (kind !== 'damage' && kind !== 'death') w.mesh.material.color.copy(accent);
  }

  const tmp = new THREE.Color();
  function update(dt, t, pointer) {
    // energy follows progress; dead = dark
    const target = S.dead ? 0.02 : 0.85 + S.progress * 1.0;
    S.energy = damp(S.energy, target, 2.2, dt);
    S.sad = damp(S.sad, 0, 1.4, dt);
    S.flash = damp(S.flash, 0, 3, dt);
    S.shake = damp(S.shake, 0, 4, dt);
    S.spinBoost = damp(S.spinBoost, 0, 1.2, dt);

    const lowHp = clamp((0.45 - S.hp) / 0.45, 0, 1);
    const flicker = 1 + Math.sin(t * 11) * 0.05 * lowHp + (Math.random() - 0.5) * 0.12 * lowHp;
    tmp.copy(accent).lerp(brick, Math.max(S.sad * 0.8, lowHp * 0.55));
    emberMat.emissive.copy(tmp);
    emberMat.emissiveIntensity = (S.energy * 1.7 + S.flash * 2) * flicker;
    light.color.copy(tmp);
    light.intensity = (S.energy * 5 + S.flash * 8) * flicker;
    halo.material.color.copy(tmp);
    halo.material.opacity = clamp(0.03 + S.energy * 0.12 + S.flash * 0.2, 0, 0.5);
    ember.scale.setScalar(0.85 + S.energy * 0.22 + Math.sin(t * 2.2) * 0.02);

    const sp = 1 + S.spinBoost;
    gem.rotation.y += dt * 0.12 * sp;
    gem.rotation.x = Math.sin(t * 0.25) * 0.25;
    cage.rotation.y -= dt * 0.07 * sp;
    cage.rotation.z += dt * 0.04;
    ember.rotation.y -= dt * 0.4;
    rA.spin.rotation.z += dt * 0.16 * sp;
    rB.spin.rotation.z -= dt * 0.1 * sp;
    rC.spin.rotation.z += dt * 0.05 * sp;
    rA.holder.rotation.y += dt * 0.03;
    rB.holder.rotation.x += dt * 0.02;

    // idle precession + pointer follow
    tilt.rotation.x = damp(tilt.rotation.x, pointer.y * 0.28, 2.4, dt);
    tilt.rotation.y = damp(tilt.rotation.y, pointer.x * 0.4 + Math.sin(t * 0.2) * 0.1, 2.4, dt);
    root.position.x += (Math.random() - 0.5) * S.shake * 0.06;
    root.position.y += (Math.random() - 0.5) * S.shake * 0.06;

    beads.forEach((b, i) => {
      if (!b.mesh.visible) return;
      b.glow = damp(b.glow, b.tgt, 4, dt);
      b.mesh.material.emissiveIntensity = b.glow * (1.8 + Math.sin(t * 2 + i) * 0.25);
      b.mesh.scale.setScalar(0.8 + b.glow * 0.45);
    });
    weekBeads.forEach((b, i) => {
      b.glow = damp(b.glow, b.tgt, 4, dt);
      const pulseToday = b.today ? 0.5 + Math.sin(t * 3) * 0.25 : 0;
      b.mesh.material.emissiveIntensity = b.glow * 1.8 + pulseToday;
      b.mesh.scale.setScalar(b.today ? 1.5 + Math.sin(t * 3) * 0.1 : 1);
    });

    waves.forEach((w) => {
      if (w.t >= 1) {
        w.mesh.visible = false;
        return;
      }
      w.t = Math.min(1, w.t + dt / w.dur);
      const k = 1 - Math.pow(1 - w.t, 3);
      w.mesh.scale.setScalar(w.from + (w.to - w.from) * k);
      w.mesh.material.opacity = (1 - w.t) * 0.38;
    });
  }

  /* battery-saver look: no transmission pass, still warm and translucent */
  function lite() {
    glass.transmission = 0;
    glass.transparent = true;
    glass.opacity = 0.62;
    glass.color.set(0x7a5636);
    glass.roughness = 0.2;
    glass.metalness = 0.2;
    glass.needsUpdate = true;
  }

  return { root, lite, update, setAccent, setQuests, setWeek, setState, pulse, glass, S };
}
