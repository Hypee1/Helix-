// HELIX · killcam del cecchino: inseguimento del proiettile al rallentatore, poi vista a raggi X
// del corpo con il tramite del proiettile e l'elenco di ciò che ha perforato.
import { THREE, V3, UP, G, $, scene, camera, renderer, clamp, lerp, SHADERS } from './core.js';
import { SND } from './audio.js';
import { CAT, SOFT } from './anatomy.js';
import { log } from './ui.js';

export const kcCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .005, 500);
addEventListener('resize', () => { kcCam.aspect = innerWidth / innerHeight; kcCam.updateProjectionMatrix(); });
let K = null;

// organi interni (coordinate anatomiche del segmento; vedi anatomy.js)
const BONE = '#e9e1cc', RED = '#c0392b', VEIN = '#3b5bc4', PINK = '#e8a3a3';
const ORG = {
  head: [
    { ids: ['cervello'], s: 's', p: [0, .22, .05], z: [.72, .6, .82], c: '#e6b3b3' },
    { ids: ['tronco'], s: 'c', p: [0, -.32, .25], z: [.13, .45, .13], c: '#d79090' },
    { ids: ['cranio'], s: 'w', p: [0, .05, 0], z: [.93, .93, .93], c: BONE },
    { ids: ['occhio'], s: 's', p: [.38, .12, -.82], z: [.14, .14, .14], c: '#ffffff' }, { ids: ['occhio'], s: 's', p: [-.38, .12, -.82], z: [.14, .14, .14], c: '#ffffff' },
    { ids: ['mandibola'], s: 't', p: [0, -.55, -.35], z: [.55, .06, .55], c: BONE },
  ],
  neck: [
    { ids: ['trachea'], s: 'c', p: [0, .5, -.5], z: [.18, 1, .18], c: '#d8c7b8' },
    { ids: ['C'], s: 'c', p: [0, .5, .5], z: [.22, 1, .22], c: BONE },
    { ids: ['carotideL'], s: 'c', p: [.45, .5, -.25], z: [.09, 1, .09], c: RED }, { ids: ['carotideR'], s: 'c', p: [-.45, .5, -.25], z: [.09, 1, .09], c: RED },
    { ids: ['giugulareL'], s: 'c', p: [.72, .5, -.1], z: [.1, 1, .1], c: VEIN }, { ids: ['giugulareR'], s: 'c', p: [-.72, .5, -.1], z: [.1, 1, .1], c: VEIN },
  ],
  tho: [
    { ids: ['cuore'], s: 's', p: [.14, .47, -.3], z: [.28, .2, .27], c: RED },
    { ids: ['polmoneL'], s: 's', p: [.5, .56, -.02], z: [.32, .38, .52], c: PINK }, { ids: ['polmoneR'], s: 's', p: [-.5, .56, -.02], z: [.34, .38, .52], c: PINK },
    { ids: ['aorta'], s: 'c', p: [.03, .45, .38], z: [.07, .75, .07], c: RED }, { ids: ['cava'], s: 'c', p: [-.18, .45, .05], z: [.07, .7, .07], c: VEIN },
    { ids: ['fegato'], s: 's', p: [-.32, .12, -.1], z: [.45, .16, .45], c: '#7b2d1a' }, { ids: ['stomaco'], s: 's', p: [.25, .1, -.3], z: [.24, .13, .24], c: '#d9a08a' },
    { ids: ['milza'], s: 's', p: [.62, .12, .3], z: [.13, .1, .16], c: '#6b2240' },
    { ids: ['T', 'midolloT'], s: 'c', p: [0, .5, .76], z: [.1, 1, .1], c: BONE }, { ids: ['sterno'], s: 'b', p: [0, .55, -.82], z: [.1, .65, .05], c: BONE },
    ...[0, 1, 2, 3, 4, 5, 6].map(i => ({ ids: ['costa'], s: 't', p: [0, .14 + i * .12, 0], z: [.8, .025, .8], c: BONE, o: .55 })),
  ],
  abd: [
    { ids: ['tenue', 'crasso'], s: 's', p: [0, .4, -.2], z: [.55, .3, .42], c: '#d99a8a' },
    { ids: ['reneL'], s: 's', p: [.43, .6, .48], z: [.14, .15, .11], c: '#8e3b2e' }, { ids: ['reneR'], s: 's', p: [-.43, .6, .48], z: [.14, .15, .11], c: '#8e3b2e' },
    { ids: ['fegato'], s: 's', p: [-.3, .88, -.1], z: [.4, .12, .4], c: '#7b2d1a' }, { ids: ['pancreas'], s: 's', p: [.1, .68, .15], z: [.3, .05, .1], c: '#e3c08a' },
    { ids: ['vescica'], s: 's', p: [0, .05, -.35], z: [.15, .1, .12], c: '#e6d07a' },
    { ids: ['aorta'], s: 'c', p: [.05, .5, .45], z: [.07, 1, .07], c: RED }, { ids: ['cava'], s: 'c', p: [-.15, .5, .45], z: [.07, 1, .07], c: VEIN },
    { ids: ['L', 'midolloL'], s: 'c', p: [0, .5, .74], z: [.12, 1, .12], c: BONE }, { ids: ['bacino'], s: 't', p: [0, .04, .1], z: [.7, .07, .7], c: BONE },
    { ids: ['iliacaL'], s: 'c', p: [.3, .1, .2], z: [.06, .25, .06], c: RED }, { ids: ['iliacaR'], s: 'c', p: [-.3, .1, .2], z: [.06, .25, .06], c: RED },
  ],
};
const LIMB = { uarm: ['omero', 'brachiale'], farm: ['radio', 'radiale'], thigh: ['femore', 'femorale'], shin: ['tibia', 'tibiale'] };

