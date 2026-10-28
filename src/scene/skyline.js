/* 3D contribution skyline: one tower per day, height = completion.
   Instanced (a full year is a single draw call), rises in with a stagger,
   hover-picking via raycaster. */
import * as THREE from 'three';
import { damp, clamp } from './util.js';

const MAX = 53 * 7;
const GAP = 0.27;

export function createSkyline(envMap) {
  const root = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3, envMap, envMapIntensity: 0.55 });
  const geo = new THREE.BoxGeometry(0.2, 1, 0.2);
  geo.translate(0, 0.5, 0); // base sits on y = 0
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.frustumCulled = false;
  root.add(mesh);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.92, metalness: 0, envMap, envMapIntensity: 0.15, transparent: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  floor.receiveShadow = true;
  root.add(floor);

  const grid = new THREE.GridHelper(40, 160, 0xffffff, 0xffffff);
  grid.material.transparent = true;
  grid.material.opacity = 0.035;
  grid.position.y = 0.001;
  root.add(grid);

  const key = new THREE.DirectionalLight(0xffe2c4, 2.0);
  key.position.set(-5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 24;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  root.add(key);
  const rim = new THREE.DirectionalLight(0x9fb8d0, 0.7);
  rim.position.set(6, 3, -5);
  root.add(rim);

  // today marker
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.2, 4),
    new THREE.MeshStandardMaterial({ color: 0xf2e8d8, emissive: 0xd9955f, emissiveIntensity: 1.2, roughness: 0.3 })
  );
  marker.rotation.x = Math.PI;
  marker.visible = false;
  root.add(marker);

  /* ---- data ---- */
  let days = [];
  let cols = 0;
  const cur = new Float32Array(MAX);
  const tgt = new Float32Array(MAX);
  const delay = new Float32Array(MAX);
  const pos = [];
  let t0 = 0;
  let hover = -1;
  let accentHue = 28;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let light = false;

  const colorFor = (d, i, hot) => {
    if (!d) return col.setHSL(0.08, 0.05, light ? 0.78 : 0.14);
    let h = accentHue / 360;
    let s = 0.5;
    let l = 0.5;
    if (d.status === 'frozen') {
      h = 0.57; s = 0.35; l = 0.62;
    } else if (d.status === 'broken' || (d.total && !d.done && d.closed)) {
      h = 0.02; s = 0.45; l = 0.32;
    } else if (!d.total) {
      h = 0.08; s = 0.04; l = light ? 0.74 : 0.2;
    } else {
      const r = d.ratio;
      // dark bronze -> copper -> warm gold: never washes out to white
      l = (light ? 0.34 : 0.2) + r * (light ? 0.26 : 0.36);
      s = 0.45 + r * 0.2;
      h = accentHue / 360 + (r >= 1 ? 0.025 : 0);
      if (r >= 1) { l = light ? 0.5 : 0.6; s = 0.7; }
    }
    col.setHSL(h, s, l);
    if (hot) col.offsetHSL(0, 0, 0.14);
    return col;
  };

  function paint() {
    for (let i = 0; i < days.length; i++) mesh.setColorAt(i, colorFor(days[i], i, i === hover));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function setData(list, ncols, hue, isLight) {
    days = list;
    cols = ncols;
    accentHue = hue;
    light = !!isLight;
    mesh.count = list.length;
    const rows = 7;
    const w = (cols - 1) * GAP;
    list.forEach((d, i) => {
      const c = Math.floor(i / rows);
      const r = i % rows;
      pos[i] = [c * GAP - w / 2, (r - 3) * GAP];
      const ratio = d && d.total ? d.ratio : 0;
      tgt[i] = d ? 0.05 + (d.status === 'frozen' ? 0.35 : ratio * 1.55) + (d.total ? 0.0 : -0.02) : 0.03;
      cur[i] = 0;
      delay[i] = c * 0.018 + r * 0.01;
    });
    t0 = 0;
    paint();
    // marker on the last tracked day
    const last = list.length - 1;
    marker.visible = last >= 0;
    root.userData.width = w + 0.4;
  }

  function pick(raycaster) {
    const hit = raycaster.intersectObject(mesh, false)[0];
    return hit && hit.instanceId != null ? hit.instanceId : -1;
  }
  function setHover(i) {
    if (i === hover) return;
    const old = hover;
    hover = i;
    if (old >= 0 && days[old]) mesh.setColorAt(old, colorFor(days[old], old, false));
    if (i >= 0 && days[i]) mesh.setColorAt(i, colorFor(days[i], i, true));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function worldOf(i) {
    return new THREE.Vector3(pos[i][0], cur[i], pos[i][1]).applyMatrix4(root.matrixWorld);
  }

  function update(dt, t) {
    t0 += dt;
    let moving = false;
    for (let i = 0; i < days.length; i++) {
      const target = t0 > delay[i] ? tgt[i] * (i === hover ? 1.12 : 1) : 0;
      const v = damp(cur[i], target, 5.5, dt);
      if (Math.abs(v - cur[i]) > 0.0004) moving = true;
      cur[i] = v;
      dummy.position.set(pos[i][0], 0, pos[i][1]);
      dummy.scale.set(1, Math.max(0.001, v), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (marker.visible && days.length) {
      const i = days.length - 1;
      marker.position.set(pos[i][0], cur[i] + 0.3 + Math.sin(t * 2.4) * 0.05, pos[i][1]);
    }
    return moving;
  }

  let gridBase = 0.035;
  function setWeight(w) {
    floorMat.opacity = w;
    grid.material.opacity = gridBase * w;
  }
  function settle() {
    for (let i = 0; i < days.length; i++) cur[i] = tgt[i];
    t0 = 999;
  }

  function setTheme(isLight) {
    light = !!isLight;
    floorMat.color.set(isLight ? 0xd9d1c3 : 0x0d0b09);
    gridBase = isLight ? 0.08 : 0.035;
    grid.material.opacity = gridBase;
    grid.material.color.set(isLight ? 0x000000 : 0xffffff);
    paint();
  }

  return { root, mesh, setWeight, settle, setData, pick, setHover, worldOf, update, setTheme, key, rim, get days() { return days; } };
}
