// HELIX · personaggio: corpo procedurale con IK, anatomia interna, fisiologia, ragdoll Verlet,
// combattimento corpo a corpo con guardia, schivate, combinazioni, armi bianche e stamina.
import { THREE, V3, UP, S, G, GFX, scene, camera, clamp, lerp, rand, pick, _v1, _v2, _v3, _v4, _c, chars, hitMeshes, obstacles, player } from './core.js';
import { CAT, SOFT, anatAt, statusOf, ZLABEL, sideLabel } from './anatomy.js';
import { SND, voice } from './audio.js';
import { emitDrops, emitSoft, newPool, setPool, splatter } from './fx.js';
import { makeSurface, paintWound, bleedTick } from './skin.js';
import { los, astar } from './nav.js';
import { collideCircle, surfaceAt } from './world.js';
import { hurtPlayer } from './playerbody.js';
import { log } from './ui.js';

export const BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'hipL', 'knL', 'anL', 'toL', 'hipR', 'knR', 'anR', 'toR'];
const SEGDEF = [ // key, a, b, raggio, scala lat., scala prof., lato, materiale
  ['abd', 'pelvis', 'spine', .145, 1.15, .86, '', 'shirt'], ['tho', 'spine', 'chest', .155, 1.2, .8, '', 'shirt'], ['neck', 'neck', 'head', .055, 1, 1, '', 'skin'],
  ['uarm', 'shL', 'elL', .05, 1, 1, 'L', 'sleeve'], ['farm', 'elL', 'haL', .041, 1, 1, 'L', 'farm'], ['hand', 'haL', 'fiL', .04, 1.15, .6, 'L', 'skin'],
  ['uarm', 'shR', 'elR', .05, 1, 1, 'R', 'sleeve'], ['farm', 'elR', 'haR', .041, 1, 1, 'R', 'farm'], ['hand', 'haR', 'fiR', .04, 1.15, .6, 'R', 'skin'],
  ['thigh', 'hipL', 'knL', .074, 1, 1, 'L', 'pants'], ['shin', 'knL', 'anL', .055, 1, 1, 'L', 'pants'], ['foot', 'anL', 'toL', .045, 1.12, 1, 'L', 'shoe'],
  ['thigh', 'hipR', 'knR', .074, 1, 1, 'R', 'pants'], ['shin', 'knR', 'anR', .055, 1, 1, 'R', 'pants'], ['foot', 'anR', 'toR', .045, 1.12, 1, 'R', 'shoe']];
const STICKS = [['pelvis', 'spine', 1], ['spine', 'chest', 1], ['chest', 'neck', 1], ['neck', 'head', 1], ['chest', 'shL', 1], ['chest', 'shR', 1], ['shL', 'shR', 1], ['shL', 'elL', 1], ['elL', 'haL', 1], ['shR', 'elR', 1], ['elR', 'haR', 1],
['pelvis', 'hipL', 1], ['pelvis', 'hipR', 1], ['hipL', 'hipR', 1], ['hipL', 'knL', 1], ['knL', 'anL', 1], ['anL', 'toL', 1], ['hipR', 'knR', 1], ['knR', 'anR', 1], ['anR', 'toR', 1],
['shL', 'hipL', 1], ['shR', 'hipR', 1], ['shL', 'hipR', .8], ['shR', 'hipL', .8], ['spine', 'shL', .8], ['spine', 'shR', .8], ['spine', 'hipL', .8], ['spine', 'hipR', .8], ['chest', 'pelvis', .9], ['head', 'chest', .35], ['head', 'shL', .25], ['head', 'shR', .25], ['knL', 'toL', .6], ['knR', 'toR', .6]];
const MASSW = { pelvis: .25, spine: .3, chest: .25, head: .6, neck: .6 };
const RAGR = { pelvis: .1, spine: .11, chest: .12, head: .1, neck: .06, shL: .06, shR: .06 };
const SKINS = ['#eac7aa', '#dcae8d', '#c48d68', '#94603f', '#62402b', '#f1d3bd'], SHIRTS = ['#3b4a5c', '#6b6f73', '#7a2e2a', '#2f3a2c', '#c4bca8', '#202226', '#4e4466', '#8a5a2a', '#d8d8d2'], PANTS = ['#2b3850', '#3a3a38', '#4b4536', '#1c1d21', '#59606a'], SHOES = ['#1a1a1a', '#d8d8d8', '#5a4030'], HAIR = ['#1b1410', '#3a2716', '#6b4a2a', '#a8834e', '#2a2a2a'];
const NAMES = ['Rocco', 'Gennaro', 'Tonino', 'Ciro', 'Salvatore', 'Enzo', 'Pasquale', 'Mimmo', 'Carmela', 'Rosaria', 'Assunta', 'Nunzia'];
// combinazioni dell'IA (in ordine di difficoltà)
const AI_COMBOS = [['jab'], ['jab', 'diretto'], ['jab', 'jab', 'diretto'], ['jab', 'gancio'], ['diretto', 'gancio'], ['jab', 'diretto', 'gancio'], ['gancio', 'montante'], ['jab', 'calcio'], ['diretto', 'gancio', 'montante'], ['calcio']];
const AI_MOVE = {
  jab: { dur: .40, E: 75, reach: 1.15, st: 4 }, diretto: { dur: .52, E: 135, reach: 1.18, st: 7 }, gancio: { dur: .62, E: 155, reach: 1.05, st: 9 },
  montante: { dur: .58, E: 145, reach: .95, st: 8 }, calcio: { dur: .85, E: 270, reach: 1.35, st: 14 },
  mazzata: { dur: 1.0, E: 380, reach: 1.6, st: 16, kind: 'blunt' }, coltellata: { dur: .55, E: 0, reach: 1.05, st: 6, kind: 'stab' }, fendente: { dur: .48, E: 0, reach: 1.1, st: 5, kind: 'cut' }
};
let CID = 0;
export const resetCID = () => { CID = 0; };

