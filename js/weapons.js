// HELIX · armi: definizioni (da data/weapons.json), modelli in prima persona e animazioni
import { THREE, V3, $, DATA, camera, player, mouse, lerp, clamp, canvasTex } from './core.js';
import { makeRasengan } from './rasengan.js';

export const W = {
  def: id => DATA.weapons.weapons.find(w => w.id === id),
  ammo: id => DATA.weapons.ammo[id],
  moves: kind => DATA.weapons.moves[kind],
  thr: id => DATA.weapons.throwables[id],
};
export const vm = new THREE.Group();
const MODELS = {};
let flashTex;
export let flashL;

const mat = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const skinVM = mat('#c99b7a', .6), sleeveVM = mat('#2f3436', .9), gunM = mat('#1b1c1e', .45, .6), gunM2 = mat('#2a2b2d', .6, .3), steel = mat('#c9cdd2', .25, .9), wood = mat('#6b4a2c', .7), batM = mat('#b88b55', .55), brass = mat('#c9a24a', .3, .9);
const B = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const Cy = (r1, r2, len, m, x = 0, y = 0, z = 0, axis = 'z') => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 12), m); if (axis === 'z') o.rotation.x = Math.PI / 2; o.position.set(x, y, z); return o; };

function fist(side, knuckles) {
  const g = new THREE.Group(); g.add(B(.07, .062, .075, skinVM));
  for (let i = 0; i < 4; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(.0105, 6, 5), skinVM); k.position.set(-.027 + i * .018, .02, -.036); g.add(k); }
  g.add(B(.02, .02, .05, skinVM, (side === 'L' ? 1 : -1) * .033, -.012, -.01));
  const w = Cy(.028, .032, .07, skinVM, 0, 0, .06); g.add(w); g.add(Cy(.04, .045, .34, sleeveVM, 0, 0, .26));
  if (knuckles) { g.add(B(.08, .034, .016, brass, 0, .026, -.042)); g.add(B(.08, .006, .03, brass, 0, .044, -.03)); for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.011, .0035, 6, 12), brass); r.position.set(-.027 + i * .018, .01, -.03); r.rotation.y = Math.PI / 2; g.add(r); } g.add(B(.06, .012, .03, brass, 0, -.02, -.02)); }
  g.userData.side = side; return g;
}
function hand(x, y, z) { const g = new THREE.Group(); g.add(B(.06, .07, .08, skinVM)); g.add(B(.07, .07, .32, sleeveVM, .015, -.025, .19)); g.position.set(x, y, z); return g; }
function muzzleOf(g, z, y = 0) {
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  f.scale.setScalar(.2); f.position.set(0, y, z); f.visible = false; g.add(f); g.userData.flash = f; g.userData.muzzleZ = z;
}

