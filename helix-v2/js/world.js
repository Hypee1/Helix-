// HELIX · mondo: texture procedurali, capannone, parcheggio, cielo GLSL, ciclo giorno/notte, collisioni
import { THREE, V3, S, scene, renderer, rand, clamp, canvasTex, noise, obstacles, obstacleMeshes, SHADERS, camera } from './core.js';

export const TX = {};
export const M = {};
export const streetLights = [];
export const sunDir = new V3();
export let sun, hemi, sky, skyMat;

function makeTextures() {
  Object.assign(TX, {
    asphalt: canvasTex(512, (g, s) => { noise(g, s, '#3c3d3f', 34, 60, '#000', .12); g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); } g.stroke(); } }),
    gravel: canvasTex(512, (g, s) => { noise(g, s, '#857e72', 30); for (let i = 0; i < 5000; i++) { const v = rand(90, 190) | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, rand(.8, 2.6), 0, 7); g.fill(); } }),
    grass: canvasTex(512, (g, s) => { noise(g, s, '#45552a', 26, 40, '#2a3416', .25); for (let i = 0; i < 9000; i++) { const x = Math.random() * s, y = Math.random() * s; g.strokeStyle = `rgba(${rand(60, 110) | 0},${rand(85, 130) | 0},${rand(30, 55) | 0},.55)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - rand(3, 7)); g.stroke(); } }),
    concrete: canvasTex(512, (g, s) => { noise(g, s, '#8b8780', 22, 50, '#3d3a33', .12); g.strokeStyle = 'rgba(40,40,40,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); }),
    corr: canvasTex(256, (g, s) => { noise(g, s, '#ffffff', 10); for (let x = 0; x < s; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(x, 0, 16, s); } for (let i = 0; i < 25; i++) { g.globalAlpha = Math.random() * .25; g.fillStyle = '#6b3a1a'; g.beginPath(); g.ellipse(Math.random() * s, Math.random() * s, rand(3, 14), rand(6, 40), 0, 0, 7); g.fill(); } g.globalAlpha = 1; }),
    fence: canvasTex(128, (g, s) => { g.clearRect(0, 0, s, s); g.strokeStyle = '#b9bec2'; g.lineWidth = 2.2; for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke(); } }),
    bark: canvasTex(128, (g, s) => { noise(g, s, '#4a3a2c', 40); g.strokeStyle = 'rgba(20,14,8,.6)'; for (let i = 0; i < 30; i++) { const x = Math.random() * s; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rand(-6, 6), s); g.stroke(); } }),
    leaves: canvasTex(256, (g, s) => { noise(g, s, '#3b4a22', 50, 80, '#1d2810', .4); }),
  });
  Object.assign(M, {
    asphalt: new THREE.MeshStandardMaterial({ map: TX.asphalt, roughness: .92 }),
    gravel: new THREE.MeshStandardMaterial({ map: TX.gravel, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: TX.grass, roughness: 1 }),
    concrete: new THREE.MeshStandardMaterial({ map: TX.concrete, roughness: .95 }),
    wallMetal: new THREE.MeshStandardMaterial({ map: TX.corr, color: '#7b8187', roughness: .7, metalness: .35 }),
    roof: new THREE.MeshStandardMaterial({ map: TX.corr, color: '#5d6166', roughness: .8, metalness: .3 }),
    line: new THREE.MeshStandardMaterial({ color: '#d9d6c8', roughness: .8 }),
    fence: new THREE.MeshStandardMaterial({ map: TX.fence, transparent: true, alphaTest: .4, side: THREE.DoubleSide, metalness: .6, roughness: .5 }),
    post: new THREE.MeshStandardMaterial({ color: '#8e9296', metalness: .7, roughness: .45 }),
    glass: new THREE.MeshStandardMaterial({ color: '#1b2228', roughness: .12, metalness: .6 }),
    tire: new THREE.MeshStandardMaterial({ color: '#151515', roughness: .9 }),
    bark: new THREE.MeshStandardMaterial({ map: TX.bark, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ map: TX.leaves, roughness: 1, color: '#9ab07a' }),
    lamp: new THREE.MeshStandardMaterial({ color: '#333', emissive: '#ffcf8a', emissiveIntensity: 0 }),
  });
}

function scaleUV(geo, w, h, d, ts) { const uv = geo.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); } uv.needsUpdate = true; }
export function box(x, y, z, w, h, d, mat, o = {}) {
  const geo = new THREE.BoxGeometry(w, h, d); if (o.ts) scaleUV(geo, w, h, d, o.ts);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y + h / 2, z); if (o.ry) m.rotation.y = o.ry; m.castShadow = o.cast !== false; m.receiveShadow = true; scene.add(m);
  if (!o.nocol) { const hw = o.ry ? d / 2 : w / 2, hd = o.ry ? w / 2 : d / 2; obstacles.push({ min: new V3(x - hw, y, z - hd), max: new V3(x + hw, y + h, z + hd), surf: o.surf || 'concrete' }); m.userData.surf = o.surf || 'concrete'; obstacleMeshes.push(m); }
  return m;
}
function plane(x, z, w, d, mat, y, ts) { const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++)uv.setXY(i, uv.getX(i) * w / ts, uv.getY(i) * d / ts); const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }

export const ZONES = { asphalt: [-42, 22, -32, 12], gravel: [22, 52, -32, 12], ware: [-45, -10, 18, 45] };
export function surfaceAt(x, z) { const W = ZONES.ware; if (x > W[0] && x < W[1] && z > W[2] && z < W[3]) return 'concrete'; const A = ZONES.asphalt; if (x > A[0] && x < A[1] && z > A[2] && z < A[3]) return 'asphalt'; const g = ZONES.gravel; if (x > g[0] && x < g[1] && z > g[2] && z < g[3]) return 'gravel'; return 'grass'; }
export function insideWare(p) { const W = ZONES.ware; return p.x > W[0] && p.x < W[1] && p.z > W[2] && p.z < W[3]; }

export function buildWorld() {
  makeTextures();
  plane(0, 0, 140, 140, M.grass, 0, 5);
  const A = ZONES.asphalt; plane((A[0] + A[1]) / 2, (A[2] + A[3]) / 2, A[1] - A[0], A[3] - A[2], M.asphalt, .004, 6);
  const Gr = ZONES.gravel; plane((Gr[0] + Gr[1]) / 2, (Gr[2] + Gr[3]) / 2, Gr[1] - Gr[0], Gr[3] - Gr[2], M.gravel, .005, 3);
  const W = ZONES.ware; plane((W[0] + W[1]) / 2, (W[2] + W[3]) / 2, W[1] - W[0], W[3] - W[2], M.concrete, .006, 4);
  plane(-28, 15, 8, 6, M.asphalt, .0045, 6);
  for (let r = 0; r < 2; r++)for (let i = 0; i < 13; i++) { const x = -36 + i * 4.2, z = r ? -4 : -22; const l = new THREE.Mesh(new THREE.PlaneGeometry(.12, 5), M.line); l.rotation.x = -Math.PI / 2; l.position.set(x, .008, z); l.receiveShadow = true; scene.add(l); }
  // capannone
  const H = 7, T = .3, ts = 3;
  box(-38, 0, W[2], 14, H, T, M.wallMetal, { ts, surf: 'metal' }); box(-17.5, 0, W[2], 15, H, T, M.wallMetal, { ts, surf: 'metal' }); box(-28, 4.6, W[2], 6, H - 4.6, T, M.wallMetal, { ts, surf: 'metal' });
  box(-34, 0, W[3], 22, H, T, M.wallMetal, { ts, surf: 'metal' }); box(-15, 0, W[3], 10, H, T, M.wallMetal, { ts, surf: 'metal' }); box(-21.75, 2.3, W[3], 3.5, H - 2.3, T, M.wallMetal, { ts, surf: 'metal' });
  box(W[0], 0, (W[2] + W[3]) / 2, T, H, W[3] - W[2], M.wallMetal, { ts, surf: 'metal' });
  box(W[1], 0, 23.5, T, H, 11, M.wallMetal, { ts, surf: 'metal' }); box(W[1], 0, 39.5, T, H, 11, M.wallMetal, { ts, surf: 'metal' }); box(W[1], 2.4, 31.5, T, H - 2.4, 5, M.wallMetal, { ts, surf: 'metal' });
  box((W[0] + W[1]) / 2, H, (W[2] + W[3]) / 2, W[1] - W[0] + .6, .25, W[3] - W[2] + .6, M.roof, { ts: 4, nocol: true });
  for (const [x, z] of [[-36, 27], [-36, 36], [-19, 27], [-19, 36]]) box(x, 0, z, .4, H, .4, M.post, { surf: 'metal' });
  const crate = new THREE.MeshStandardMaterial({ color: '#7a6446', roughness: .9 });
  for (const [x, z, w, h, d] of [[-41, 40, 2.4, 1.6, 1.6], [-41, 37.6, 2.4, 1.2, 1.6], [-14, 41, 1.4, 2.2, 3], [-30, 32, 3, 1.1, 1.2], [-25, 40, 1.2, 1.2, 1.2]]) box(x, 0, z, w, h, d, crate, { surf: 'wood' });
  // muretto e pallet vicino al punto di partenza: utili per i colpi a parete
  box(-6, 0, -9, 4, 1.1, .35, M.concrete, { ts: 2, surf: 'concrete' });
  box(6, 0, -8, 1.2, .9, 1.2, crate, { surf: 'wood' });
  const carCols = ['#6d1f1c', '#25303e', '#b8b8b2', '#2f3b2a', '#1c1c1e', '#8a6a2a'];
  [[-35, -22, 0], [-26.6, -22, 0], [-10, -22, 0], [-1.6, -4, 0], [-18.4, -4, 0], [10, -4, 0], [34, -14, 1]].forEach(([x, z, r], i) => car(x, z, r, carCols[i % carCols.length]));
  const cc = ['#7c2d22', '#284a6b', '#3d5a34', '#8a6d2b'];
  [[30, 2, 0, 0], [30, 2, 2.59, 1], [38, 2, 0, 2], [44, -24, 0, 3, 1], [28, -26, 0, 1, 1]].forEach(([x, z, y, c, r]) => { const m = new THREE.MeshStandardMaterial({ map: TX.corr, color: cc[c], roughness: .7, metalness: .4 }); box(x, y, z, r ? 2.44 : 6.06, 2.59, r ? 6.06 : 2.44, m, { ts: 2.5, surf: 'metal' }); });
  for (let i = 0; i < 5; i++) box(24 + i * 3.4, 0, -30, 3, .8, .6, M.concrete, { ts: 2, surf: 'concrete' });
  box(-6, 0, 14, 1.8, 1.3, 1.1, new THREE.MeshStandardMaterial({ color: '#2f4a35', metalness: .5, roughness: .6 }), { surf: 'metal' });
  box(0, 0, 60, 120, 3, .4, M.concrete, { ts: 3 });
  fenceLine(-60, -60, 60, -60); fenceLine(-60, -60, -60, 60); fenceLine(60, -60, 60, 60);
  const trees = [[5, 25], [12, 30], [20, 22], [8, 40], [18, 45], [28, 35], [40, 30], [48, 42], [-52, 0], [-55, -20], [-50, -40], [0, -45], [15, -50], [-20, -48], [36, -46], [50, -10], [52, 20]];
  for (let i = 0; i < 14; i++) trees.push([rand(54, 58), -55 + i * 8]);
  for (let i = 0; i < 10; i++) trees.push([-55 + i * 11, rand(52, 56)]);
  trees.forEach(([x, z]) => tree(x, z));
  for (const [x, z] of [[-30, -13], [-10, -13], [10, -13], [30, -10], [-28, 12], [45, 5]]) { box(x, 0, z, .18, 6, .18, M.post, { surf: 'metal' }); box(x, 6, z + .5, .3, .12, 1.1, M.lamp, { nocol: true }); const L = new THREE.PointLight('#ffc27a', 0, 26, 2); L.position.set(x, 5.8, z + .7); scene.add(L); streetLights.push(L); }
  const wl = new THREE.PointLight('#ffd9a0', 0, 24, 2); wl.position.set(-28, 6.3, 31); scene.add(wl); streetLights.push(wl);
  buildSky();
}
function car(x, z, r, col) {
  const g = new THREE.Group(); const paint = new THREE.MeshStandardMaterial({ color: col, metalness: .6, roughness: .35 });
  const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); m.userData.surf = 'metal'; obstacleMeshes.push(m); return m; };
  add(new THREE.BoxGeometry(1.8, .62, 4.3), paint, 0, .62, 0); add(new THREE.BoxGeometry(1.62, .55, 2.2), M.glass, 0, 1.2, -.2); add(new THREE.BoxGeometry(1.64, .06, 2.0), paint, 0, 1.5, -.2);
  for (const [wx, wz] of [[-.82, 1.35], [.82, 1.35], [-.82, -1.35], [.82, -1.35]]) { const w = add(new THREE.CylinderGeometry(.33, .33, .24, 16), M.tire, wx, .33, wz); w.rotation.z = Math.PI / 2; }
  g.position.set(x, 0, z); g.rotation.y = r ? Math.PI / 2 : 0; scene.add(g); g.updateMatrixWorld(true);
  const hw = r ? 2.15 : .9, hd = r ? .9 : 2.15; obstacles.push({ min: new V3(x - hw, 0, z - hd), max: new V3(x + hw, 1.5, z + hd), surf: 'metal' });
}
function fenceLine(x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1), h = 2.4; const g = new THREE.PlaneGeometry(len, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++)uv.setXY(i, uv.getX(i) * len / 1.2, uv.getY(i) * h / 1.2);
  const m = new THREE.Mesh(g, M.fence); m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); m.castShadow = true; scene.add(m);
  for (let t = 0; t <= len; t += 3) { const px = x1 + (x2 - x1) * t / len, pz = z1 + (z2 - z1) * t / len; const p = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, h, 6), M.post); p.position.set(px, h / 2, pz); scene.add(p); }
}
function tree(x, z) {
  const h = rand(2.6, 4); const t = new THREE.Mesh(new THREE.CylinderGeometry(.16, .24, h, 8), M.bark); t.position.set(x, h / 2, z); t.castShadow = true; scene.add(t);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.4, 2.2), 1), M.leaves); const pa = c.geometry.attributes.position; for (let k = 0; k < pa.count; k++)pa.setXYZ(k, pa.getX(k) * rand(.85, 1.15), pa.getY(k) * rand(.8, 1.1), pa.getZ(k) * rand(.85, 1.15)); c.geometry.computeVertexNormals(); c.position.set(x + rand(-.8, .8), h + rand(.4, 1.6), z + rand(-.8, .8)); c.castShadow = true; c.receiveShadow = true; scene.add(c); }
  obstacles.push({ min: new V3(x - .28, 0, z - .28), max: new V3(x + .28, h, z + .28), surf: 'wood' }); t.userData.surf = 'wood'; obstacleMeshes.push(t);
}

/* ================= CIELO E LUCE ================= */
function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new V3() }, sunCol: { value: new THREE.Color() }, cloud: { value: .6 }, time: { value: 0 } },
    vertexShader: SHADERS['sky.vert'], fragmentShader: SHADERS['sky.frag']
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); scene.add(sky);
  hemi = new THREE.HemisphereLight('#fff', '#444', .6); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff', 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.FogExp2('#000', .01);
}
export const TOD = {
  giorno: { el: 52, az: 140, sun: '#fff1de', si: 2.6, sky: '#3f78c2', hor: '#d3e3f2', hs: '#c8dcf0', hg: '#5b5241', hi: .8, fog: '#c9d8e6', fd: .0055, exp: .82, lamps: 0, cloud: .55 },
  tramonto: { el: 6, az: 255, sun: '#ffa45e', si: 2.3, sky: '#2c3c66', hor: '#f39a5a', hs: '#e5a37e', hg: '#3a3027', hi: .55, fog: '#c98a68', fd: .009, exp: 1.0, lamps: .6, cloud: .4 },
  notte: { el: 38, az: 200, sun: '#9fb4e0', si: .7, sky: '#050811', hor: '#18233a', hs: '#3d527e', hg: '#1a1b20', hi: .8, fog: '#0d1320', fd: .016, exp: 1.45, lamps: 3.2, cloud: .15 },
};
export const LIGHT = { amb: new THREE.Color(), sunCol: new THREE.Color() }; // usato dai decal
export function applyTod() {
  const t = TOD[S.tod]; const el = t.el * Math.PI / 180, az = t.az * Math.PI / 180;
  sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  sun.color.set(t.sun); sun.intensity = t.si; hemi.color.set(t.hs); hemi.groundColor.set(t.hg); hemi.intensity = t.hi;
  scene.fog.color.set(t.fog); scene.fog.density = t.fd;
  skyMat.uniforms.top.value.set(t.sky); skyMat.uniforms.hor.value.set(t.hor); skyMat.uniforms.sun.value.copy(sunDir);
  skyMat.uniforms.sunCol.value.set(t.sun).multiplyScalar(S.tod === 'notte' ? .3 : 1); skyMat.uniforms.cloud.value = t.cloud;
  renderer.toneMappingExposure = t.exp; streetLights.forEach(l => l.intensity = t.lamps); M.lamp.emissiveIntensity = t.lamps ? 2 : 0;
  LIGHT.sunCol.set(t.sun).multiplyScalar(t.si * .55); LIGHT.amb.set(t.hs).multiplyScalar(t.hi * .55 + (t.lamps > 1 ? .12 : 0));
}
export function updateSky(center, time) {
  const sp = center.clone(); sp.x = Math.round(sp.x / 2) * 2; sp.z = Math.round(sp.z / 2) * 2;
  sun.target.position.copy(sp); sun.position.copy(sp).addScaledVector(sunDir, 120);
  sky.position.copy(camera.position); skyMat.uniforms.time.value = time;
}

/* ================= COLLISIONI ================= */
export function collideCircle(p, r, h) {
  for (const o of obstacles) {
    if (p.y >= o.max.y - .02 || p.y + h < o.min.y) continue;
    const cx = clamp(p.x, o.min.x, o.max.x), cz = clamp(p.z, o.min.z, o.max.z); const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
      else { const pens = [[p.x - o.min.x, -1, 0], [o.max.x - p.x, 1, 0], [p.z - o.min.z, 0, -1], [o.max.z - p.z, 0, 1]].sort((a, b) => a[0] - b[0])[0]; p.x += pens[1] * (pens[0] + r); p.z += pens[2] * (pens[0] + r); }
    }
  }
  p.x = clamp(p.x, -59.3, 59.3); p.z = clamp(p.z, -59.3, 59.3);
}
