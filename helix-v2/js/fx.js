// HELIX · effetti: gocce di sangue fisiche, nebulizzazione, decal (gocce/pozze/schizzi su muri) in GLSL,
// fori di proiettile, onde d'urto, bruciature, traccianti
import { THREE, V3, UP, S, G, GFX, scene, camera, renderer, rand, clamp, SHADERS, obstacleMeshes, _c, canvasTex } from './core.js';
import { LIGHT, sunDir } from './world.js';

const gq = () => GFX[S.gfx];
const _o = new THREE.Object3D(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new V3(), _p = new V3(), _a = new V3(), _b = new V3();

/* ---------- 1. gocce fisiche (InstancedMesh, allungate nella direzione del moto) ---------- */
const DMAX = 1800;
let drops, D;
/* ---------- 2. particelle morbide (shader GLSL) ---------- */
const MMAX = 1400;
let mist, glow, MS, GL;
/* ---------- 3. decal di sangue ---------- */
const DECMAX = 900, POOLMAX = 16;
let decals, pools, decalMat, decHead = 0, poolHead = 0;
/* ---------- 4. fori ---------- */
const HOLES = 400; let holeMesh, holeHead = 0;
const shocks = [], tracers = [], scorches = [];
// luci dinamiche pre-allocate: aggiungere/togliere luci forza la ricompilazione di tutti gli shader (scatti)
const LIGHTS = []; let lightHead = 0;

function softSystem(blending) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MMAX * 3), size = new Float32Array(MMAX), alpha = new Float32Array(MMAX), col = new Float32Array(MMAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 500 } }, vertexShader: SHADERS['mist.vert'], fragmentShader: SHADERS['mist.frag'], transparent: true, depthWrite: false, blending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return { pts, geo, mat, pos, size, alpha, col, P: new Array(MMAX).fill(null), head: 0 };
}

export function initFx() {
  // gocce
  const dg = new THREE.SphereGeometry(1, 7, 5);
  const dm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .18, metalness: .05 });
  drops = new THREE.InstancedMesh(dg, dm, DMAX); drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DMAX * 3), 3);
  drops.count = DMAX; drops.frustumCulled = false; drops.castShadow = false; scene.add(drops);
  _o.scale.set(0, 0, 0); _o.updateMatrix(); for (let i = 0; i < DMAX; i++) drops.setMatrixAt(i, _o.matrix);
  D = { P: new Array(DMAX).fill(null), head: 0 };
  MS = softSystem(THREE.NormalBlending); GL = softSystem(THREE.AdditiveBlending); mist = MS; glow = GL;
  // decal
  decalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSunDir: { value: sunDir }, uSunCol: { value: LIGHT.sunCol }, uAmb: { value: LIGHT.amb } },
    vertexShader: SHADERS['decal.vert'], fragmentShader: SHADERS['decal.frag'], transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
  });
  const mkDecal = (n) => {
    const g = new THREE.PlaneGeometry(2, 2);
    for (const a of ['aSeed', 'aBorn', 'aKind', 'aAngle']) g.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    const m = new THREE.InstancedMesh(g, decalMat, n); m.count = 0; m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m;
  };
  decals = mkDecal(DECMAX); pools = mkDecal(POOLMAX); pools.renderOrder = 1;
  holeMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(.012, 8), new THREE.MeshBasicMaterial({ color: '#0b0b0b', polygonOffset: true, polygonOffsetFactor: -4 }), HOLES);
  holeMesh.count = 0; scene.add(holeMesh);
  for (let i = 0; i < 3; i++) { const L = new THREE.PointLight('#ffffff', 0, 12, 2); L.userData = { t: 0, dur: 0, i0: 0, follow: null }; scene.add(L); LIGHTS.push(L); }
}
// lampo di luce che decade (esplosioni, impatti) o che segue un oggetto per 'dur' secondi
export function fxLight(pos, col, intensity, dur, follow = null, dist = 12) {
  const L = LIGHTS[lightHead]; lightHead = (lightHead + 1) % LIGHTS.length;
  L.color.set(col); L.position.copy(pos); L.distance = dist; L.intensity = intensity; Object.assign(L.userData, { t: 0, dur, i0: intensity, follow }); return L;
}