export class Char {
  constructor(o) {
    this.id = ++CID;
    this.sex = Math.random() < .72 ? 'M' : 'F'; const F = this.sex === 'F';
    this.name = pick(NAMES.filter(n => F === /a$/.test(n))) + ' #' + this.id;
    this.height = F ? rand(1.58, 1.74) : rand(1.67, 1.92); this.build = rand(.94, 1.22); this.s = this.height / 1.78;
    this.mass = (F ? 62 : 77) * Math.pow(this.build, 1.5) * this.s * this.s; this.vol0 = this.mass * (F ? 65 : 70); this.blood = this.vol0; this.f0 = F ? rand(190, 235) : rand(98, 135);
    const sk = { facile: [.15, .4], medio: [.35, .7], esperto: [.65, .95] }[S.skill] || [.35, .7]; this.skill = rand(...sk);
    this.pos = o.pos.clone(); this.yaw = o.yaw || 0; this.vel = new V3(); this.speedNow = 0; this.behavior = S.behavior; this.aggro = S.behavior === 'aggressivo'; this.wanderT = 0; this.wanderTo = null;
    this.J = {}; this.prevJ = {}; BONES.concat(['fiL', 'fiR']).forEach(n => { this.J[n] = new V3(); this.prevJ[n] = new V3(); });
    this.A = {}; for (const id in CAT) this.A[id] = 100;
    this.ph = { hr: 76, sys: 122, dia: 79, spo2: 98, rr: 14, temp: 36.8, pain: 0, painFloor: 0, adr: .08, gcs: 15, conc: 0, koT: 0, pneumoL: 0, pneumoR: 0, tamp: 0, cls: 1, dead: false, hypoxT: 0, winded: 0 };
    this.str = 1; this.est = 100; this.wounds = []; this.zoneDmg = {}; this.zoneHitT = {}; this.marks = []; this.bruiseQ = []; this.mode = 'stand'; this.ragT = 0; this.R = null; this.tone = 0; this.getT = 0;
    this.guard = 0; this.hitGuard = 0; this.guardBroken = 0; this.punch = null; this.comboQ = []; this.punchCd = rand(.6, 1.4); this.stunT = 0; this.slipT = 0; this.duckT = 0;
    this.sOff = new V3(); this.sVel = new V3(); this.hOff = new V3(); this.hVel = new V3(); this.hunch = 0; this.hunchT = 0;
    this.legBad = { L: 0, R: 0 }; this.armBad = { L: 0, R: 0 }; this.phase = Math.random() * 6.28; this.path = []; this.pathT = 0; this.lastVoice = -9; this.retreatT = 0; this.circleT = 0; this.strafe = Math.random() < .5 ? 1 : -1; this.stepAcc = 0; this.lastHitT = -99; this.bleedAcc = 0; this.beatAcc = 0;
    const arms = S.enemyArms; this.weapon = arms === 'tutti' ? pick(['bat', 'knife']) : arms === 'misto' && Math.random() < .4 ? pick(['bat', 'knife']) : null;
    this.mats = { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS), shoe: pick(SHOES), hair: pick(HAIR) }; this.longSleeve = Math.random() < .45;
    this.buildMeshes(); this.computePose(0); this.updateMeshes();
  }
  buildMeshes() {
    const b = this.build, s = this.s; this.segs = []; this.skinMats = [];
    const mk = (sg, type) => {
      const skin = type === 'skin' || (type === 'farm' && !this.longSleeve);
      const hex = skin ? this.mats.skin : type === 'shoe' ? this.mats.shoe : type === 'pants' ? this.mats.pants : this.mats.shirt;
      const map = makeSurface(sg, hex, !skin && type !== 'shoe');
      const m = new THREE.MeshStandardMaterial({ map, color: '#ffffff', roughness: skin ? .55 : .9 });
      if (skin) { m.emissive = new THREE.Color('#2a0c06'); m.emissiveIntensity = .2; this.skinMats.push(m); }
      return m;
    };
    this.computePose(0, true);
    for (const d of SEGDEF) {
      const [k, a, bb, r0, sx, sz, sd, mt] = d; const r = r0 * (k === 'abd' || k === 'tho' ? b : Math.pow(b, .6)) * Math.pow(s, .4) * (this.sex === 'F' && k === 'tho' ? .94 : 1) * (this.sex === 'F' && k === 'abd' ? 1.04 : 1);
      const rest = this.J[a].distanceTo(this.J[bb]); const geo = new THREE.CapsuleGeometry(r, rest, 5, 12);
      const seg = { k, a, b: bb, r, sx, sz, sd, rest, key: k + sd };
      const mat = mk(seg, mt); const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      Object.assign(seg, { mesh, mat }); mesh.userData = { ch: this, seg }; scene.add(mesh); hitMeshes.push(mesh); this.segs.push(seg);
    }
    // testa
    const hr = .104 * Math.pow(s, .3); const hs = { k: 'head', a: 'head', b: 'head', r: hr, sx: .9, sz: 1.05, sy: 1.14, sd: '', rest: 1, key: 'head' };
    const hm = new THREE.MeshStandardMaterial({ map: makeSurface(hs, this.mats.skin, false), color: '#ffffff', roughness: .5, emissive: new THREE.Color('#2a0c06'), emissiveIntensity: .2 }); this.skinMats.push(hm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(hr, 20, 16), hm); head.castShadow = true; head.matrixAutoUpdate = false;
    Object.assign(hs, { mesh: head, mat: hm }); head.userData = { ch: this, seg: hs }; scene.add(head); hitMeshes.push(head); this.segs.push(hs); this.headSeg = hs;
    const feat = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * hr, y * hr, z * hr); m.scale.set(sx, sy, sz); head.add(m); return m; };
    const skinCol = new THREE.Color(this.mats.skin);
    const white = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: .3 }), iris = new THREE.MeshStandardMaterial({ color: pick(['#3a2a1a', '#2e4a5a', '#4a5a2e', '#1a1410']), roughness: .2 }), hair = new THREE.MeshStandardMaterial({ color: this.mats.hair, roughness: .85 }), lip = new THREE.MeshStandardMaterial({ color: skinCol.clone().multiplyScalar(.75), roughness: .6 }), feature = new THREE.MeshStandardMaterial({ color: skinCol, roughness: .5 });
    this.featureMats = [feature];
    for (const sx of [1, -1]) { feat(new THREE.SphereGeometry(hr * .13, 10, 8), white, sx * .36, .12, .84); feat(new THREE.SphereGeometry(hr * .07, 8, 6), iris, sx * .37, .12, .95); feat(new THREE.BoxGeometry(hr * .3, hr * .05, hr * .08), hair, sx * .36, .3, .88); feat(new THREE.SphereGeometry(hr * .16, 8, 6), feature, sx * .98, 0, -.02, .45, 1, .8); }
    feat(new THREE.ConeGeometry(hr * .12, hr * .32, 6), feature, 0, -.05, 1.0).rotation.x = Math.PI / 2; feat(new THREE.BoxGeometry(hr * .36, hr * .06, hr * .06), lip, 0, -.42, .86);
    const hc = feat(new THREE.SphereGeometry(hr * 1.06, 18, 12, 0, Math.PI * 2, 0, this.sex === 'F' ? Math.PI * .62 : Math.PI * .47), hair, 0, .04, -.04); hc.rotation.x = -.35;
    if (this.sex === 'F') feat(new THREE.BoxGeometry(hr * 1.7, hr * 1.6, hr * .5), hair, 0, -.55, -.55);
    // arma dell'avversario
    if (this.weapon) {
      const g = new THREE.Group();
      if (this.weapon === 'bat') { const m = new THREE.Mesh(new THREE.CylinderGeometry(.033, .017, .84, 10), new THREE.MeshStandardMaterial({ color: '#b58a55', roughness: .55 })); m.position.y = .36; g.add(m); }
      else { const bl = new THREE.Mesh(new THREE.BoxGeometry(.004, .17, .022), new THREE.MeshStandardMaterial({ color: '#c8ccd0', metalness: .9, roughness: .25 })); bl.position.y = .13; const hd = new THREE.Mesh(new THREE.BoxGeometry(.02, .1, .028), new THREE.MeshStandardMaterial({ color: '#1d1d1d' })); g.add(bl, hd); }
      g.traverse(o => o.castShadow = true); scene.add(g); this.wpnMesh = g;
    }
    this.computePose(0);
  }
  /* ---- posa procedurale (locomozione + IK) ---- */
  computePose(dt, init) {
    const s = this.s, J = this.J, F = this.sex === 'F', bw = this.build;
    const f = _v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).clone(), r = new V3(-f.z, 0, f.x); this.fwd = f; this.right = r;
    const P = (base, x, y, z) => new V3().copy(base).addScaledVector(r, x).addScaledVector(UP, y).addScaledVector(f, z);
    const spd = this.speedNow; const cad = 1.5 + spd * .38; if (!init) this.phase += dt * Math.PI * cad * (spd > .05 ? 1 : 0);
    const A = Math.min(.55, spd / cad / 2); const crouch = Math.max(this.crouch || 0, this.duckT > 0 ? .55 : 0, this.mode === 'stand' && this.aggro && this.dist < 3 ? .12 : 0);
    const limp = Math.max(this.legBad.L, this.legBad.R), badS = this.legBad.L > this.legBad.R ? 0 : Math.PI;
    let bob = spd > .05 ? -Math.abs(Math.cos(this.phase)) * .025 * Math.min(1, spd) : 0; bob -= limp * Math.max(0, Math.sin(this.phase + badS)) * .06 * Math.min(1, spd * 1.5);
    const pelvisY = .95 * s - crouch * .36 * s + bob; const pel = P(this.pos, 0, pelvisY, 0).add(_v2.copy(this.sOff).multiplyScalar(.35));
    const lean = clamp(spd * .035, 0, .2) + this.hunch * .35 + crouch * .25 + this.guard * .06;
    J.pelvis.copy(pel); J.spine.copy(P(pel, 0, .17 * s * (1 - lean * .25), .17 * s * lean * .6)).addScaledVector(this.sOff, .55);
    J.chest.copy(J.spine).addScaledVector(UP, .18 * s * (1 - lean * .3)).addScaledVector(f, .18 * s * lean).addScaledVector(this.sOff, .5);
    J.neck.copy(J.chest).addScaledVector(UP, .17 * s).addScaledVector(f, .05 * s * lean + .015).addScaledVector(this.sOff, .15);
    J.head.copy(J.neck).addScaledVector(UP, .175 * s).addScaledVector(f, .02).add(this.hOff);
    let tw = 0; if (this.punch) { const p = this.punch, e = this.punchExt(p); tw = (p.arm === 'R' ? 1 : -1) * e * (p.type === 'gancio' || p.type === 'mazzata' ? .6 : .35); }
    const rt = new V3().copy(r).multiplyScalar(Math.cos(tw)).addScaledVector(f, Math.sin(tw));
    const shW = (F ? .172 : .192) * s * Math.pow(bw, .5), hipW = (F ? .105 : .092) * s * Math.pow(bw, .4);
    const shUp = .11 * s; J.shR.copy(J.chest).addScaledVector(rt, shW).addScaledVector(UP, shUp); J.shL.copy(J.chest).addScaledVector(rt, -shW).addScaledVector(UP, shUp);
    J.hipR.copy(pel).addScaledVector(r, hipW).addScaledVector(UP, -.035 * s); J.hipL.copy(pel).addScaledVector(r, -hipW).addScaledVector(UP, -.035 * s);
    // gambe (con calcio)
    const th = .42 * s, sh = .415 * s;
    const kick = this.punch && this.punch.type === 'calcio' ? this.punchExt(this.punch) : 0;
    for (const [sd, off] of [['L', 0], ['R', Math.PI]]) {
      const ph = this.phase + off; const fo = A * Math.cos(ph), lift = Math.max(0, -Math.sin(ph)) * (.09 + spd * .02) * Math.min(1, spd * 1.5) * (1 - this.legBad[sd] * .6);
      const hip = J['hip' + sd]; const sx = sd === 'L' ? -1 : 1;
      let ank = P(this.pos, sx * hipW * 1.05, .085 * s + lift, fo + this.sOff.dot(f) * .2).addScaledVector(r, this.sOff.dot(r) * .15);
      if (kick > 0 && sd === 'R') ank.lerp(P(this.pos, sx * .05, .72 * s, .78 * s), kick);
      const kn = ik2(hip, ank, th, sh, P(_v3.set(0, 0, 0), 0, 0, 1)); J['kn' + sd].copy(kn.mid); J['an' + sd].copy(kn.end); J['to' + sd].copy(kn.end).addScaledVector(f, .15 * s).addScaledVector(UP, -.04 * s);
    }
    // braccia
    const ua = .29 * s, fa = .255 * s;
    for (const sd of ['L', 'R']) {
      const sx = sd === 'L' ? -1 : 1, sh0 = J['sh' + sd], opp = sd === 'L' ? Math.PI : 0;
      const swing = -A * Math.cos(this.phase + opp) * .7; let tgt = P(sh0, sx * .06, -.52 * s, .06 + swing * .5); let pole = P(_v3.set(0, 0, 0), sx * .4, -.5, -.6);
      const g = this.guard * (this.weapon && sd === 'R' ? .3 : 1);
      if (g > .01) { const gp = P(J.chest, sx * (.1 - .04 * g), .14 * s + g * .07, .27 * s - g * .08); tgt.lerp(gp, clamp(g, 0, 1)); pole = P(_v3.set(0, 0, 0), sx * .6, -1, -.1); }
      if (this.weapon && sd === 'R' && this.aggro && !this.punch) { tgt.lerp(P(J.chest, sx * .2, .05, .3), .8); }
      if (this.press && this.press.arm === sd) { const wp = this.woundWorld(this.press.w); tgt.lerp(wp, .9); pole = P(_v3.set(0, 0, 0), sx * .8, -.6, -.2); }
      if (this.holdArm === sd) { const other = sd === 'L' ? 'R' : 'L'; tgt.lerp(_v2.copy(J['sh' + other]).lerp(J['el' + other], .6).addScaledVector(f, .06), .9); }
      if (this.punch && this.punch.arm === sd && this.punch.type !== 'calcio') {
        const p = this.punch, e = this.punchExt(p); const aim = camera.position.clone(); let pt;
        if (p.type === 'gancio' || p.type === 'mazzata' || p.type === 'fendente') { const a = lerp(1.2, -.2, e); pt = P(J.chest, 0, .12 * s, 0).addScaledVector(r, sx * Math.cos(a) * .48).addScaledVector(f, Math.sin(a) * .55 + .05); pole = P(_v3.set(0, 0, 0), sx, .2, -.3); }
        else if (p.type === 'montante') { pt = P(J.chest, sx * .1, lerp(-.15, .25, e), lerp(.15, .4, e)); pole = P(_v3.set(0, 0, 0), sx * .5, -1, .2); }
        else { pt = _v2.copy(J['sh' + sd]).lerp(aim, clamp(.55 + .35 * e, 0, .92)); pt = P(J.chest, sx * .08, .14 * s, .28).lerp(pt, e); }
        tgt.lerp(pt, clamp(e * 1.6, 0, 1));
      }
      if (this.armBad[sd] > .5 && !(this.press && this.press.arm === sd)) { tgt = P(J.chest, sx * .12, -.08, .14); }
      const res = ik2(sh0, tgt, ua, fa, pole); J['el' + sd].copy(res.mid); J['ha' + sd].copy(res.end);
    }
    this.fingers();
  }
  fingers() { const J = this.J; for (const sd of ['L', 'R']) { const d = _v2.copy(J['ha' + sd]).sub(J['el' + sd]).normalize(); J['fi' + sd].copy(J['ha' + sd]).addScaledVector(d, .085 * this.s); } }
  punchExt(p) { const k = p.t / p.dur; return k < .42 ? Math.sin(k / .42 * Math.PI / 2) : Math.max(0, 1 - (k - .42) / .58); }
  updateMeshes() {
    const J = this.J; const bf = this.bodyFwd(); const lt = _v1.copy(J.shL).sub(J.shR).normalize();
    for (const sg of this.segs) {
      const m = sg.mesh;
      if (sg.k === 'head') { const up = _v2.copy(J.head).sub(J.neck).normalize(); const x = _v3.copy(lt).addScaledVector(up, -lt.dot(up)).normalize(); const z = _v4.crossVectors(x, up); m.matrix.makeBasis(x.clone().multiplyScalar(sg.sx), up.clone().multiplyScalar(sg.sy), z.clone().multiplyScalar(sg.sz)); m.matrix.setPosition(J.head); }
      else { const A = J[sg.a], B = J[sg.b]; const ax = _v2.copy(B).sub(A); const len = ax.length(); ax.divideScalar(len || 1); let x = _v3.copy(lt).addScaledVector(ax, -lt.dot(ax)); if (x.lengthSq() < 1e-4) x.crossVectors(ax, bf); x.normalize(); const z = _v4.crossVectors(x, ax); sg.zs = z.dot(bf) < 0 ? -1 : 1; m.matrix.makeBasis(x.clone().multiplyScalar(sg.sx), ax.clone().multiplyScalar(len / sg.rest), z.clone().multiplyScalar(sg.sz)); m.matrix.setPosition((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); }
      m.matrixWorld.copy(m.matrix); m.matrixWorldNeedsUpdate = true;
      for (const ch of m.children) ch.updateMatrixWorld(true);
    }
    if (this.wpnMesh) {
      const h = J.haR, d = _v2.copy(J.haR).sub(J.elR).normalize();
      if (this.weapon === 'bat' && !(this.punch && this.punch.arm === 'R')) d.lerp(UP, .6).addScaledVector(this.fwd, -.2).normalize();
      this.wpnMesh.position.copy(h); this.wpnMesh.quaternion.setFromUnitVectors(UP, d);
      if (this.wpnDropped) { this.wpnMesh.position.copy(this.wpnDropped); this.wpnMesh.quaternion.setFromUnitVectors(UP, _v2.set(1, 0, 0)); }
    }
  }
  localCoords(sg, pw) { const l = sg.mesh.worldToLocal(_v3.copy(pw)); if (sg.k === 'head') return { u: l.x / sg.r, v: l.y / sg.r, w: -l.z / sg.r }; const len = sg.rest; return { u: l.x / sg.r, v: clamp((l.y + len / 2) / len, -1, 2), w: -l.z / sg.r * (sg.zs || 1) }; }
  woundWorld(w) { return w.seg.mesh.localToWorld(_v3.copy(w.local)); }
  segByKey(key) { return this.segs.find(s => s.key === key); }
  /* ================= DANNI ================= */
  dmg(id, amt) { if (!(id in this.A)) return null; this.A[id] = Math.max(0, this.A[id] - amt); return statusOf(id, this.A[id]); }
  zoneMark(sg, front, sev, p, type) {
    const key = sg.key + (front ? '_f' : '_b'); this.zoneDmg[key] = Math.max(this.zoneDmg[key] || 0, sev); this.zoneHitT[key] = G.t;
    if (p && type) { const c = this.localCoords(sg, p); this.marks.push({ z: key, u: c.u, v: c.v, k: sg.k, sd: sg.sd, type }); if (this.marks.length > 60) this.marks.shift(); }
  }
  // percorso del proiettile nel corpo SENZA applicare danni (serve anche alla killcam)
  traceBullet(sg, pIn, dir, E, ammo) {
    const rc = new THREE.Raycaster(_v1.copy(pIn).addScaledVector(dir, 1.2), _v2.copy(dir).negate(), 0, 1.25); const ex = rc.intersectObject(sg.mesh, false);
    const pOut = ex.length ? ex[0].point.clone() : pIn.clone().addScaledVector(dir, sg.r * 2); const uvOut = ex.length ? ex[0].uv : null;
    const L = pIn.distanceTo(pOut); const steps = Math.max(2, Math.ceil(L / .008)); const seq = []; let Erem = E, exited = true;
    const perp1 = new V3().crossVectors(dir, Math.abs(dir.y) < .9 ? UP : _v4.set(1, 0, 0)).normalize(), perp2 = new V3().crossVectors(dir, perp1);
    const cav = []; const p = new V3();
    for (let i = 0; i <= steps; i++) {
      p.copy(pIn).lerp(pOut, i / steps); const c = this.localCoords(sg, p); const id = anatAt(sg.k, sg.sd, c.u, c.v, c.w);
      const cm = (L / steps) * 100; const t = CAT[id]?.t; let cost = ammo.cost * cm; if (t === 'ske') cost = ammo.boneCost * cm; else if (t === 'org' && id.startsWith('polmone')) cost *= .45; Erem -= cost;
      const last = seq[seq.length - 1]; if (!last || last.id !== id) seq.push({ id, dep: Math.min(cost, Erem + cost), pos: p.clone(), k: i / steps, E: Erem + cost }); else last.dep += Math.min(cost, Erem + cost);
      // cavitazione temporanea (proiettili veloci): stira e lacera i tessuti attorno al tramite
      if (ammo.cav && Erem > 600 && i % 3 === 0) {
        const rr = .022 * ammo.cav * clamp(Erem / 2000, .4, 1.4);
        for (const pp of [perp1, perp2]) for (const sgn of [1, -1]) { const q = _v4.copy(p).addScaledVector(pp, rr * sgn); const cc = this.localCoords(sg, q); const cid = anatAt(sg.k, sg.sd, cc.u, cc.v, cc.w); if (!SOFT[cid] && !cav.includes(cid)) cav.push(cid); }
      }
      if (Erem <= 0) { exited = false; Erem = 0; break; }
    }
    const inPath = new Set(seq.map(s => s.id));
    return { seq, cav: cav.filter(id => !inPath.has(id)), pOut, uvOut, L, exited, Erem, Ein: E };
  }
  hitBullet(sg, pIn, dir, E, ammo, label, uvIn, pre) {
    const tr = pre || this.traceBullet(sg, pIn, dir, E, ammo); const { seq, pOut, exited, Erem, L } = tr;
    const front = this.isFront(sg, pIn, dir); const trail = []; let worst = 0; const critical = [];
    for (const s of seq) {
      if (SOFT[s.id]) { if (!trail.length || trail[trail.length - 1] !== SOFT[s.id]) trail.push(SOFT[s.id]); s.label = SOFT[s.id]; continue; }
      const t = CAT[s.id].t;
      let d = t === 'ske' ? 22 + s.dep * 1.6 : t === 'vas' ? 65 + s.dep : t === 'ner' ? 75 : t === 'mus' ? 14 + s.dep * .6 : 38 + s.dep * 1.1; if (s.id === 'cervello' || s.id === 'tronco') d = 95;
      const st = this.dmg(s.id, d); s.status = st ? st[0] : ''; s.label = CAT[s.id].n;
      trail.push(CAT[s.id].n + (st && st[0] !== 'intatto' ? ' (' + st[0] + ')' : '')); worst = Math.max(worst, 100 - this.A[s.id]); if (t !== 'mus') critical.push(s.id); this.onStructure(s.id, 'bullet');
    }
    if (tr.cav.length) { const cl = []; for (const id of tr.cav) { const t = CAT[id].t; const d = t === 'vas' ? 40 * ammo.cav : t === 'org' ? 22 * ammo.cav : t === 'ske' ? 8 : 10; const st = this.dmg(id, d); cl.push(CAT[id].n); this.onStructure(id, 'bullet'); if (t === 'vas' || t === 'org') critical.push(id); } trail.push('cavitazione: ' + cl.slice(0, 4).join(', ')); }
    trail.push(exited ? 'uscita' : 'proiettile ritenuto');
    this.zoneMark(sg, front, Math.max(worst, 40), pIn, 'bullet');
    this.addWound(sg, pIn, dir, true, critical, uvIn, { type: 'entry', cal: ammo.E > 1500 ? 1.2 : ammo.E < 300 ? .85 : 1 });
    if (exited) { this.addWound(sg, pOut, dir, false, critical, tr.uvOut, { type: 'exit', E: Erem }); this.zoneMark(sg, !front, 50, pOut, 'exit'); }
    const pm = ammo.m * Math.sqrt(2 * E / ammo.m); this.sVel.addScaledVector(dir, pm / this.mass * 3 + .35); this.hitGuard = Math.min(1, this.hitGuard + .25); this.flinch(sg, 1); this.stunT = Math.max(this.stunT, .5);
    this.ph.adr = Math.min(1, this.ph.adr + .35); this.ph.pain = Math.min(10, this.ph.pain + (sg.k === 'hand' || sg.k === 'foot' ? 5 : 6)); this.lastHitT = G.t; this.aggro = true;
    if (sg.k === 'thigh' || sg.k === 'shin') { this.legBad[sg.sd] = Math.min(1, this.legBad[sg.sd] + .45); this.sVel.y -= .4; }
    if (sg.k === 'uarm' || sg.k === 'farm') { this.armBad[sg.sd] = Math.min(1, this.armBad[sg.sd] + .35); if (sg.sd === 'R') this.dropWeapon(); }
    if (sg.k === 'tho' || sg.k === 'abd') { this.hunch = Math.min(1, this.hunch + .5); this.hunchT = 3; }
    // sangue: retrospruzzo dall'entrata, cono dall'uscita, nebulizzazione per proiettili veloci
    const back = _v1.copy(dir).negate();
    emitDrops(pIn, back.clone().multiplyScalar(.6), 18, .5, 1.4, { size: [.002, .006] });
    if (exited) {
      const k = clamp(Erem / 800, .3, 2.5);
      emitDrops(pOut, dir, 30 + 25 * k, .3, 2.2 + k * 1.5, { size: [.002, .009] });
      emitSoft('mist', pOut, dir, Math.round(10 + 14 * k), .35, 1.5 + k, { col: '#7a0d0d', size: [.02, .06], grow: 3, alpha: .45 * GFX[S.gfx] + .15, life: [.35, .9] });
      splatter(pOut, dir, 2 + k * 2, .22, 3.5, .18 + k * .08);
      if (sg.k === 'head') emitDrops(pOut, dir, 20, .4, 3, { col: '#d9b8a8', size: [.003, .01], blood: false }); // frammenti
    }
    SND.impact(pIn, critical.some(i => CAT[i].t === 'ske') ? 'bone' : 'flesh', E);
    if (!this.ph.dead) voice(this, this.A.cervello < 5 ? 'gasp' : (Math.random() < .5 ? 'scream' : 'hurt'), 1);
    log(`<b>${label}</b> → ${this.name} · ${ZLABEL[sg.k]}${sideLabel(sg.sd)} (${front ? 'ant.' : 'post.'}) · ${trail.join(' → ')} · ${Math.round(E)} J in, ${Math.round(Erem)} J out`);
    return { Eout: exited ? Erem : 0, L, pOut, seq, trail };
  }
  /* colpo contundente: pugni, calci, mazza, mattone, Rasengan
     o: {rot, mEff, focus, cut, guardBreak, uv, rasengan, type} */
  hitBlunt(sg, p, dir, E, label, o = {}) {
    const front = this.isFront(sg, p, dir);
    // --- guardia: l'avversario può parare con gli avambracci ---
    if (!o.blocked && this.mode === 'stand' && front && this.guard > .3 && !this.ph.dead && (sg.k === 'head' || sg.k === 'neck' || sg.k === 'tho')) {
      let pb = this.guard * (.3 + .55 * this.skill) * this.str * (this.stunT > 0 ? .2 : 1) * (this.guardBroken > 0 ? .1 : 1) * (o.guardBreak ? .2 : 1) * (sg.k === 'tho' ? .5 : 1) * (o.rasengan ? 0 : 1);
      if (Math.random() < pb) {
        const side = _v4.copy(p).sub(this.J.chest).dot(this.right) > 0 ? 'R' : 'L'; const arm = this.armBad[side] < .5 ? side : side === 'L' ? 'R' : 'L';
        const fs = this.segByKey('farm' + arm); const hp = this.J['el' + arm].clone().lerp(this.J['ha' + arm], .45);
        this.est = Math.max(0, this.est - E / 25); this.sVel.addScaledVector(dir, Math.sqrt(2 * E * (o.mEff || 3)) / this.mass * .9);
        if (sg.k === 'head') this.ph.conc += E / 4200;
        if (E > 260 || this.est < 15) { this.guardBroken = 1.2; log(`${this.name}: <b>guardia sfondata</b>`); }
        SND.impact(hp, 'flesh', E * .5);
        this.hitBlunt(fs, hp, dir, E * .5, label + ' · <i>parato</i>', { ...o, blocked: true, uv: null });
        return 'blocked';
      }
    }
    const depth = .02 + E / 3800; const ids = [];
    for (let i = 0; i <= 6; i++) { const q = _v4.copy(p).addScaledVector(dir, depth * i / 6); const c = this.localCoords(sg, q); const id = anatAt(sg.k, sg.sd, c.u, c.v, c.w); if (!ids.includes(id)) ids.push(id); }
    const trail = []; let worst = Math.min(40, E / 6); const focus = o.focus || 1;
    // livido: rossore subito, viola dopo qualche secondo
    if (o.uv) { paintWound(sg, o.uv, 'bruise', { E, stage: 0 }); this.bruiseQ.push({ sg, uv: o.uv, E, t: G.t + 4, stage: 1 }, { sg, uv: o.uv, E, t: G.t + 20, stage: 2 }); }
    for (const id of ids) {
      if (SOFT[id]) continue; const t = CAT[id].t; let d = 0;
      if (t === 'mus') d = E * .05;
      else if (t === 'ske') { const thr = (id === 'mandibola' ? 110 : id === 'cranio' ? 420 : id.startsWith('costa') ? 150 : id === 'sterno' ? 260 : id.startsWith('mano') ? 90 : id.startsWith('ulna') || id.startsWith('radio') ? 200 : id.startsWith('tibia') ? 260 : id.startsWith('femore') ? 900 : id.startsWith('C') ? 600 : 230) / focus; d = E > thr * .5 ? (E - thr * .5) / thr * 55 : 0; }
      else if (t === 'org') {
        if ((id === 'fegato' || id === 'milza') && E > 90) d = (E - 90) * .06;
        if (id.startsWith('polmone') && E > 350) d = (E - 350) * .05;
        if (id === 'cuore' && E > 500) d = (E - 500) * .04;
        if (id.startsWith('rene') && E > 250) d = (E - 250) * .05;
        if ((id === 'tenue' || id === 'crasso' || id === 'stomaco') && E > 300) d = (E - 300) * .03;
        if (id === 'cervello' && E > 380) d = (E - 380) * .04;
      }
      if (o.rasengan) d *= 1.4;
      if (d > 0) { const st = this.dmg(id, d); trail.push(CAT[id].n + (st ? ' (' + st[0] + ')' : '')); worst = Math.max(worst, 100 - this.A[id]); this.onStructure(id, 'blunt'); }
    }
    // Rasengan: la sfera rotante "trita" i tessuti in un volume attorno al punto d'impatto
    if (o.rasengan) {
      const vol = new Set(); for (let i = 0; i < 60; i++) { const q = _v4.copy(p).addScaledVector(dir, rand(0, .26)).add(_v3.set(rand(-.11, .11), rand(-.11, .11), rand(-.11, .11))); const c = this.localCoords(sg, q); vol.add(anatAt(sg.k, sg.sd, c.u, c.v, c.w)); }
      const torn = [];
      for (const id of vol) { if (SOFT[id]) continue; const t = CAT[id].t; const d = t === 'ske' ? rand(45, 95) : t === 'org' ? rand(35, 80) : t === 'vas' ? rand(30, 70) : rand(25, 50); const st = this.dmg(id, d); this.onStructure(id, 'blunt'); worst = Math.max(worst, 100 - this.A[id]); if (t !== 'mus') torn.push(CAT[id].n + (st ? ' (' + st[0] + ')' : '')); }
      if (torn.length) trail.push('<b>vortice</b>: ' + torn.slice(0, 8).join(', '));
      this.ph.koT = Math.max(this.ph.koT, rand(6, 18)); this.ph.pain = 10; this.liverDown = Math.max(this.liverDown || 0, 6);
      this.addWound(sg, p, dir, true, [...vol].filter(i => CAT[i]?.t === 'vas' || CAT[i]?.t === 'org'), null, { type: 'none', bleed: 60 });
    }
    if (!trail.length) trail.push('contusione dei tessuti molli'); this.zoneMark(sg, front, worst, p, o.cut && Math.random() < o.cut ? 'cut' : 'blunt');
    // lacerazioni (tirapugni, mazza sul viso, mattone)
    if (o.cut && (sg.k === 'head' || sg.k === 'hand') && E > 90 && Math.random() < o.cut) { this.addWound(sg, p, dir, true, [], o.uv, { type: 'lacer', bleed: 6 + E / 60, ang: rand(-.6, .6) }); trail.push('lacerazione'); }
    if (sg.k === 'head' && E > 120 && Math.random() < .3) { this.addWound(sg, p, dir, true, [], null, { type: 'none', bleed: 3 + E / 100, nose: true }); if (Math.random() < .5) trail.push('epistassi'); }
    // dinamica del colpo
    const pm = Math.sqrt(2 * E * (o.mEff || 3)); const torsoK = (sg.k === 'head' || sg.k === 'neck') ? .6 : 1; this.sVel.addScaledVector(dir, pm / this.mass * 1.7 * torsoK);
    if (sg.k === 'head' || sg.k === 'neck') {
      this.hVel.addScaledVector(dir, pm / 5 * .5 * (o.rot || 1)); const jaw = ids.includes('mandibola') ? 1.6 : 1; const c = E / 420 * (o.rot || 1) * jaw * (this.stunT > 0 ? 1.25 : 1); this.ph.conc += c;
      if ((c > .55 && Math.random() < (c - .45) * 1.4) || this.ph.conc > 1.25) { this.ph.koT = rand(8, 45) * clamp(this.ph.conc, .6, 2); trail.push('<b>commozione · KO</b>'); }
      else if (c > .25) trail.push('commozione lieve');
    }
    if ((sg.k === 'tho' || sg.k === 'abd') && E > 80) {
      const lc = this.localCoords(sg, p); const liver = ids.includes('fegato') || (sg.k === 'tho' && lc.u < -.25 && lc.v < .4); this.hunch = Math.min(1, this.hunch + .4); this.hunchT = 2; this.ph.winded = Math.min(1, this.ph.winded + E / 350);
      if (liver && E > 110 && Math.random() < .45) { this.ph.pain = 10; this.liverDown = rand(4, 9); trail.push('<b>colpo al fegato</b>'); }
      if (sg.k === 'abd' && E > 140 && Math.random() < .35) { this.liverDown = Math.max(this.liverDown || 0, rand(2, 4)); trail.push('senza fiato'); }
    }
    if ((sg.k === 'thigh' || sg.k === 'shin') && E > 150) { this.legBad[sg.sd] = Math.min(1, this.legBad[sg.sd] + E / 1400); if (o.type === 'calcioBasso') { this.legBad[sg.sd] = Math.min(1, this.legBad[sg.sd] + .2); trail.push('gamba ceduta'); } }
    if ((sg.k === 'farm' || sg.k === 'hand') && sg.sd === 'R' && E > 200 && Math.random() < .5) this.dropWeapon();
    this.stunT = Math.max(this.stunT, Math.min(1.6, E / 260 * (o.rot || 1))); this.est = Math.max(0, this.est - E / 30);
    this.ph.pain = Math.min(10, this.ph.pain + E / 70); this.ph.adr = Math.min(1, this.ph.adr + .12); this.hitGuard = Math.min(1, this.hitGuard + .3); this.lastHitT = G.t; this.aggro = true; this.flinch(sg, .6);
    SND.impact(p, trail.some(t => t.includes('frattur') || t.includes('incrin')) ? 'bone' : 'flesh', E); voice(this, E > 220 ? 'hurt' : 'effort', 1);
    if (E > 140 && sg.k === 'head') emitDrops(p, _v1.copy(dir).negate().multiplyScalar(.4).addScaledVector(UP, .2), 6 + E / 40, .6, 1.1, { size: [.002, .006] });
    if (!o.quiet) log(`<b>${label}</b> → ${this.name} · ${ZLABEL[sg.k]}${sideLabel(sg.sd)} · ${Math.round(E)} J · ${trail.join(' · ')}`);
    return 'hit';
  }
  /* lama: fendente (largo, poco profondo) o affondo (stretto, profondo) */
  hitBlade(sg, p, dir, o) {
    const front = this.isFront(sg, p, dir); const pts = []; const step = .004;
    if (o.slash) { const lat = o.lat || _v4.crossVectors(dir, UP).normalize(); for (let i = -4; i <= 4; i++) { const b = p.clone().addScaledVector(lat, o.width * i / 8); for (let d = 0; d <= o.depth; d += step) pts.push(b.clone().addScaledVector(dir, d)); } }
    else for (let d = 0; d <= o.depth; d += step) pts.push(p.clone().addScaledVector(dir, d));
    const ids = []; let stopped = false;
    for (const q of pts) { const c = this.localCoords(sg, q); const id = anatAt(sg.k, sg.sd, c.u, c.v, c.w); if (stopped && !o.slash) break; if (!ids.includes(id)) ids.push(id); if (CAT[id]?.t === 'ske' && !o.slash) stopped = true; }
    const trail = []; const crit = []; let worst = 20;
    for (const id of ids) {
      if (SOFT[id]) { trail.push(SOFT[id]); continue; } const t = CAT[id].t;
      const d = t === 'vas' ? 75 : t === 'org' ? 45 + o.depth * 300 : t === 'ner' ? 70 : t === 'mus' ? 22 : 6;
      const st = this.dmg(id, d); trail.push(CAT[id].n + (st ? ' (' + st[0] + ')' : '')); worst = Math.max(worst, 100 - this.A[id]); if (t !== 'mus') crit.push(id); this.onStructure(id, 'blade');
    }
    this.zoneMark(sg, front, Math.max(worst, 35), p, o.slash ? 'cut' : 'stab');
    this.addWound(sg, p, dir, true, crit, o.uv, { type: o.slash ? 'cut' : 'stab', bleed: o.slash ? 9 + o.width * 60 : 18 + o.depth * 100, ang: o.ang, len: o.slash ? o.width / .08 : 1 });
    emitDrops(p, _v1.copy(dir).negate().addScaledVector(UP, .3), o.slash ? 14 : 8, .5, o.slash ? 1.6 : .9, { size: [.002, .006] });
    if (crit.some(i => CAT[i].art)) { emitDrops(p, _v1.copy(dir).negate(), 30, .2, 2.6, { size: [.003, .008] }); splatter(p, _v1.copy(dir).negate(), 2, .3, 2, .2); }
    this.sVel.addScaledVector(dir, .3); this.flinch(sg, .8); this.stunT = Math.max(this.stunT, .35);
    this.ph.pain = Math.min(10, this.ph.pain + (o.slash ? 4 : 6)); this.ph.adr = Math.min(1, this.ph.adr + .25); this.lastHitT = G.t; this.aggro = true; this.hitGuard = Math.min(1, this.hitGuard + .3);
    if (sg.k === 'farm' || sg.k === 'hand' || sg.k === 'uarm') { this.armBad[sg.sd] = Math.min(1, this.armBad[sg.sd] + .25); if (sg.sd === 'R' && Math.random() < .4) this.dropWeapon(); }
    if (sg.k === 'thigh' || sg.k === 'shin') this.legBad[sg.sd] = Math.min(1, this.legBad[sg.sd] + .2);
    SND.impact(p, 'wet', 120); voice(this, o.depth > .05 ? 'scream' : 'hurt', 1);
    log(`<b>${o.label}</b> → ${this.name} · ${ZLABEL[sg.k]}${sideLabel(sg.sd)} · ${trail.join(' → ')}`);
  }
  isFront(sg, p, dir) { return dir.dot(this.bodyFwd()) < 0; }
  bodyFwd() { const lt = _v1.copy(this.J.shL).sub(this.J.shR); const up = _v4.copy(this.J.neck).sub(this.J.pelvis); return new V3().crossVectors(lt, up).normalize(); }
  flinch(sg, k) { if (this.mode !== 'stand') return; const d = new V3().setFromMatrixPosition(sg.mesh.matrix).sub(this.J.chest); d.y = 0; if (d.lengthSq() > 1e-6) this.sVel.addScaledVector(d.normalize(), -.25 * k); }
  addWound(sg, p, dir, entry, crit, uv, o = {}) {
    const local = sg.mesh.worldToLocal(p.clone());
    if (o.type && o.type !== 'none') paintWound(sg, uv, o.type, o);
    if (o.type === 'entry' || o.type === 'stab') { const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: '#080303' })); hole.position.copy(local); const hs = o.type === 'stab' ? .003 : .0045; hole.scale.set(hs / sg.sx, hs, hs / sg.sz); sg.mesh.add(hole); }
    const bleed = o.bleed ?? (entry ? 22 : 35);
    const nrm = sg.k === 'head' ? local.clone().normalize() : new V3(local.x, 0, local.z).normalize();
    this.wounds.push({ seg: sg, local, bleed, uv, nrm, art: crit.some(i => CAT[i]?.art), crit: crit.slice(), nose: o.nose });
  }
  dropWeapon() { if (!this.weapon || this.wpnDropped) return; this.wpnDropped = new V3(this.J.haR.x, .03, this.J.haR.z); log(`${this.name} lascia cadere ${this.weapon === 'bat' ? 'la mazza' : 'il coltello'}`); this.weapon = null; SND.impact(this.wpnDropped, this.wpnMesh && this.wpnDropped ? 'wood' : 'metal', 80); }
  onStructure(id, kind) {
    const ph = this.ph;
    if (id === 'cervello' && this.A.cervello < 40) { ph.gcs = 3; ph.koT = 999; }
    if (id === 'tronco' && this.A.tronco < 50) this.die('lesione del tronco encefalico');
    if (id === 'cuore' && this.A.cuore < 60) ph.tamp = Math.min(1, ph.tamp + .3);
    if (id.startsWith('femore') && this.A[id] < 45) this.legBad[id.slice(-1)] = 1;
    if (id.startsWith('tibia') && this.A[id] < 45) this.legBad[id.slice(-1)] = 1;
    if ((id.startsWith('omero') || id.startsWith('radio') || id.startsWith('ulna')) && this.A[id] < 45) this.armBad[id.slice(-1)] = 1;
    if (id.startsWith('plesso') && this.A[id] < 50) this.armBad[id.slice(-1)] = 1;
    if (id.startsWith('sciatico') && this.A[id] < 50) this.legBad[id.slice(-1)] = 1;
    if (id.startsWith('costa') && this.A[id] < 45 && kind === 'blunt') ph.painFloor = Math.min(6, ph.painFloor + 1.5);
    if (CAT[id].t === 'ske' && this.A[id] < 45) ph.painFloor = Math.min(7, ph.painFloor + 1);
  }
  paralysis() { if (this.A.midolloC < 50) return 'tetraplegia'; if (this.A.midolloT < 50 || this.A.midolloL < 50) return 'paraplegia'; return null; }
  canStand() { if (this.ph.dead || this.ph.gcs <= 9 || this.paralysis()) return false; if (this.legBad.L >= 1 || this.legBad.R >= 1) return false; if (this.str < .25) return false; if (this.liverDown > 0) return false; return true; }
  die(why) { if (this.ph.dead) return; this.ph.dead = true; this.ph.gcs = 3; this.deathWhy = why; if (this.mode !== 'rag') this.startRag(null, null); this.tone = 0; this.dropWeapon(); log(`${this.name}: nessun segno vitale (${why})`); }
  /* ================= FISIOLOGIA ================= */
  physio(dt) {
    const ph = this.ph, A = this.A;
    // lividi che maturano
    for (let i = this.bruiseQ.length - 1; i >= 0; i--) { const b = this.bruiseQ[i]; if (G.t >= b.t) { paintWound(b.sg, b.uv, 'bruise', { E: b.E, stage: b.stage }); this.bruiseQ.splice(i, 1); } }
    if (ph.dead) { ph.hr = 0; ph.sys = 0; ph.dia = 0; ph.rr = 0; ph.spo2 = Math.max(0, ph.spo2 - dt * 2); ph.temp = Math.max(34, ph.temp - dt * .0008); this.lossRate = 0; this.bloodVisual(dt, 0); return; }
    const map = (ph.sys + 2 * ph.dia) / 3; let loss = 0;
    for (const id in CAT) { const b = CAT[id].b; if (!b || A[id] >= 99) continue; loss += b * Math.pow((100 - A[id]) / 100, 1.6) * (CAT[id].t === 'ske' ? .6 : 1); }
    for (const w of this.wounds) { w.bleed *= Math.exp(-dt / 240); loss += w.bleed; }
    if (this.press) loss *= .75;
    loss *= clamp(map / 93, 0, 1.2); this.lossRate = loss; this.blood = Math.max(0, this.blood - loss * dt / 60);
    const frac = 1 - this.blood / this.vol0; ph.cls = frac < .15 ? 1 : frac < .3 ? 2 : frac < .4 ? 3 : 4;
    if (A.polmoneL < 90) ph.pneumoL = Math.min(1, ph.pneumoL + dt * (100 - A.polmoneL) / 100 * .012); if (A.polmoneR < 90) ph.pneumoR = Math.min(1, ph.pneumoR + dt * (100 - A.polmoneR) / 100 * .012);
    if (A.cuore < 90) ph.tamp = Math.min(1, ph.tamp + dt * (100 - A.cuore) / 100 * .004);
    ph.winded = Math.max(0, ph.winded - dt * .12);
    const airway = A.trachea < 60 ? (60 - A.trachea) / 60 : 0; const pn = ph.pneumoL + ph.pneumoR;
    const spo2T = clamp(98 - pn * 16 - airway * 30 - (ph.cls >= 4 ? (frac - .4) * 120 : 0) - (ph.rr < 6 ? 25 : 0), 20, 99); ph.spo2 += (spo2T - ph.spo2) * Math.min(1, dt * .25);
    const hrT = ph.cls >= 4 && frac > .48 ? clamp(150 - (frac - .48) * 900, 20, 150) : 72 + ph.adr * 45 + Math.min(85, frac * 230) + pn * 15 + ph.tamp * 30 + ph.pain * 1.5; ph.hr += (hrT - ph.hr) * Math.min(1, dt * .6);
    const sysT = clamp(123 - Math.max(0, frac - .13) * 230 - ph.tamp * 55 + ph.adr * 12, 0, 160); ph.sys += (sysT - ph.sys) * Math.min(1, dt * .5); ph.dia = ph.sys * .64;
    const rrT = (ph.gcs < 6 ? 8 : 14) + frac * 38 + pn * 14 + ph.adr * 5 + ph.winded * 14 + ph.pain * .6; ph.rr += (rrT - ph.rr) * Math.min(1, dt * .5);
    ph.temp = Math.max(34.5, ph.temp - dt * frac * .0025); ph.adr = Math.max(.05, ph.adr - dt / 110);
    ph.pain = Math.max(ph.painFloor, ph.pain - dt * .12); ph.conc = Math.max(0, ph.conc - dt * .006);
    let g = 15; g -= Math.max(0, (88 - ph.spo2)) * .35; if (ph.cls === 3) g -= 1; if (ph.cls === 4) g -= 3 + (frac - .4) * 45; g -= (100 - A.cervello) * .12; g -= ph.conc * 2.5; if (ph.koT > 0) { ph.koT -= dt; g = Math.min(g, ph.koT > 999 ? 3 : 6); }
    ph.gcs = clamp(Math.round(g), 3, 15);
    const effPain = Math.max(0, ph.pain - ph.adr * 4); this.str = clamp((1 - frac * 1.4) * Math.pow(ph.gcs / 15, 1.5) * (1 - effPain * .045) * (1 - ph.winded * .35) * (ph.spo2 < 85 ? ph.spo2 / 85 : 1), 0, 1);
    if (this.liverDown > 0) this.liverDown -= dt;
    if (frac > .62) this.die('shock emorragico irreversibile'); if (ph.sys < 25 && frac > .45) this.die('arresto cardiaco'); if (A.cuore < 8) this.die('lesione cardiaca'); if (ph.spo2 < 40) { ph.hypoxT += dt; if (ph.hypoxT > 45) this.die('ipossia'); }
    const pale = clamp((ph.cls - 1) / 3 * .55 + (ph.spo2 < 88 ? (88 - ph.spo2) / 60 : 0), 0, .7);
    for (const m of this.skinMats.concat(this.featureMats)) { (m.map ? m.color.set('#ffffff') : m.color.set(this.mats.skin)).lerp(_c.set('#c9cbd2'), pale); if (m.emissive) m.emissiveIntensity = .2 * (1 - pale); }
    this.bloodVisual(dt, ph.hr);
  }
  // gocciolamento, zampilli arteriosi a ritmo cardiaco, texture impregnate, pozza a terra
  bloodVisual(dt, hr) {
    const lying = this.mode === 'rag';
    this.bleedAcc += dt; const tick = this.bleedAcc > .25; if (tick) this.bleedAcc = 0;
    this.beatAcc += dt * (hr / 60); const beat = this.beatAcc >= 1; if (beat) this.beatAcc = 0;
    for (const w of this.wounds) {
      const mlps = w.bleed / 60 * (this.ph.dead ? .15 : 1);
      if (tick && w.seg.surf) bleedTick(w, mlps + (w.art ? .3 : 0), .25);
      if (mlps < .02) continue;
      const wp = this.woundWorld(w);
      if (!lying && Math.random() < dt * mlps * 3) emitDrops(wp, _v2.set(0, -.2, 0), 1, .05, .3, { size: [.003, .006] });
      if (w.art && beat && !this.ph.dead && this.ph.sys > 40) {
        const n = _v1.copy(w.nrm).transformDirection(w.seg.mesh.matrixWorld);
        emitDrops(wp, n, 8 * clamp(this.ph.sys / 120, .3, 1), .12, 1.8 * clamp(this.ph.sys / 120, .3, 1.2), { size: [.002, .006] });
      }
    }
    if (lying && (this.lossRate > 1 || this.ph.dead && this.poolVol < 800)) {
      const c = _v3.copy(this.J.chest).lerp(this.J.pelvis, .5); if (this.pool == null) { this.pool = newPool(c); this.poolVol = 0; this.poolC = c.clone(); }
      this.poolVol += Math.max(this.lossRate, this.ph.dead ? 25 : 0) * dt / 60;
      const r = clamp(Math.sqrt(this.poolVol / 1e6 / (Math.PI * .003)), .05, 1.5); this.poolC.lerp(c, dt * .2); setPool(this.pool, this.poolC, r);
    }
  }
  /* ================= RAGDOLL (Verlet) ================= */
  startRag(pt, imp, spin) {
    const prev = this.prevJ, J = this.J, dtp = this.lastDt || 1 / 60, h = 1 / 120; this.mode = 'rag'; this.ragT = 0; this.ragAcc = 0; this.punch = null; this.comboQ = [];
    this.R = {}; for (const n of BONES) { const v = _v1.copy(J[n]).sub(prev[n]).divideScalar(dtp || 1 / 60); if (v.length() > 8) v.setLength(8); this.R[n] = { p: J[n].clone(), o: J[n].clone().addScaledVector(v, -h) }; }
    if (pt && imp) { for (const n of BONES) { const d = this.R[n].p.distanceTo(pt); const k = Math.max(.25, 1 - d / .8); this.R[n].o.addScaledVector(imp, -h * k); } }
    if (spin) { for (const n of BONES) { const rel = _v1.copy(this.R[n].p).sub(this.J.pelvis); const t = _v2.crossVectors(spin, rel); this.R[n].o.addScaledVector(t, -h); } }
    this.rest = STICKS.map(([a, b, k]) => [a, b, k, J[a].distanceTo(J[b])]);
  }
  ragImpulse(pt, dir, k) { if (!this.R) return; for (const n in this.R) { const f = Math.max(0, 1 - this.R[n].p.distanceTo(pt) / .5); this.R[n].o.addScaledVector(dir, -f * k); } }
  ragStep(dt) {
    const h = 1 / 120; this.ragAcc += dt; let it = 0;
    while (this.ragAcc >= h && it++ < 6) {
      this.ragAcc -= h; const R = this.R;
      for (const n of BONES) { const q = R[n]; const vx = (q.p.x - q.o.x) * .995, vy = (q.p.y - q.o.y) * .995, vz = (q.p.z - q.o.z) * .995; q.o.copy(q.p); q.p.x += vx; q.p.y += vy - 9.81 * h * h; q.p.z += vz; }
      if (this.tone > .05) { const k = this.tone * .04; for (const sd of ['L', 'R']) { if (this.armBad[sd] >= 1) continue; const t = _v2.copy(R.head.p).lerp(R.chest.p, .5); R['ha' + sd].p.lerp(t, k); R['el' + sd].p.lerp(R.chest.p, k * .4); } R.head.p.lerp(_v2.copy(R.neck.p).addScaledVector(UP, .17), k * .5); }
      for (let iter = 0; iter < 6; iter++) {
        for (const [a, b, k, rest] of this.rest) { const A = R[a].p, B = R[b].p; const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z; const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6; const wa = MASSW[a] || 1, wb = MASSW[b] || 1; const df = (l - rest) / l * k / (wa + wb); A.x += dx * df * wa; A.y += dy * df * wa; A.z += dz * df * wa; B.x -= dx * df * wb; B.y -= dy * df * wb; B.z -= dz * df * wb; }
        for (const sd of ['L', 'R']) { const hp = R['hip' + sd].p, an = R['an' + sd].p; const d = hp.distanceTo(an); if (d < .45 * this.s) { const c = _v2.copy(hp).add(an).multiplyScalar(.5), dir = _v4.copy(an).sub(hp).normalize(); hp.copy(c).addScaledVector(dir, -.225 * this.s); an.copy(c).addScaledVector(dir, .225 * this.s); } }
        for (const n of BONES) {
          const q = R[n], r = RAGR[n] || .05; if (q.p.y < r) { q.p.y = r; q.o.x = q.p.x - (q.p.x - q.o.x) * .86; q.o.z = q.p.z - (q.p.z - q.o.z) * .86; }
          for (const ob of obstacles) { if (q.p.y > ob.max.y + r || q.p.x < ob.min.x - r || q.p.x > ob.max.x + r || q.p.z < ob.min.z - r || q.p.z > ob.max.z + r) continue; const pens = [[q.p.x - (ob.min.x - r), 0, -1], [(ob.max.x + r) - q.p.x, 0, 1], [q.p.z - (ob.min.z - r), 2, -1], [(ob.max.z + r) - q.p.z, 2, 1], [(ob.max.y + r) - q.p.y, 1, 1]]; pens.sort((a, b) => a[0] - b[0]); const [d, ax, sg] = pens[0]; if (ax === 0) q.p.x += sg * d; else if (ax === 2) q.p.z += sg * d; else q.p.y += d; }
        }
      }
    }
    for (const n of BONES) this.J[n].copy(this.R[n].p); this.fingers();
  }
  /* ================= COMPORTAMENTO / IA ================= */
  // chiamato quando il giocatore carica un colpo: l'avversario può schivare (slip) o abbassarsi
  onThreat(type) {
    if (this.mode !== 'stand' || this.ph.dead || this.stunT > 0 || this.punch || this.dist > 1.7) return;
    const toP = _v1.copy(player.pos).sub(this.pos).normalize(); if (toP.dot(this.fwd) < .5) return;
    const p = this.skill * .38 * this.str * (this.est > 25 ? 1 : .3);
    if (Math.random() > p) return; this.est = Math.max(0, this.est - 5);
    if (type === 'gancio' || type === 'orizzontale' || Math.random() < .3) { this.duckT = .45; }
    else { const sgn = Math.random() < .5 ? 1 : -1; this.hVel.addScaledVector(this.right, sgn * 2.6); this.sVel.addScaledVector(this.right, sgn * .9); this.slipT = .4; }
  }
  think(dt) {
    const ph = this.ph; const toP = _v1.copy(player.pos).sub(this.pos); toP.y = 0; const dist = toP.length(); this.dist = dist;
    if (!this.aggro) { if (this.behavior === 'reagisce' && dist < 5) this.aggro = true; if (this.behavior === 'cammina' && dist < 4) this.aggro = true; }
    if (player.dead) this.aggro = false;
    const st = this.str; let want = new V3(), speed = 0;
    this.stunT = Math.max(0, this.stunT - dt); this.slipT = Math.max(0, this.slipT - dt); this.duckT = Math.max(0, this.duckT - dt); this.guardBroken = Math.max(0, this.guardBroken - dt);
    this.est = Math.min(100, this.est + dt * (this.punch ? 2 : 9) * st);
    const guardT = this.guardBroken > 0 || this.stunT > .3 ? .05 : clamp((this.aggro && dist < 4 ? .45 + this.skill * .45 : 0) + this.hitGuard * .5, 0, 1) * (this.est > 10 ? 1 : .4);
    this.guard = lerp(this.guard, guardT * (this.armBad.L >= 1 && this.armBad.R >= 1 ? 0 : 1), Math.min(1, dt * 7)); this.hitGuard = Math.max(0, this.hitGuard - dt * .25);
    if (this.hunchT > 0) this.hunchT -= dt; else this.hunch = Math.max(0, this.hunch - dt * .4);
    this.hunch = Math.max(this.hunch, this.ph.winded * .6, Math.min(.7, (this.A.fegato < 70 || this.A.milza < 70 || this.A.tenue < 70) ? .4 : 0));
    this.press = null; this.holdArm = null; const worstW = this.wounds.filter(w => w.seg.k === 'tho' || w.seg.k === 'abd' || w.seg.k === 'neck').sort((a, b) => b.bleed - a.bleed)[0];
    if (this.armBad.L >= .5 && this.armBad.R < .5) this.holdArm = 'R'; else if (this.armBad.R >= .5 && this.armBad.L < .5) this.holdArm = 'L';
    if (worstW && !this.punch && (this.retreatT > 0 || !this.aggro || ph.cls >= 2 || this.dist > 3)) { const wp = this.woundWorld(worstW); const side = wp.clone().sub(this.J.chest).dot(this.right) > 0 ? 'R' : 'L'; const arm = this.armBad[side] < .5 ? side : (side === 'L' ? 'R' : 'L'); if (this.armBad[arm] < .5 && this.holdArm !== arm) this.press = { arm, w: worstW }; }
    const fermo = this.behavior === 'fermo';
    const reachW = this.weapon === 'bat' ? 1.45 : this.weapon === 'knife' ? .95 : .9;
    if (this.aggro && !fermo) {
      if (this.retreatT > 0) { this.retreatT -= dt; want.copy(toP).normalize().negate().addScaledVector(this.right, this.strafe * .5); speed = 2.0 * st; }
      else if (dist > 2.4) {
        const target = player.pos; this.pathT -= dt; if (this.pathT <= 0) { this.pathT = .5; this.path = los(this.pos, target) ? [target.clone()] : (astar(this.pos, target) || [target.clone()]); }
        const wp = this.path[0] || target; const d = _v2.copy(wp).sub(this.pos); d.y = 0; if (d.length() < .5 && this.path.length > 1) this.path.shift(); want.copy(d.normalize());
        speed = (dist > 7 ? 4.6 : 2.8) * st;
        if (['pistol', 'rifle', 'sniper', 'shotgun'].includes(player.weapon) && dist > 3) { want.addScaledVector(this.right, this.strafe * .7).normalize(); if (Math.random() < dt * .7) this.strafe *= -1; speed *= 1.1; }
      } else {
        // footwork nella distanza di combattimento: entra per colpire, gira attorno, esce
        const wantsIn = this.comboQ.length > 0 || this.punch || (this.punchCd <= 0 && this.stunT <= 0);
        if (wantsIn && dist > reachW) { want.copy(toP).normalize(); speed = 2.3 * st; }
        else if (!wantsIn && dist < 1.05) { want.copy(toP).normalize().negate().addScaledVector(this.right, this.strafe * .6); speed = 1.4 * st; }
        else { want.copy(this.right).multiplyScalar(this.strafe).addScaledVector(toP.clone().normalize(), dist > 1.6 ? .4 : -.1); speed = (.7 + this.skill * .6) * st; if (Math.random() < dt * .6) this.strafe *= -1; }
      }
      if (this.lastHitT > G.t - .4 && this.str < .6 && Math.random() < .02) this.retreatT = rand(1, 2.5);
    } else if (this.behavior === 'cammina' && !this.aggro) {
      this.wanderT -= dt; if (!this.wanderTo || this.wanderT <= 0 || this.pos.distanceTo(this.wanderTo) < 1) { this.wanderTo = new V3(rand(-40, 40), 0, rand(-30, 10)); this.wanderT = rand(8, 15); this.path = astar(this.pos, this.wanderTo) || []; }
      const wp = this.path[0] || this.wanderTo; const d = _v2.copy(wp).sub(this.pos); d.y = 0; if (d.length() < .6 && this.path.length) this.path.shift(); want.copy(d.normalize()); speed = 1.3 * st;
    }
    if (this.stunT > 0) speed *= .3;
    const leg = Math.max(this.legBad.L, this.legBad.R); speed *= 1 - leg * .6; if (this.hunch > .3) speed *= .7;
    const dv = want.multiplyScalar(speed); this.vel.x = lerp(this.vel.x, dv.x, Math.min(1, dt * 5)); this.vel.z = lerp(this.vel.z, dv.z, Math.min(1, dt * 5));
    let ty = this.yaw; if (this.aggro && dist < 9) ty = Math.atan2(toP.x, toP.z); else if (this.vel.lengthSq() > .05) ty = Math.atan2(this.vel.x, this.vel.z); let dy = ((ty - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI; this.yaw += clamp(dy, -dt * 6 * st - .01, dt * 6 * st + .01);
    // attacco: combinazioni
    this.punchCd -= dt;
    if (this.punch) { this.punch.t += dt * (.7 + .3 * st) * (this.est < 20 ? .75 : 1); const p = this.punch; if (!p.done && p.t > p.dur * .42) { p.done = true; this.resolvePunch(p); } if (p.t >= p.dur) { this.punch = null; if (!this.comboQ.length) { this.punchCd = rand(.5, 1.4) / Math.max(.4, st) * (1.3 - this.skill * .6); if (Math.random() < .5 + this.skill * .3) this.retreatT = rand(.25, .6); } } }
    else if (this.comboQ.length && this.stunT <= 0) { if (dist < reachW + .45) this.startMove(this.comboQ.shift()); else if (dist > 2.5) this.comboQ = []; }
    else if (this.aggro && dist < reachW + .3 && this.punchCd <= 0 && st > .2 && this.retreatT <= 0 && this.stunT <= 0 && this.est > 8 && !player.dead) {
      if (this.weapon === 'bat') this.comboQ = Math.random() < .7 ? ['mazzata'] : ['mazzata', 'mazzata'];
      else if (this.weapon === 'knife') this.comboQ = pick([['coltellata'], ['fendente', 'coltellata'], ['coltellata', 'coltellata'], ['jab', 'coltellata']]);
      else { const n = Math.max(1, Math.round(AI_COMBOS.length * (.35 + this.skill * .65))); this.comboQ = AI_COMBOS[Math.floor(Math.random() * n)].slice(); }
      this.startMove(this.comboQ.shift());
    }
  }
  startMove(type) {
    const M = AI_MOVE[type]; const arms = ['L', 'R'].filter(a => this.armBad[a] < .5); if (!arms.length) { this.comboQ = []; return; }
    let arm = type === 'jab' ? 'L' : type === 'diretto' || type === 'mazzata' || type === 'coltellata' || type === 'fendente' ? 'R' : pick(arms); if (!arms.includes(arm)) arm = arms[0];
    if (type === 'calcio' && this.legBad.R > .4) type = 'jab';
    this.punch = { arm, type, t: 0, dur: M.dur * (1.15 - this.skill * .25), done: false }; this.est = Math.max(0, this.est - M.st);
    voice(this, type === 'mazzata' || type === 'calcio' ? 'kiai' : 'effort', .7);
  }
  resolvePunch(p) {
    const M = AI_MOVE[p.type]; const toP = _v1.copy(player.pos).sub(this.pos); toP.y = 0; const d = toP.length(); const ang = Math.acos(clamp(toP.normalize().dot(this.fwd), -1, 1));
    if (!(d < M.reach && ang < .65 && !player.dead)) { SND.swish(p.type === 'mazzata' ? 1 : 0); return; }
    // zona colpita sul giocatore
    const r = Math.random(); let zone;
    switch (p.type) {
      case 'jab': case 'diretto': zone = r < .7 ? 'testa' : 'torace'; break;
      case 'gancio': zone = r < .72 ? 'testa' : 'addome'; break;
      case 'montante': zone = r < .6 ? 'testa' : 'addome'; break;
      case 'calcio': zone = r < .4 ? 'addome' : r < .7 ? 'torace' : pick(['gambaL', 'gambaR']); break;
      case 'mazzata': zone = r < .42 ? 'testa' : r < .68 ? pick(['braccioL', 'braccioR']) : r < .85 ? 'torace' : pick(['gambaL', 'gambaR']); break;
      default: zone = r < .4 ? 'addome' : r < .7 ? 'torace' : pick(['braccioL', 'braccioR']);
    }
    const E = (M.E || 0) * this.str * (this.sex === 'F' ? .8 : 1) * Math.pow(this.build, .5) * rand(.85, 1.15);
    hurtPlayer({ zone, E, kind: M.kind || 'blunt', move: p.type, from: this });
  }
  update(dt) {
    this.lastDt = dt; for (const n in this.J) this.prevJ[n].copy(this.J[n]); this.physio(dt); const ph = this.ph;
    if (this.mode === 'stand') {
      this.think(dt);
      const bal = clamp(this.str * (1 - Math.max(this.legBad.L, this.legBad.R) * .4) * (1 - ph.conc * .5) * (this.stunT > 0 ? .75 : 1), .15, 1); const k = 55 * bal, c = 8;
      this.sVel.addScaledVector(this.sOff, -k * dt).multiplyScalar(Math.max(0, 1 - c * dt)); this.sOff.addScaledVector(this.sVel, dt);
      this.hVel.addScaledVector(this.hOff, -90 * dt).multiplyScalar(Math.max(0, 1 - 10 * dt)); this.hOff.addScaledVector(this.hVel, dt); const hmax = this.slipT > 0 ? .22 : .12; if (this.hOff.length() > hmax) this.hOff.setLength(hmax);
      const hz = new V3(this.sOff.x, 0, this.sOff.z); if (hz.length() > .09) { this.pos.addScaledVector(hz, dt * 4); this.sOff.addScaledVector(hz, -dt * 1.5); }
      this.pos.addScaledVector(this.vel, dt); this.collide(); this.speedNow = Math.hypot(this.vel.x, this.vel.z) + hz.length() * 2;
      const fall = hz.length() > .3 * bal + .05 || this.sOff.y < -.25; this.crouch = lerp(this.crouch || 0, this.liverDown > 0 ? 1 : 0, Math.min(1, dt * 3));
      if (!this.canStand() || fall) { const imp = _v2.copy(this.sVel).multiplyScalar(1.2); this.startRag(this.J.chest, imp); this.tone = ph.gcs > 9 ? .7 : 0; if (ph.gcs > 9 && !ph.dead) voice(this, 'groan', .7); }
      else { this.computePose(dt); this.stepSound(dt); }
    } else if (this.mode === 'rag') {
      this.ragT += dt; this.tone = ph.dead ? 0 : ph.gcs <= 8 ? 0 : clamp(this.str, .2, .8); this.ragStep(dt);
      if (this.ragT > 2.5 + (1 - this.str) * 5 + this.ph.conc * 4 && this.canStand()) {
        this.mode = 'getup'; this.getT = 0; this.snap = {}; for (const n of BONES) this.snap[n] = this.J[n].clone(); this.pos.set(this.J.pelvis.x, 0, this.J.pelvis.z); this.collide();
        const toP = _v1.copy(player.pos).sub(this.pos); this.yaw = Math.atan2(toP.x, toP.z); this.sOff.set(0, 0, 0); this.sVel.set(0, 0, 0); this.hOff.set(0, 0, 0); voice(this, 'effort', .8);
      }
      if (!ph.dead && ph.gcs > 8 && Math.random() < dt * .15) voice(this, ph.pain > 6 ? 'groan' : 'gasp', .5); if (!ph.dead && (this.A.polmoneL < 60 || this.A.polmoneR < 60) && Math.random() < dt * .12) voice(this, 'cough', .6);
    } else if (this.mode === 'getup') {
      this.getT += dt * (.5 + .5 * this.str); const k = clamp(this.getT / 1.8, 0, 1), e = k * k * (3 - 2 * k); this.crouch = 1 - e; this.speedNow = 0; this.computePose(0); for (const n of BONES) this.J[n].lerp(this.snap[n], 1 - Math.min(1, e * 1.6)); this.fingers();
      if (k >= 1) { this.mode = 'stand'; this.crouch = 0; } if (!this.canStand()) this.startRag(null, null);
    }
    this.updateMeshes();
  }
  stepSound(dt) { if (this.speedNow < .3) return; this.stepAcc += dt * (1.5 + this.speedNow * .38) * 2; if (this.stepAcc > 1) { this.stepAcc = 0; SND.step(this.pos, surfaceAt(this.pos.x, this.pos.z), .12 + this.speedNow * .04); } }
  collide() {
    collideCircle(this.pos, .3, 1.7); for (const o of chars) { if (o === this || o.mode !== 'stand') continue; const d = _v2.copy(this.pos).sub(o.pos); d.y = 0; const l = d.length(); if (l < .62 && l > 0) this.pos.addScaledVector(d, (0.62 - l) / l * .5); }
    const d = _v2.copy(this.pos).sub(player.pos); d.y = 0; const l = d.length(); if (l < .62 && l > 0) this.pos.addScaledVector(d, (0.62 - l) / l);
  }
  dispose() {
    for (const sg of this.segs) { scene.remove(sg.mesh); sg.mesh.traverse(o => { o.geometry && o.geometry.dispose(); }); sg.surf?.tex.dispose(); const i = hitMeshes.indexOf(sg.mesh); if (i >= 0) hitMeshes.splice(i, 1); }
    if (this.wpnMesh) scene.remove(this.wpnMesh);
  }
  condition() { const frac = 1 - this.blood / this.vol0; const a = clamp(1 - frac / .6, 0, 1), b = (this.ph.gcs - 3) / 12, c = clamp((this.ph.spo2 - 40) / 58, 0, 1), d = Math.min(this.A.cervello, this.A.cuore, this.A.tronco) / 100; return this.ph.dead ? 0 : Math.round(100 * Math.min(a, b * .6 + .4, c, d * .7 + .3) * (this.paralysis() ? .5 : 1)); }
  stateText() {
    const ph = this.ph; if (ph.dead) return ['Nessun segno vitale', 'var(--bad)']; if (ph.gcs <= 8) return ['Incosciente · GCS ' + ph.gcs, 'var(--bad)']; const pz = this.paralysis(); if (pz) return ['A terra · ' + pz, 'var(--bad)'];
    if (this.mode === 'rag') return ['A terra · cosciente', 'var(--warn)']; if (this.mode === 'getup') return ['Si rialza', 'var(--warn)'];
    if (this.stunT > .4) return ['Stordito', 'var(--warn)']; if (this.guardBroken > 0) return ['Guardia sfondata', 'var(--warn)']; if (this.retreatT > 0) return ['Arretra', 'var(--warn)'];
    const leg = Math.max(this.legBad.L, this.legBad.R); if (leg > .3) return ['In piedi · zoppica', 'var(--warn)'];
    if (this.aggro) return ['Combatte' + (this.weapon ? (this.weapon === 'bat' ? ' · mazza' : ' · coltello') : '') + ` · fiato ${Math.round(this.est)}%`, 'var(--ok)'];
    return ['In piedi · ' + (this.behavior === 'cammina' ? 'cammina' : 'in attesa'), 'var(--ok)'];
  }
}
// IK a due ossa con vettore polare
export function ik2(a, t, l1, l2, pole) {
  const d = _v2.copy(t).sub(a); let dist = d.length(); const max = (l1 + l2) * .999; if (dist > max) { d.multiplyScalar(max / dist); dist = max; } if (dist < 1e-4) { d.set(0, -1, 0); dist = 1e-4; }
  const dir = d.clone().divideScalar(dist); const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1); const sinA = Math.sqrt(1 - cosA * cosA); const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (bend.lengthSq() < 1e-6) bend.set(0, 0, 1); bend.normalize();
  return { mid: new V3().copy(a).addScaledVector(dir, l1 * cosA).addScaledVector(bend, l1 * sinA), end: new V3().copy(a).addScaledVector(dir, dist) };
}