export function buildViewmodels() {
  camera.add(vm);
  flashTex = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.3, 'rgba(255,170,60,.8)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, false);
  flashL = new THREE.PointLight('#ffb060', 0, 8, 2); camera.add(flashL); flashL.position.set(.1, -.05, -.6);
  // pugni e tirapugni
  for (const id of ['fists', 'knuckles']) { const g = new THREE.Group(); const L = fist('L', id === 'knuckles'), R = fist('R', id === 'knuckles'); g.add(L, R); g.userData.L = L; g.userData.R = R; MODELS[id] = g; }
  // coltello (destra) + pugno in guardia (sinistra)
  { const g = new THREE.Group(); const L = fist('L'); const R = fist('R'); const kn = new THREE.Group(); kn.add(B(.018, .024, .1, mat('#1d1d1d', .8), 0, 0, 0)); const bl = B(.004, .028, .17, steel, 0, .004, -.13); kn.add(bl); const tip = new THREE.Mesh(new THREE.ConeGeometry(.014, .04, 4), steel); tip.rotation.x = -Math.PI / 2; tip.scale.set(.3, 1, 1); tip.position.set(0, .004, -.235); kn.add(tip); kn.position.set(0, .015, -.03); kn.rotation.x = .85; R.add(kn); g.add(L, R); g.userData.L = L; g.userData.R = R; MODELS.knife = g; }
  // mazza
  { const g = new THREE.Group(); const bat = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.034, .016, .84, 14), batM); c.position.y = .42; bat.add(c); bat.add(new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .02, 12), batM)); const h1 = hand(0, .02, 0), h2 = hand(0, .11, 0); h1.rotation.x = Math.PI / 2; h2.rotation.x = Math.PI / 2; bat.add(h1, h2); g.add(bat); g.userData.bat = bat; MODELS.bat = g; }
  // pistola
  { const g = new THREE.Group(); g.add(B(.032, .03, .19, gunM2, 0, 0, -.02)); const sl = B(.03, .032, .19, gunM, 0, .03, -.02); g.add(sl); const gr = B(.03, .11, .05, gunM2, 0, -.05, .05); gr.rotation.x = .25; g.add(gr); g.add(B(.004, .008, .006, gunM, 0, .05, -.105), B(.006, .009, .006, gunM, .007, .05, .065), B(.006, .009, .006, gunM, -.007, .05, .065)); g.add(B(.06, .07, .08, skinVM, .005, -.045, .06), B(.07, .07, .32, sleeveVM, .02, -.07, .25)); g.userData.slide = sl; muzzleOf(g, -.16, .03); MODELS.pistol = g; }
  // fucile a pompa
  { const g = new THREE.Group(); g.add(B(.045, .06, .25, gunM)); g.add(Cy(.011, .011, .55, gunM, 0, .016, -.38)); g.add(Cy(.01, .01, .42, gunM2, 0, -.012, -.33)); const pump = B(.042, .04, .14, wood, 0, -.014, -.3); g.add(pump); const st = B(.04, .09, .3, wood, 0, -.04, .26); st.rotation.x = .12; g.add(st); g.add(B(.006, .01, .006, steel, 0, .03, -.64)); g.add(hand(.01, -.06, .05)); const lh = hand(-.01, -.04, -.3); lh.children[1].position.set(-.03, -.03, .15); g.add(lh); g.userData.pump = pump; g.userData.lh = lh; muzzleOf(g, -.68, .016); MODELS.shotgun = g; }
  // fucile d'assalto
  { const g = new THREE.Group(); g.add(B(.04, .07, .3, gunM)); g.add(Cy(.008, .008, .3, gunM, 0, .012, -.35)); g.add(B(.05, .055, .22, gunM2, 0, .005, -.25)); const mg = B(.03, .13, .055, gunM2, 0, -.09, -.04); mg.rotation.x = .25; g.add(mg); g.add(B(.042, .075, .26, gunM2, 0, -.015, .27)); g.add(B(.03, .025, .06, gunM, 0, .05, 0), B(.004, .02, .004, gunM, 0, .045, -.33)); const gr = B(.03, .09, .04, gunM2, 0, -.07, .08); gr.rotation.x = .3; g.add(gr); g.add(hand(.005, -.07, .1), hand(-.01, -.03, -.24)); g.userData.mag = mg; muzzleOf(g, -.52, .012); MODELS.rifle = g; }
  // fucile di precisione
  { const g = new THREE.Group(); g.add(B(.045, .06, .32, gunM)); g.add(Cy(.01, .012, .65, gunM, 0, .012, -.48)); g.add(Cy(.021, .021, .3, gunM2, 0, .065, -.02)); g.add(Cy(.026, .021, .06, gunM2, 0, .065, -.18)); g.add(Cy(.024, .021, .05, gunM2, 0, .065, .14)); const st = B(.045, .1, .36, wood, 0, -.04, .32); st.rotation.x = .08; g.add(st); g.add(B(.05, .05, .4, wood, 0, -.02, -.22)); const bolt = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 6), steel); bolt.position.set(.035, .02, .08); g.add(bolt); g.add(hand(.01, -.07, .1), hand(-.01, -.05, -.25)); g.userData.bolt = bolt; muzzleOf(g, -.82, .012); MODELS.sniper = g; }
  // armi da lancio
  { const g = new THREE.Group(); const R = fist('R'); g.add(R); g.userData.R = R; const items = {}; const tk = new THREE.Group(); tk.add(B(.004, .025, .16, steel, 0, 0, -.08), B(.012, .02, .08, mat('#222'), 0, 0, .03)); items.tknife = tk; items.brick = B(.1, .06, .2, mat('#9a4a32', .95), 0, .02, -.04); const gn = new THREE.Group(); gn.add(new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), mat('#3d4a2e', .7))); gn.add(B(.012, .025, .02, steel, 0, .04, 0)); const ring = new THREE.Mesh(new THREE.TorusGeometry(.012, .002, 6, 12), steel); ring.position.set(.015, .055, 0); gn.add(ring); items.grenade = gn; for (const k in items) { items[k].position.y += .03; R.add(items[k]); } g.userData.items = items; MODELS.throw = g; }
  // Rasengan
  { const g = new THREE.Group(); const palm = new THREE.Group(); palm.add(B(.085, .028, .1, skinVM)); for (let i = 0; i < 4; i++) palm.add(B(.016, .016, .06, skinVM, -.03 + i * .02, .01, -.075)); palm.add(B(.02, .02, .05, skinVM, -.05, .006, -.01)); palm.add(Cy(.04, .045, .34, sleeveVM, 0, -.01, .22)); g.add(palm); const ras = makeRasengan(.07); ras.position.set(0, .085, -.02); g.add(ras); g.userData.palm = palm; g.userData.ras = ras; MODELS.rasengan = g; }
  for (const k in MODELS) { MODELS[k].visible = false; vm.add(MODELS[k]); }
  vm.traverse(o => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 10; } });
}
export const model = id => MODELS[id];