export function resetFx() {
  D.P.fill(null); _o.scale.set(0, 0, 0); _o.updateMatrix(); for (let i = 0; i < DMAX; i++) drops.setMatrixAt(i, _o.matrix); drops.instanceMatrix.needsUpdate = true;
  for (const s of [MS, GL]) { s.P.fill(null); s.alpha.fill(0); s.geo.attributes.aAlpha.needsUpdate = true; }
  decals.count = 0; decHead = 0; pools.count = 0; poolHead = 0; holeMesh.count = 0; holeHead = 0;
  for (const s of shocks) scene.remove(s.mesh); shocks.length = 0;
  for (const s of scorches) scene.remove(s); scorches.length = 0;
  for (const t of tracers) scene.remove(t.mesh); tracers.length = 0;
  for (const L of LIGHTS) { L.intensity = 0; L.userData.dur = 0; }
}

/* ===== emissione gocce =====
   o: {col, size:[min,max], blood:true, drag, n, spread, speed} */
export function emitDrops(pos, dir, n, spread, speed, o = {}) {
  n = Math.round(n * (o.blood !== false ? gq() : 1)); _c.set(o.col || '#5a0606');
  for (let i = 0; i < n; i++) {
    const id = D.head; D.head = (D.head + 1) % DMAX;
    const v = new V3(dir.x + rand(-spread, spread), dir.y + rand(-spread, spread), dir.z + rand(-spread, spread)).normalize().multiplyScalar(speed * rand(.25, 1));
    const sz = rand(...(o.size || [.003, .009]));
    D.P[id] = { p: pos.clone().addScaledVector(v, rand(0, .01)), v, life: rand(.8, 2.2), sz, blood: o.blood !== false, drag: o.drag ?? .5 };
    const k = rand(.75, 1.1); drops.setColorAt(id, _c.clone().multiplyScalar(k));
  }
  drops.instanceColor.needsUpdate = true;
}
/* ===== particelle morbide ===== */
export function emitSoft(kind, pos, dir, n, spread, speed, o = {}) {
  const sys = kind === 'glow' ? GL : MS; _c.set(o.col || '#6a0a0a');
  for (let i = 0; i < n; i++) {
    const id = sys.head; sys.head = (sys.head + 1) % MMAX;
    const v = new V3(dir.x + rand(-spread, spread), dir.y + rand(-spread, spread), dir.z + rand(-spread, spread)).multiplyScalar(speed * rand(.3, 1));
    const life = rand(...(o.life || [.4, 1.1]));
    sys.P[id] = { p: pos.clone(), v, life, life0: life, s0: rand(...(o.size || [.03, .08])), grow: o.grow ?? 2.5, drag: o.drag ?? 3, g: o.g ?? .3, a0: o.alpha ?? .6 };
    sys.col[id * 3] = _c.r; sys.col[id * 3 + 1] = _c.g; sys.col[id * 3 + 2] = _c.b;
  }
  sys.geo.attributes.aColor.needsUpdate = true;
}