function buildOrgans(ch) {
  const made = [];
  const geoS = new THREE.SphereGeometry(1, 18, 12), geoC = new THREE.CylinderGeometry(1, 1, 1, 10), geoB = new THREE.BoxGeometry(2, 1, 2), geoT = new THREE.TorusGeometry(1, 1, 6, 28);
  for (const sg of ch.segs) {
    let defs = ORG[sg.k] ? ORG[sg.k].slice() : [];
    if (LIMB[sg.k]) { const md = sg.sd === 'L' ? -.45 : .45; defs = [{ ids: [LIMB[sg.k][0] + sg.sd], s: 'c', p: [0, .5, 0], z: [.3, 1, .3], c: BONE }, { ids: [LIMB[sg.k][1] + sg.sd], s: 'c', p: [md, .5, -.1], z: [.1, 1, .1], c: RED }]; }
    for (const d of defs) {
      let g = d.s === 's' ? geoS : d.s === 'c' ? geoC : d.s === 'b' ? geoB : d.s === 't' ? new THREE.TorusGeometry(1, d.z[1] / d.z[0], 6, 28) : geoS;
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: d.c, wireframe: d.s === 'w', transparent: true, opacity: d.o || (d.s === 'w' ? .35 : .9), depthWrite: d.s !== 'w', fog: false }));
      const [u, v, w] = d.p; const head = sg.k === 'head'; const L = head ? sg.r : sg.rest;
      m.position.set(u * sg.r, head ? v * sg.r : v * sg.rest - sg.rest / 2, -w * sg.r * (head ? 1 : (sg.zs || 1)));
      if (d.s === 't') { m.rotation.x = Math.PI / 2; m.scale.set(d.z[0] * sg.r, d.z[2] * sg.r, d.z[0] * sg.r); }
      else m.scale.set(d.z[0] * sg.r, d.z[1] * (head ? sg.r : sg.rest), d.z[2] * sg.r);
      m.renderOrder = 15; m.userData.ids = d.ids; m.userData.base = new THREE.Color(d.c); m.userData.org = true; sg.mesh.add(m); m.updateMatrixWorld(true); made.push(m);
    }
  }
  return made;
}

export function startKillcam(o) {
  if (K) return; G.killcam = true; G.timeScale = 0;
  const bullet = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: '#c98a4a', metalness: .9, roughness: .25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.0058, .0058, .022, 16), jacket); body.rotation.x = Math.PI / 2; bullet.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.0058, .02, 16), jacket); tip.rotation.x = -Math.PI / 2; tip.position.z = -.021; bullet.add(tip);
  bullet.traverse(m => m.renderOrder = 20);
  bullet.position.copy(o.from); bullet.quaternion.setFromUnitVectors(new V3(0, 0, -1), o.dir); scene.add(bullet);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(.0025, .0025, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(trail);
  const dist = o.from.distanceTo(o.point);
  K = { ...o, phase: 'fly', t: 0, T: clamp(dist / 22, 1.1, 2.6), bullet, trail, rings: [], ringT: 0, dist, labels: [], fogSave: { c: scene.fog.color.clone(), d: scene.fog.density } };
  const v = Math.sqrt(2 * o.ammo.E / o.ammo.m);
  $('#kc').hidden = false; document.body.classList.add('kcmode'); camera.visible = false; $('#kcInfo').innerHTML = `<b>KILLCAM</b> · ${o.ammo.n} · ${dist.toFixed(1)} m · ${Math.round(v)} m/s · ${Math.round(o.ammo.E)} J`; $('#kcList').innerHTML = ''; $('#kcLabels').innerHTML = '';
  SND.bulletWhoosh();
}
export const killcamActive = () => !!K;
export function skipKillcam() { if (!K) return; if (K.phase === 'fly') arrive(); K.phase = 'out'; K.t = 0; }