export function setWeapon(id) {
  const p = player; if (p.atk || p.reloading > 0 || p.charge > 0 || p.bandaging > 0) return;
  if (!W.def(id)) return; p.weapon = id; if (flashL) flashL.intensity = 0; for (const k in MODELS) MODELS[k].visible = k === id; p.ads = 0;
  if (id === 'throw') for (const k in MODELS.throw.userData.items) MODELS.throw.userData.items[k].visible = k === p.throwKind;
}
export function refreshThrowModel() { for (const k in MODELS.throw.userData.items) MODELS.throw.userData.items[k].visible = k === player.throwKind; }

/* ---------- animazioni prima persona ---------- */
const ext = (k, peak = .45) => k < peak ? Math.sin(k / peak * Math.PI / 2) : Math.max(0, 1 - (k - peak) / (1 - peak));
export function animVM(dt, moving, sprint, t) {
  const p = player, w = W.def(p.weapon), M = MODELS[p.weapon]; if (!M) return;
  const bx = Math.sin(p.bob) * .012 * Math.min(1, moving / 3), by = Math.abs(Math.cos(p.bob)) * .01 * Math.min(1, moving / 3);
  const sprintY = sprint ? -.05 : 0, bandY = p.bandaging > 0 ? -.35 : 0;
  const a = p.atk, k = a ? a.t / a.dur : 0;
  if (w.kind === 'fists' || p.weapon === 'knife') {
    const g = p.guard;
    for (const side of ['L', 'R']) {
      const f = M.userData[side]; const s = side === 'L' ? -1 : 1; let x = s * .16, y = -.22 + g * .07, z = -.42 + g * .07, rx = 0, ry = 0, rz = 0;
      if (p.weapon === 'knife' && side === 'R') { y = -.2; z = -.4; rx = -.2; }
      if (a && a.side === side) {
        const e = ext(k);
        if (a.type === 'gancio') { x = lerp(x, -s * .02, e); z = lerp(z, -.5, e); y += e * .05; ry = -s * e * 1.0; }
        else if (a.type === 'montante') { y = lerp(y - .08, -.04, e); z = lerp(z, -.52, e); rx = e * .8; }
        else if (a.type === 'gomitata') { x = lerp(x, -s * .05, e); y = lerp(y, -.12, e); z = lerp(z, -.32, e); ry = -s * e * 1.4; rz = s * e * .6; }
        else if (a.type === 'fendente') { const e2 = ext(k, .55); x = lerp(.3, -.22, Math.min(1, k * 1.8)); z = lerp(-.38, -.55, e2); y = -.17; ry = lerp(.9, -.9, Math.min(1, k * 1.8)); rz = -1.2 * e2; }
        else if (a.type === 'affondo') { z = lerp(z, -.78, e); y = lerp(y, -.14, e); rx = -.1; }
        else { x = lerp(x, s * .03, e); y = lerp(y, -.09, e); z = lerp(z, -.72, e); }
      }
      if (a && a.type.startsWith('calcio')) y -= .1 * ext(k);
      f.position.set(x + bx, y - by + sprintY + bandY, z); f.rotation.set(rx, ry, rz);
    }
  } else if (p.weapon === 'bat') {
    const bat = M.userData.bat; let x = .2, y = -.25, z = -.35, rx = -.35, ry = 0, rz = -.55; // sulla spalla
    if (p.guard > .5) { x = 0; y = -.2; z = -.4; rx = 0; rz = -1.45; }
    if (a) {
      if (a.type === 'orizzontale') { const e = Math.min(1, k * 1.7); x = lerp(.35, -.35, e); y = -.18; z = -.45 + Math.sin(e * Math.PI) * -.15; rz = -1.5; rx = 0; ry = lerp(1.2, -1.3, e); }
      else if (a.type === 'dallalto') { const e = Math.min(1, k * 1.6); x = .05; y = lerp(.05, -.35, e); z = -.45; rx = lerp(-.4, -2.1, e); rz = 0; }
      else { const e = ext(k); x = .05; y = -.15; z = lerp(-.3, -.75, e); rx = -1.55; rz = 0; }
    }
    bat.position.set(x + bx, y - by + sprintY + bandY, z); bat.rotation.set(rx, ry, rz, 'YXZ');
  } else if (w.kind === 'gun') {
    const A = p.ads; const rl = p.reloading > 0 ? Math.sin(Math.min(1, (1 - p.reloading / (w.perShell ? .55 : w.reload)) * 1.2) * Math.PI) : 0;
    M.userData.kick = (M.userData.kick || 0) * Math.exp(-dt * (w.id === 'sniper' ? 9 : 18)); const kk = M.userData.kick;
    const hip = { pistol: [.17, -.19, -.42], shotgun: [.16, -.18, -.36], rifle: [.15, -.17, -.36], sniper: [.16, -.18, -.38] }[w.id];
    const ads = { pistol: [0, -.083, -.33], shotgun: [0, -.035, -.3], rifle: [0, -.06, -.26], sniper: [0, -.09, -.22] }[w.id];
    M.position.set(lerp(hip[0], ads[0], A) + bx * (1 - A), lerp(hip[1], ads[1], A) - by * (1 - A) - rl * .18 + sprintY * (1 - A) + bandY, lerp(hip[2], ads[2], A) + kk * (w.id === 'pistol' ? .05 : .09));
    M.rotation.set(kk * (w.id === 'shotgun' ? .45 : .25) + rl * .9 + (sprint ? -.3 : 0), sprint ? .5 : 0, rl * .3);
    if (M.userData.slide) M.userData.slide.position.z = -.02 + kk * .035;
    if (M.userData.pump) { const pk = p.pumpT > 0 ? Math.sin((1 - p.pumpT / .5) * Math.PI) : 0; M.userData.pump.position.z = -.3 + pk * .09; M.userData.lh.position.z = -.3 + pk * .09; }
    if (M.userData.bolt) { const bk = p.bolt > 0 ? Math.sin((1 - p.bolt / 1.25) * Math.PI) : 0; M.userData.bolt.position.z = .08 + bk * .07; M.userData.bolt.position.y = .02 + bk * .02; }
    M.visible = !(w.id === 'sniper' && A > .85);
  } else if (w.kind === 'throw') {
    const R = M.userData.R; let x = .17, y = -.22, z = -.4, rx = 0;
    if (p.charge > 0) { const c = p.charge; x = .22; y = -.12 + c * .06; z = -.2 + c * .1; rx = -1.2 * c; }
    if (a) { const e = Math.min(1, k * 2); x = .1; y = lerp(-.05, -.25, e); z = lerp(-.15, -.65, e); rx = lerp(-1.2, .6, e); }
    R.position.set(x + bx, y - by + sprintY + bandY, z); R.rotation.set(rx, 0, 0);
  } else if (w.kind === 'legend') {
    const c = p.charge; const ras = M.userData.ras; let z = -.4, y = -.24, x = .12;
    if (a) { const e = ext(k, .35); z = lerp(-.4, -.85, e); y = lerp(-.24, -.15, e); x = lerp(.12, 0, e); }
    else if (c > 0) { x = lerp(.12, .05, c); y = lerp(-.24, -.18, c); }
    M.position.set(x + bx, y - by + sprintY + bandY, z);
    const show = (c > 0 || (a && !a.done)); ras.visible = show; flashL.color.set('#6fb4ff'); flashL.intensity = show ? 1.2 + 1.5 * c : 0; ras.userData.update(t, show ? Math.max(.25, c) : 0); ras.scale.setScalar(.25 + .45 * Math.max(.2, c));
  }
}