/* ===== decal ===== */
function orientDecal(p, n, size, angleMode) {
  const z = _a.copy(n).normalize(); let y = _b.copy(UP).addScaledVector(z, -UP.dot(z));
  if (y.lengthSq() < 1e-4) y.set(0, 0, 1).addScaledVector(z, -z.z); y.normalize();
  const x = _p.crossVectors(y, z).normalize();
  _m.makeBasis(x.clone(), y.clone(), z.clone()); _q.setFromRotationMatrix(_m);
  _o.position.copy(p).addScaledVector(z, .003 + Math.random() * .002); _o.quaternion.copy(_q); _o.scale.set(size, size, 1); _o.updateMatrix();
  return { x: x.clone(), y: y.clone() };
}
export function addDecal(p, n, size, kind = 0, travel = null) {
  const i = decHead; decHead = (decHead + 1) % DECMAX;
  const basis = orientDecal(p, n, size);
  decals.setMatrixAt(i, _o.matrix);
  let ang = Math.random() * 6.28;
  if (travel) { const tx = travel.dot(basis.x), ty = travel.dot(basis.y); ang = Math.atan2(-ty, -tx); }
  const at = decals.geometry.attributes;
  at.aSeed.setX(i, Math.random()); at.aBorn.setX(i, G.t); at.aKind.setX(i, kind); at.aAngle.setX(i, ang);
  for (const k of ['aSeed', 'aBorn', 'aKind', 'aAngle']) at[k].needsUpdate = true;
  decals.count = Math.max(decals.count, decHead === 0 ? DECMAX : decHead); decals.instanceMatrix.needsUpdate = true;
}
// pozza di sangue sotto un corpo: restituisce l'indice per aggiornarne il raggio
export function newPool(pos) {
  const i = poolHead; poolHead = (poolHead + 1) % POOLMAX;
  const at = pools.geometry.attributes; at.aSeed.setX(i, Math.random()); at.aBorn.setX(i, G.t); at.aKind.setX(i, 2); at.aAngle.setX(i, 0);
  for (const k of ['aSeed', 'aBorn', 'aKind', 'aAngle']) at[k].needsUpdate = true;
  pools.count = Math.max(pools.count, poolHead === 0 ? POOLMAX : poolHead); setPool(i, pos, .01); return i;
}
export function setPool(i, pos, r) {
  _o.position.set(pos.x, .011, pos.z); _o.rotation.set(-Math.PI / 2, 0, 0); _o.scale.set(r, r, 1); _o.updateMatrix(); pools.setMatrixAt(i, _o.matrix); pools.instanceMatrix.needsUpdate = true;
}
const _rc = new THREE.Raycaster();
// schizzi su muri/oggetti vicini lungo la direzione del getto (es. foro d'uscita)
export function splatter(p, dir, n = 3, spread = .25, maxDist = 3, size = .25) {
  n = Math.max(1, Math.round(n * gq()));
  for (let i = 0; i < n; i++) {
    const d = dir.clone().add(new V3(rand(-spread, spread), rand(-spread, spread) - .08, rand(-spread, spread))).normalize();
    _rc.set(p, d); _rc.far = maxDist; const h = _rc.intersectObjects(obstacleMeshes, false)[0];
    if (h) { const nn = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : d.clone().negate(); addDecal(h.point, nn, size * rand(.5, 1.2) * (1 - h.distance / maxDist * .5), 1, d); }
    else if (d.y < 0) { const t = -p.y / d.y; if (t < maxDist) addDecal(p.clone().addScaledVector(d, t), UP, size * rand(.4, 1), 1, d); }
  }
}
export function addHole(p, n) {
  _o.position.copy(p).addScaledVector(n, .004); _o.lookAt(_p.copy(p).add(n)); _o.scale.set(1, 1, 1); _o.updateMatrix();
  holeMesh.setMatrixAt(holeHead, _o.matrix); holeHead = (holeHead + 1) % HOLES; holeMesh.count = Math.max(holeMesh.count, holeHead); holeMesh.instanceMatrix.needsUpdate = true;
}

/* ===== onde d'urto / lampi ===== */
let shockGeo;
export function addShock(pos, r0, r1, dur, col = '#9fd0ff') {
  shockGeo = shockGeo || new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(col) } }, vertexShader: SHADERS['rasengan.vert'], fragmentShader: SHADERS['shock.frag'], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(shockGeo, mat); m.position.copy(pos); m.scale.setScalar(r0); m.renderOrder = 8; scene.add(m);
  shocks.push({ mesh: m, t: 0, dur, r0, r1 });
}
// tracciante (scia luminosa breve)
export function addTracer(a, b, col = '#ffd890', w = .006) {
  const len = a.distanceTo(b); if (len < .5) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, 1, 5, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, _p.copy(b).sub(a).normalize()); m.scale.set(1, len, 1); scene.add(m);
  tracers.push({ mesh: m, t: 0 });
}
// bruciatura a terra (spirale per il Rasengan, raggiera per la granata)
export function addScorch(pos, r, spiral) {
  const tex = canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(10,8,6,.9)'); gr.addColorStop(.5, 'rgba(25,20,15,.6)'); gr.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(5,5,5,.7)';
    if (spiral) { g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); for (let t = 0; t < 1; t += .01) { const a = t * 9 + k * 1.57, rr = t * s * .46; g.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr); } g.stroke(); } }
    else { g.lineWidth = 2; for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s / 2 + Math.cos(a) * s * rand(.25, .5), s / 2 + Math.sin(a) * s * rand(.25, .5)); g.stroke(); } }
  }, false);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(pos.x, .013, pos.z); m.receiveShadow = true; scene.add(m); scorches.push(m);
}