function arrive() {
  const o = K; const res = o.ch.hitBullet(o.sg, o.point, o.dir, o.ammo.E, o.ammo, o.label, o.uv, o.trace);
  o.res = res; o.pIn = o.point.clone(); o.pOut = res.pOut.clone();
  // raggi X
  o.saved = []; const xmat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color('#7fb8ff') }, uOp: { value: 1 } }, vertexShader: SHADERS['rasengan.vert'], fragmentShader: SHADERS['xray.frag'], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  o.xmat = xmat;
  for (const sg of o.ch.segs) { o.saved.push([sg.mesh, sg.mesh.material]); sg.mesh.material = xmat; sg.mesh.children.forEach(c => { c.userData.wasVis = c.visible; c.visible = false; }); }
  if (o.ch.wpnMesh) o.ch.wpnMesh.visible = false;
  o.organs = buildOrgans(o.ch);
  // tramite del proiettile
  const a = o.pIn.clone().addScaledVector(o.dir, -.25), b = o.pOut.clone().addScaledVector(o.dir, o.res.Eout > 0 ? .5 : 0);
  const path = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, 1, 8), new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: .95, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  path.position.copy(a).add(b).multiplyScalar(.5); path.quaternion.setFromUnitVectors(UP, o.dir); path.scale.set(1, .0001, 1); path.renderOrder = 30; scene.add(path); o.path = path; o.pa = a; o.pb = b;
  o.bullet.traverse(m => { if (m.material) { m.material.depthTest = false; } });
  scene.fog.color.set('#05070d'); scene.fog.density = .6;
  // etichette dei tessuti perforati
  const seen = new Set();
  for (const s of res.seq) { const name = s.label; if (!name || seen.has(name) || SOFT[s.id] || CAT[s.id]?.t === 'mus') continue; seen.add(name); const el = document.createElement('div'); el.className = 'kcl' + (SOFT[s.id] ? ' soft' : CAT[s.id]?.t === 'ske' ? ' bone' : CAT[s.id]?.t === 'vas' ? ' vas' : ' org'); el.innerHTML = `<b>${name}</b>${s.status && s.status !== 'intatto' ? `<span>${s.status}</span>` : ''}`; $('#kcLabels').appendChild(el); o.labels.push({ el, s, shown: false }); }
  o.phase = 'xray'; o.t = 0; G.timeScale = .025; SND.xrayHit();
}
function flashOrgans(id) { for (const m of K.organs) if (m.userData.ids.some(x => id.startsWith(x))) { m.material.color.set('#ff2a1a'); m.userData.hitT = performance.now(); m.material.opacity = 1; } }
function restore() {
  const o = K; for (const [m, mat] of o.saved || []) { m.material = mat; m.children.forEach(c => { if (c.userData.wasVis !== undefined) { c.visible = c.userData.wasVis; delete c.userData.wasVis; } }); }
  for (const m of o.organs || []) { m.parent && m.parent.remove(m); m.material.dispose(); }
  if (o.ch.wpnMesh) o.ch.wpnMesh.visible = true;
  [o.bullet, o.trail, o.path, ...o.rings.map(r => r.m)].forEach(m => m && scene.remove(m));
  scene.fog.color.copy(o.fogSave.c); scene.fog.density = o.fogSave.d; o.xmat && o.xmat.dispose();
  $('#kc').hidden = true; $('#kcLabels').innerHTML = ''; document.body.classList.remove('kcmode'); camera.visible = true;
}
const _p = new V3();
export function updateKillcam(rdt) {
  if (!K) return null; const o = K; o.t += rdt;
  if (o.phase === 'fly') {
    const k = Math.min(1, o.t / o.T); const bp = _p.copy(o.from).lerp(o.point, k); o.bullet.position.copy(bp); o.bullet.rotateZ(rdt * 40);
    o.trail.position.copy(o.from).add(bp).multiplyScalar(.5); o.trail.quaternion.setFromUnitVectors(UP, o.dir); o.trail.scale.set(1, Math.max(.001, o.from.distanceTo(bp)), 1);
    o.ringT += rdt; if (o.ringT > .07) { o.ringT = 0; const r = new THREE.Mesh(new THREE.TorusGeometry(.012, .0012, 6, 24), new THREE.MeshBasicMaterial({ color: '#dfefff', transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false })); r.position.copy(bp); r.quaternion.setFromUnitVectors(new V3(0, 0, 1), o.dir); scene.add(r); o.rings.push({ m: r, t: 0 }); }
    const side = new V3().crossVectors(o.dir, UP).normalize(); const ang = k * .9;
    kcCam.position.copy(bp).addScaledVector(o.dir, -.17).addScaledVector(side, Math.sin(ang) * .06).addScaledVector(UP, .03 + Math.cos(ang) * .012);
    kcCam.lookAt(_p.copy(bp).addScaledVector(o.dir, .12)); kcCam.fov = 55; kcCam.updateProjectionMatrix();
    if (k >= 1) arrive();
  } else if (o.phase === 'xray') {
    const D = 4.6; const k = Math.min(1, o.t / D);
    // il proiettile attraversa lentamente il corpo
    const pk = clamp(o.t / 2.4, 0, 1); const bp = _p.copy(o.pa).lerp(o.pb, pk); o.bullet.position.copy(bp); o.bullet.rotateZ(rdt * 6);
    const len = o.pa.distanceTo(bp); o.path.position.copy(o.pa).lerp(bp, .5); o.path.scale.set(1, Math.max(.0001, len), 1);
    const bodyK = clamp((bp.distanceTo(o.pa) - .25) / Math.max(.001, o.pIn.distanceTo(o.pOut)), 0, 1.2);
    for (const L of o.labels) if (!L.shown && bodyK >= L.s.k) { L.shown = true; L.el.classList.add('on'); if (!SOFT[L.s.id]) { flashOrgans(L.s.id); const row = document.createElement('div'); row.innerHTML = `<span>${L.s.label}</span><em>${L.s.status || ''}</em><small>${Math.round(L.s.E)} J</small>`; $('#kcList').appendChild(row); if (CAT[L.s.id]?.t === 'ske' || CAT[L.s.id]?.t === 'org') SND.impact(null, CAT[L.s.id].t === 'ske' ? 'bone' : 'flesh', 300); } }
    const center = o.pIn.clone().lerp(o.pOut, .5); const side = new V3().crossVectors(o.dir, UP).normalize();
    const ang = -.9 + k * 1.9; const off = side.clone().multiplyScalar(Math.cos(ang)).addScaledVector(o.dir, -Math.sin(ang) * .6).normalize();
    kcCam.position.copy(center).addScaledVector(off, 1.05).addScaledVector(UP, .2); kcCam.lookAt(center); kcCam.fov = 50; kcCam.updateProjectionMatrix();
    // etichette sullo schermo
    kcCam.updateMatrixWorld();
    o.labels.forEach((L, i) => { if (!L.shown) return; const s = L.s.pos.clone().project(kcCam); const dy = (i % 2 ? 1 : -1) * (18 + 16 * Math.floor(i / 2)); L.el.style.transform = `translate(${(s.x * .5 + .5) * innerWidth}px,${(-s.y * .5 + .5) * innerHeight + dy}px)`; L.el.style.setProperty('--pt', (4 - dy) + 'px'); L.el.style.setProperty('--lt', Math.min(7, 7 - dy) + 'px'); L.el.style.setProperty('--lh', Math.abs(dy) + 'px'); });
    for (const m of o.organs) if (m.userData.hitT) { const e = (performance.now() - m.userData.hitT) / 1000; m.scale.multiplyScalar(e < .15 ? 1.003 : 1); }
    if (o.t >= D) { o.phase = 'out'; o.t = 0; log(`<b>Killcam</b>: ${o.res.trail.join(' → ')}`); }
  } else if (o.phase === 'out') {
    const k = Math.min(1, o.t / .7); if (!o.restored) { o.restored = true; restore(); }
    G.timeScale = lerp(.05, 1, k);
    kcCam.position.lerp(camera.getWorldPosition(new V3()), k); kcCam.quaternion.slerp(camera.getWorldQuaternion(new THREE.Quaternion()), k); kcCam.fov = lerp(kcCam.fov, camera.fov, k); kcCam.updateProjectionMatrix();
    if (k >= 1) { G.timeScale = 1; G.killcam = false; K = null; return null; }
  }
  for (let i = o.rings.length - 1; i >= 0; i--) { const r = o.rings[i]; r.t += rdt; r.m.scale.setScalar(1 + r.t * 6); r.m.material.opacity = .5 * (1 - r.t / .5); if (r.t > .5) { scene.remove(r.m); o.rings.splice(i, 1); } }
  return kcCam;
}