/* ===== aggiornamento ===== */
export function updateFx(dt, rdt) {
  decalMat.uniforms.uTime.value = G.t;
  // gocce
  const up = new V3();
  for (let i = 0; i < DMAX; i++) {
    const q = D.P[i]; if (!q) continue;
    q.life -= dt; q.v.y -= 9.81 * dt; q.v.multiplyScalar(1 - dt * q.drag); q.p.addScaledVector(q.v, dt);
    if (q.p.y < .006 || q.life <= 0) {
      if (q.blood && q.p.y < .05 && Math.random() < .55 * gq()) {
        const sp = Math.hypot(q.v.x, q.v.z); addDecal(new V3(q.p.x, 0, q.p.z), UP, q.sz * rand(2.5, 5) + sp * .004, sp > 2 ? 1 : 0, sp > 2 ? new V3(q.v.x, 0, q.v.z).normalize() : null);
      }
      D.P[i] = null; _o.scale.set(0, 0, 0); _o.position.set(0, -50, 0); _o.updateMatrix(); drops.setMatrixAt(i, _o.matrix); continue;
    }
    const sp = q.v.length(); up.copy(q.v).divideScalar(sp || 1);
    _o.position.copy(q.p); _o.quaternion.setFromUnitVectors(UP, up); const st = 1 + Math.min(4, sp * .35);
    _o.scale.set(q.sz, q.sz * st, q.sz); _o.updateMatrix(); drops.setMatrixAt(i, _o.matrix);
  }
  drops.instanceMatrix.needsUpdate = true;
  // particelle morbide
  const scale = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  for (const s of [MS, GL]) {
    s.mat.uniforms.uScale.value = scale;
    for (let i = 0; i < MMAX; i++) {
      const q = s.P[i]; if (!q) continue; q.life -= dt;
      if (q.life <= 0) { s.P[i] = null; s.alpha[i] = 0; continue; }
      q.v.y -= 9.81 * q.g * dt; q.v.multiplyScalar(Math.max(0, 1 - dt * q.drag)); q.p.addScaledVector(q.v, dt);
      const k = 1 - q.life / q.life0; s.pos[i * 3] = q.p.x; s.pos[i * 3 + 1] = q.p.y; s.pos[i * 3 + 2] = q.p.z;
      s.size[i] = q.s0 * (1 + k * q.grow); s.alpha[i] = q.a0 * (1 - k) * Math.min(1, k * 8 + .2);
    }
    s.geo.attributes.position.needsUpdate = true; s.geo.attributes.aSize.needsUpdate = true; s.geo.attributes.aAlpha.needsUpdate = true;
  }
  // onde d'urto
  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i]; s.t += dt / s.dur; if (s.t >= 1) { scene.remove(s.mesh); s.mesh.material.dispose(); shocks.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - s.t, 3); s.mesh.scale.setScalar(s.r0 + (s.r1 - s.r0) * e); s.mesh.material.uniforms.uT.value = s.t;
  }
  for (const L of LIGHTS) { const u = L.userData; if (u.dur <= 0) continue; u.t += rdt; if (u.follow) L.position.copy(u.follow.getWorldPosition(_s)); L.intensity = u.t >= u.dur ? 0 : u.follow ? u.i0 : u.i0 * (1 - u.t / u.dur); if (u.t >= u.dur) u.dur = 0; }
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t += rdt; t.mesh.material.opacity = .55 * (1 - t.t / .06); if (t.t > .06) { scene.remove(t.mesh); t.mesh.geometry.dispose(); tracers.splice(i, 1); } }
}
