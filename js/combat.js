// HELIX · combattimento del giocatore: colpi con combinazioni, lame, mazza, armi da fuoco,
// armi da lancio, granate e Rasengan
import { THREE, V3, UP, S, G, DATA, scene, camera, player, keys, mouse, chars, hitMeshes, obstacleMeshes, clamp, lerp, rand, pick, _v1, _v2 } from './core.js';
import { W, model, flashL, refreshThrowModel } from './weapons.js';
import { SND, rasHum, muffle } from './audio.js';
import { emitDrops, emitSoft, addHole, addShock, addTracer, addScorch, splatter, fxLight } from './fx.js';
import { log, setTarget, showCombo, flashMsg } from './ui.js';
import { pmods, hurtPlayer } from './playerbody.js';
import { VITAL } from './anatomy.js';
import { startKillcam } from './killcam.js';
import { makeRasengan } from './rasengan.js';
import { paintWound } from './skin.js';

const rc = new THREE.Raycaster();
const targets = () => hitMeshes.concat(obstacleMeshes);
const camFwd = () => new V3(0, 0, -1).applyQuaternion(camera.quaternion);
export const projectiles = [];
const rasEvents = [];

/* ================= CORPO A CORPO ================= */
function flick() { const now = performance.now(); let dx = 0, dy = 0; for (const h of mouse.hist) if (now - h.t < 160) { dx += h.dx; dy += h.dy; } return { dx, dy }; }
export function playerAttack(explicit) {
  const p = player; if (p.dead || p.bandaging > 0) return;
  const w = W.def(p.weapon); if (!['fists', 'blade', 'heavy'].includes(w.kind)) return;
  // buffer: un input durante la seconda metà del colpo viene eseguito subito dopo
  if (p.atk) { if (p.atk.t > p.atk.dur * .45) p.queued = explicit || 'auto'; return; }
  let t = explicit && explicit !== 'auto' ? explicit : null, side = null;
  if (w.kind === 'fists') {
    if (!t) {
      const f = flick();
      if (keys.KeyA || (f.dx < -45 && Math.abs(f.dx) > Math.abs(f.dy))) { t = 'gancio'; side = 'L'; }
      else if (keys.KeyD || (f.dx > 45 && Math.abs(f.dx) > Math.abs(f.dy))) { t = 'gancio'; side = 'R'; }
      else if (keys.KeyS || f.dy < -35) t = 'montante';
      else { const last = p.combo[p.combo.length - 1]; t = last && last.type === 'jab' && G.t - last.t < .8 ? 'diretto' : 'jab'; }
    }
    if (t === 'calcio') { if (keys.KeyS) t = 'calcioBasso'; else if (keys.KeyA || keys.KeyD) t = 'calcioCirc'; }
  } else if (w.kind === 'blade') { if (!t) t = 'fendente'; }
  else if (w.kind === 'heavy') { if (!t) t = 'orizzontale'; }
  const P = W.moves(w.kind)[t]; if (!P) return;
  if (!side) side = P.hand || (t.startsWith('calcio') ? 'K' : t === 'gomitata' ? p.nextHand : p.nextHand);
  if (w.kind === 'blade') side = 'R';
  if (side === 'L' || side === 'R') p.nextHand = side === 'L' ? 'R' : 'L';
  // combinazioni
  const prev = p.combo[p.combo.length - 1]; if (prev && G.t - prev.t > .95) p.combo.length = 0;
  p.combo.push({ type: t, t: G.t }); if (p.combo.length > 6) p.combo.shift();
  const seq = p.combo.map(c => c.type); let best = null;
  for (const c of DATA.weapons.combos) { const n = c.seq.length; if (n <= seq.length && c.seq.every((x, i) => x === seq[seq.length - n + i]) && (!best || n > best.seq.length)) best = c; }
  const m = pmods(); const stF = (.45 + .55 * p.stamina / 100);
  p.stamina = Math.max(0, p.stamina - P.st * (best ? .8 : 1));
  const flow = best ? .82 : 1; // nelle combinazioni i colpi escono più fluidi
  p.atk = { type: t, side, t: 0, dur: P.dur * (1.3 - .3 * stF) * flow / Math.max(.6, m.power), done: false, stF, mul: best ? best.mul : 1, gb: best ? !!best.guardBreak : false, combo: best };
  if (best) showCombo(best.n, best.mul);
  SND.swish(w.kind === 'heavy' ? 1 : 0); if (w.kind === 'blade') SND.blade();
  for (const c of chars) c.onThreat && c.onThreat(t);
}
function resolveAttack(a) {
  const p = player, w = W.def(p.weapon), P = W.moves(w.kind)[a.type]; const m = pmods();
  const fwdV = camFwd(); const speedBonus = 1 + clamp(p.vel.dot(_v2.set(fwdV.x, 0, fwdV.z).normalize()) / 6, -.2, .3);
  const handP = a.side === 'L' ? m.powerL : a.side === 'R' ? m.powerR : 1;
  const E = (P.E || 0) * a.stF * speedBonus * rand(.9, 1.1) * handP * (w.Emul || 1) * a.mul;
  const sideX = a.side === 'L' ? -1 : 1;
  let offs;
  if (a.type === 'gancio' || a.type === 'calcioCirc') offs = [[-sideX * .35, 0], [-sideX * .15, 0], [0, 0], [sideX * .12, 0]].map(([y, x]) => [-y, x]);
  else if (a.type === 'calcio') offs = [[0, -.55], [0, -.4], [0, -.7]];
  else if (a.type === 'calcioBasso') offs = [[0, -.95], [.1, -.85], [-.1, -.85], [0, -1.1]];
  else if (a.type === 'montante') offs = [[0, -.12], [0, 0], [0, .08]];
  else if (a.type === 'orizzontale' || a.type === 'fendente') offs = [[.55, 0], [.3, 0], [.12, 0], [0, 0], [-.12, 0], [-.3, 0], [0, -.15], [0, .12]];
  else if (a.type === 'dallalto') offs = [[0, .1], [0, 0], [0, -.15], [.08, -.05], [-.08, -.05]];
  else offs = [[0, 0], [.06, 0], [-.06, 0], [0, -.06]];
  for (const [yo, po] of offs) {
    const e = new THREE.Euler(p.pitch + po + p.recP, p.yaw + yo, 0, 'YXZ'); const dir = new V3(0, 0, -1).applyEuler(e); const o = camera.position.clone();
    if (a.type === 'calcio') o.y -= .5; if (a.type === 'calcioBasso') { o.y -= .9; dir.y = Math.max(dir.y, -.35); dir.normalize(); }
    rc.set(o, dir); rc.far = P.reach + (a.type.startsWith('calcio') ? .3 : 0);
    const hit = rc.intersectObjects(targets(), false)[0]; if (!hit) continue; const ud = hit.object.userData;
    if (ud.ch) {
      const dd = dir.clone(); const latW = new V3(Math.cos(p.yaw), 0, -Math.sin(p.yaw)); // destra dello schermo
      // direzione della traiettoria: il gancio sinistro va verso destra, mazza/coltello/circolare da destra a sinistra
      const sweep = a.type === 'gancio' ? (a.side === 'L' ? .8 : -.8) : (a.type === 'orizzontale' || a.type === 'calcioCirc') ? -.8 : a.type === 'fendente' ? -.6 : 0;
      if (sweep) dd.addScaledVector(latW, sweep).normalize();
      if (a.type === 'montante') dd.y += .6; if (a.type === 'dallalto') dd.y -= .7; dd.normalize();
      const label = (a.combo ? `<i>${a.combo.n}</i> · ` : '') + P.n + (w.id === 'knuckles' ? ' (tirapugni)' : '');
      if (w.kind === 'blade') ud.ch.hitBlade(ud.seg, hit.point, dd, { depth: P.depth * (1 + (a.mul - 1) * 2), width: P.width, slash: P.slash, label: (a.combo ? `<i>${a.combo.n}</i> · ` : '') + 'Coltello · ' + P.n, uv: hit.uv, lat: latW, ang: P.slash ? rand(-.25, .25) : rand(-1.5, 1.5) });
      else {
        const r = ud.ch.hitBlunt(ud.seg, hit.point, dd, E, label, { rot: P.rot, mEff: P.mEff, focus: w.focus || (w.id === 'bat' ? 1.3 : 1), cut: w.cut || (w.id === 'bat' ? .3 : 0), guardBreak: a.gb || (P.power && E > 260), uv: hit.uv, type: a.type });
        if (r === 'blocked') flashMsg('PARATO', 'warn');
      }
      setTarget(ud.ch); p.shake = Math.min(1, p.shake + (w.kind === 'heavy' ? .35 : .15));
      if (ud.ch.mode === 'rag') ud.ch.ragImpulse(hit.point, dd, E / 3000 + (w.kind === 'heavy' ? .1 : 0));
      // rinculo sulle proprie mani: colpire a mani nude un osso duro fa male
      if (w.id === 'fists' && E > 140 && (ud.seg.k === 'head') && Math.random() < .08) hurtPlayer({ zone: a.side === 'L' ? 'braccioL' : 'braccioR', E: 60, kind: 'blunt', move: 'contraccolpo' });
      return;
    }
    SND.impact(hit.point, ud.surf || 'concrete', E * .6); p.shake = .3; if (w.kind === 'fists' && E > 100) hurtPlayer({ zone: a.side === 'L' ? 'braccioL' : 'braccioR', E: E * .15, kind: 'blunt', move: 'pugno al muro' }); return;
  }
}

/* ================= ARMI DA FUOCO ================= */
export function initAmmo() { for (const w of DATA.weapons.weapons) if (w.kind === 'gun') player.ammo[w.id] = { mag: w.mag, reserve: w.reserve }; for (const k in DATA.weapons.throwables) player.throwN[k] = DATA.weapons.throwables[k].count; }
export function fire() {
  const p = player, w = W.def(p.weapon); if (w.kind !== 'gun' || p.dead || p.bandaging > 0) return;
  if (p.reloading > 0) { if (w.perShell && p.ammo[w.id].mag > 0) { p.reloading = 0; } else return; }
  if (p.fireCd > 0 || p.bolt > 0 || p.pumpT > 0) return;
  const am = p.ammo[w.id]; if (am.mag <= 0) { SND.dry(); p.fireCd = .25; return; }
  am.mag--; p.fireCd = w.rof; SND.gun(w.snd);
  const M = model(w.id); const fl = M.userData.flash; fl.visible = true; fl.material.rotation = Math.random() * 6; fl.scale.setScalar(w.id === 'shotgun' ? .32 : w.id === 'sniper' ? .38 : .2); flashL.color.set('#ffb060'); flashL.intensity = 3; setTimeout(() => { fl.visible = false; flashL.intensity = 0; }, 45);
  const m = pmods(); const moving = Math.hypot(p.vel.x, p.vel.z); const ammo = W.ammo(w.ammo);
  const spreadDeg = (lerp(w.spread[0], w.spread[1], p.ads) + moving * .5 * (w.id === 'sniper' ? 2 : 1) + (1 - p.stamina / 100) * .6 + p.recP * 6) * (1 + (m.sway - 1) * .4);
  const muzzle = camera.position.clone().addScaledVector(camFwd(), .6).addScaledVector(_v1.set(1, 0, 0).applyQuaternion(camera.quaternion), .12 * (1 - p.ads)).addScaledVector(UP, -.08 * (1 - p.ads));
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    let sp = spreadDeg * Math.PI / 180; if (n > 1) sp = (w.choke * (1 - p.ads * .3)) * Math.PI / 180;
    const r = Math.sqrt(Math.random()) * sp, a = Math.random() * 6.283;
    const base = n > 1 ? spreadDeg * Math.PI / 180 * .3 : 0;
    const e = new THREE.Euler(p.pitch + p.recP + Math.sin(a) * r + rand(-base, base) * .3, p.yaw + p.recY + Math.cos(a) * r, 0, 'YXZ'); const dir = new V3(0, 0, -1).applyEuler(e);
    const label = `${w.n} · ${ammo.n}`;
    // cecchino: se il colpo attraversa un organo vitale parte la killcam al rallentatore
    if (w.id === 'sniper' && S.killcam) {
      rc.set(camera.position, dir); rc.far = 400; const h = rc.intersectObjects(targets(), false)[0];
      if (h && h.object.userData.ch && !h.object.userData.ch.ph.dead) {
        const ch = h.object.userData.ch, sg = h.object.userData.seg; const tr = ch.traceBullet(sg, h.point, dir, ammo.E, ammo);
        if (tr.seq.some(s => VITAL(s.id)) || tr.cav.some(VITAL)) { startKillcam({ ch, sg, point: h.point.clone(), dir: dir.clone(), uv: h.uv, ammo, label, dist: h.distance, from: muzzle.clone(), trace: tr }); afterShot(w, m); return; }
      }
    }
    const end = fireBullet(camera.position.clone(), dir, ammo, label);
    if (w.id !== 'shotgun' && (w.id === 'sniper' || Math.random() < .4)) addTracer(muzzle, end || camera.position.clone().addScaledVector(dir, 120), w.id === 'sniper' ? '#fff0c8' : '#ffd890', w.id === 'sniper' ? .004 : .003);
  }
  afterShot(w, m);
}
function afterShot(w, m) {
  const p = player; p.recP += w.recoil * rand(.8, 1.2) * (1 + (m.sway - 1) * .3); p.recY += rand(-.3, .3) * w.recoil; model(w.id).userData.kick = 1; p.shake = Math.min(1, p.shake + w.recoil * 1.5);
  if (w.id === 'shotgun') { p.pumpT = .5; SND.pump(); } if (w.id === 'sniper') { p.bolt = 1.25; SND.bolt(); }
  for (const c of chars) if (c.mode === 'stand' && c.pos.distanceTo(p.pos) < 50) { c.aggro = c.aggro || c.behavior !== 'fermo'; c.ph.adr = Math.min(1, c.ph.adr + .05); }
}
export function reload() {
  const p = player, w = W.def(p.weapon); if (w.kind !== 'gun' || p.reloading > 0) return; const am = p.ammo[w.id];
  if (am.mag >= w.mag + (w.perShell ? 0 : 1) || (!S.sandbox && am.reserve <= 0)) return;
  p.reloading = w.perShell ? w.reload : (am.mag > 0 ? w.reload : w.reload * 1.25); if (w.perShell) SND.shell(); else SND.reload();
}
export function tickReload(dt) {
  const p = player; if (p.reloading <= 0) return; p.reloading -= dt; if (p.reloading > 0) return; p.reloading = 0;
  const w = W.def(p.weapon); if (w.kind !== 'gun') return; const am = p.ammo[w.id];
  if (w.perShell) { if (S.sandbox || am.reserve > 0) { am.mag++; if (!S.sandbox) am.reserve--; } if (am.mag < w.mag && (S.sandbox || am.reserve > 0) && !mouse.l) { p.reloading = w.reload; SND.shell(); } else { p.pumpT = .5; SND.pump(); } }
  else { const need = w.mag - am.mag + (am.mag > 0 ? 1 : 0); const take = S.sandbox ? need : Math.min(need, am.reserve); am.mag += take; if (!S.sandbox) am.reserve -= take; }
}
// proiettile istantaneo: attraversa corpi (con perdita di energia) e si ferma sulle superfici
export function fireBullet(o, dir, ammo, label, far = 400) {
  rc.set(o, dir); rc.far = far; const hits = rc.intersectObjects(targets(), false); let E = ammo.E, skip = 0; const done = new Set();
  for (const h of hits) {
    if (h.distance < skip) continue; const ud = h.object.userData;
    if (ud.ch) {
      if (done.has(h.object)) continue; done.add(h.object); setTarget(ud.ch); const res = ud.ch.hitBullet(ud.seg, h.point, dir, E, ammo, label, h.uv);
      if (ud.ch.mode === 'rag') ud.ch.ragImpulse(h.point, dir, .004 * Math.sqrt(E / 500));
      E = res.Eout; skip = h.distance + res.L + .002; if (E < 25) return h.point; continue;
    }
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : dir.clone().negate(); addHole(h.point, n);
    const metal = ud.surf === 'metal'; emitDrops(h.point, n, metal ? 8 : 12, .5, metal ? 4 : 2.2, { col: metal ? '#ffd28a' : ud.surf === 'wood' ? '#7a5a3a' : '#8a857c', size: [.002, .006], blood: false, drag: 1.5 });
    if (metal) emitSoft('glow', h.point, n, 6, .6, 3, { col: '#ffb050', size: [.01, .02], life: [.05, .15], g: 1, alpha: 1 });
    else emitSoft('mist', h.point, n, 5, .4, .8, { col: '#9a958c', size: [.04, .1], life: [.4, 1], g: -.05, alpha: .4 });
    SND.impact(h.point, ud.surf || 'concrete', E); return h.point;
  }
  if (dir.y < 0) { const t = -o.y / dir.y; const p = o.clone().addScaledVector(dir, t); if (t < far) { emitSoft('mist', p, UP, 6, .5, .9, { col: '#7a7262', size: [.04, .09], life: [.4, 1], alpha: .45 }); emitDrops(p, UP, 6, .6, 1.6, { col: '#6d665a', blood: false }); SND.impact(p, 'dirt', E * .5); return p; } }
  return null;
}

/* ================= ARMI DA LANCIO ================= */
export function cycleThrow() { const ks = Object.keys(DATA.weapons.throwables); player.throwKind = ks[(ks.indexOf(player.throwKind) + 1) % ks.length]; refreshThrowModel(); flashMsg(W.thr(player.throwKind).n); }
export function throwItem() {
  const p = player, kind = p.throwKind, T = W.thr(kind); if (!S.sandbox && p.throwN[kind] <= 0) { SND.dry(); p.charge = 0; return; }
  if (!S.sandbox) p.throwN[kind]--; const power = .45 + .55 * p.charge; p.charge = 0; p.atk = { type: 'lancio', t: 0, dur: .45, done: true, side: 'R' };
  const dir = camFwd(); const v = dir.clone().multiplyScalar(T.v * power * (pmods().powerR * .4 + .6)).addScaledVector(UP, 1.2).add(p.vel);
  let mesh;
  if (kind === 'tknife') { mesh = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.004, .025, .16), new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: .9, roughness: .25 })); b.position.z = -.06; const h = new THREE.Mesh(new THREE.BoxGeometry(.012, .02, .08), new THREE.MeshStandardMaterial({ color: '#222' })); h.position.z = .05; mesh.add(b, h); }
  else if (kind === 'brick') mesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .2), new THREE.MeshStandardMaterial({ color: '#9a4a32', roughness: .95 }));
  else { mesh = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), new THREE.MeshStandardMaterial({ color: '#3d4a2e', roughness: .7 })); }
  mesh.castShadow = true; const pos = camera.position.clone().addScaledVector(dir, .4).addScaledVector(_v1.set(1, 0, 0).applyQuaternion(camera.quaternion), .15); mesh.position.copy(pos); scene.add(mesh);
  projectiles.push({ kind, mesh, p: pos, v, m: T.m, life: 12, fuse: kind === 'grenade' ? T.fuse : 0, spin: new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), spinR: kind === 'tknife' ? 18 : kind === 'brick' ? 6 : 8, rest: false });
  SND.swish(.5); for (const c of chars) if (c.mode === 'stand' && c.pos.distanceTo(p.pos) < 30) c.aggro = c.aggro || c.behavior !== 'fermo';
}
function stickTo(pr, obj, point, dir) {
  // il coltello si conficca: diventa figlio della mesh colpita
  pr.rest = true; pr.stuck = true; obj.updateMatrixWorld(true);
  const m = pr.mesh; scene.remove(m); m.position.copy(obj.worldToLocal(point.clone().addScaledVector(dir, .04)));
  const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, -1), dir.clone()); const pq = new THREE.Quaternion(); obj.getWorldQuaternion(pq); m.quaternion.copy(pq.invert().multiply(q)); obj.add(m);
}
export function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    if (pr.kind === 'ras') { if (updateRasProjectile(pr, dt)) projectiles.splice(i, 1); continue; }
    pr.life -= dt; if (pr.fuse > 0) { pr.fuse -= dt; if (pr.fuse <= 0) { explode(pr.mesh.getWorldPosition(new V3())); scene.remove(pr.mesh); projectiles.splice(i, 1); continue; } }
    if (pr.rest) { if (pr.life <= 0 && !pr.stuck) { scene.remove(pr.mesh); projectiles.splice(i, 1); } continue; }
    pr.v.y -= 9.81 * dt; const step = pr.v.clone().multiplyScalar(dt); const len = step.length();
    rc.set(pr.p, step.clone().normalize()); rc.far = len + .03; const h = rc.intersectObjects(targets(), false)[0];
    if (h) {
      const ud = h.object.userData; const sp = pr.v.length(); const dir = pr.v.clone().normalize();
      if (ud.ch) {
        const ch = ud.ch, sg = ud.seg; setTarget(ch);
        if (pr.kind === 'tknife' && sp > 8 && Math.random() < .7) { ch.hitBlade(sg, h.point, dir, { depth: .05 + sp * .004, width: 0, slash: false, label: 'Coltello da lancio', uv: h.uv }); stickTo(pr, h.object, h.point, dir); pr.life = 999; continue; }
        const E = .5 * pr.m * sp * sp * (pr.kind === 'brick' ? 1 : 2);
        ch.hitBlunt(sg, h.point, dir, E, pr.kind === 'brick' ? 'Mattone' : pr.kind === 'grenade' ? 'Granata (impatto)' : 'Coltello (di piatto)', { mEff: pr.m * 1.5, rot: 1.2, cut: pr.kind === 'brick' ? .45 : .2, uv: h.uv, focus: pr.kind === 'brick' ? 1.4 : 1 });
        if (ch.mode === 'rag') ch.ragImpulse(h.point, dir, E / 4000);
        pr.v.multiplyScalar(-.15); pr.v.y = Math.abs(pr.v.y);
      } else {
        const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : dir.clone().negate();
        if (pr.kind === 'tknife' && ud.surf === 'wood' && sp > 8) { stickTo(pr, h.object, h.point, dir); SND.impact(h.point, 'wood', 120); pr.life = 999; continue; }
        pr.v.reflect(n).multiplyScalar(pr.kind === 'brick' ? .25 : .4); SND.impact(h.point, ud.surf || 'concrete', pr.m * sp * sp * .2); if (pr.kind === 'grenade') SND.bounce(h.point);
        if (pr.kind === 'brick' && sp > 6) emitDrops(h.point, n, 10, .6, 2, { col: '#9a4a32', blood: false });
      }
      pr.p.copy(h.point).addScaledVector(pr.v.clone().normalize(), .02);
    } else pr.p.add(step);
    if (pr.p.y < .04) { pr.p.y = .04; if (Math.abs(pr.v.y) > 1.2) { if (pr.kind === 'grenade') SND.bounce(pr.p); else SND.impact(pr.p, 'concrete', 40); } pr.v.y = Math.abs(pr.v.y) * (pr.kind === 'grenade' ? .35 : .2); pr.v.x *= .6; pr.v.z *= .6; if (pr.v.length() < .6) { pr.rest = true; pr.life = pr.kind === 'grenade' ? 99 : 20; if (pr.kind === 'brick') pr.mesh.rotation.set(0, Math.random() * 6, 0); } }
    pr.mesh.position.copy(pr.p); if (!pr.rest) { if (pr.kind === 'tknife') pr.mesh.rotateX(-pr.spinR * dt); else pr.mesh.rotateOnAxis(pr.spin, pr.spinR * dt); }
  }
}
export function explode(pos) {
  SND.explosion(pos); addShock(pos, .2, 5, .45, '#ffb36a'); addShock(pos, .1, 2.2, .25, '#ffffff');
  emitSoft('glow', pos, UP, 70, 1, 7, { col: '#ff9a3a', size: [.15, .35], life: [.15, .45], g: -.1, alpha: .9, grow: 1.5 });
  emitSoft('mist', pos, UP, 60, .9, 3.5, { col: '#4a4540', size: [.3, .6], life: [1.5, 3.5], g: -.08, alpha: .55, grow: 3, drag: 1.5 });
  emitDrops(pos, UP, 40, 1, 7, { col: '#3a3530', blood: false, size: [.004, .012] });
  fxLight(pos.clone().setY(pos.y + .5), '#ffb060', 14, .35, null, 20);
  addScorch(pos, 1.6, false);
  // schegge
  const frag = W.ammo('frag');
  for (let i = 0; i < 70; i++) { const d = new V3(rand(-1, 1), rand(-.2, 1), rand(-1, 1)).normalize(); fireBullet(pos.clone().addScaledVector(UP, .05), d, { ...frag, E: frag.E * rand(.35, 1) }, 'Scheggia di granata', 22); }
  // onda di sovrappressione sui personaggi
  for (const c of chars) {
    const d = c.J.chest.distanceTo(pos); if (d > 7) continue; const E = Math.min(3200, 7000 / (d * d + .6)); const dir = c.J.chest.clone().sub(pos).normalize();
    const sg = c.segByKey('tho'); c.hitBlunt(sg, c.J.chest.clone().addScaledVector(dir, -.12), dir, E * .35, 'Onda d\'urto', { mEff: 8, rot: .6, quiet: d > 3, guardBreak: true });
    c.ph.conc += E / 4000; if (c.mode === 'stand' && E > 400) c.startRag(c.J.chest, dir.clone().multiplyScalar(Math.min(12, E / 220)).addScaledVector(UP, Math.min(5, E / 500)), dir.clone().cross(UP).multiplyScalar(2));
    else if (c.mode === 'rag') c.ragImpulse(c.J.chest, dir, E / 9000);
  }
  const dp = player.pos.distanceTo(pos);
  if (dp < 8) {
    const E = Math.min(3000, 6000 / (dp * dp + .6)); player.shake = 1; muffle(3, 250); SND.tinnitus(4);
    hurtPlayer({ zone: pick(['torace', 'addome', 'gambaL', 'gambaR', 'braccioL', 'braccioR', 'testa']), E: E * .25, kind: 'blast', move: 'esplosione' });
    for (let k = 0; k < 3; k++) if (Math.random() < (1 - dp / 8) * .7) hurtPlayer({ zone: pick(['torace', 'addome', 'gambaL', 'gambaR', 'braccioL', 'braccioR', 'testa', 'collo']), E: 200, kind: 'bullet', move: 'scheggia' });
  } else if (dp < 25) player.shake = Math.min(1, player.shake + (1 - dp / 25) * .6);
}

/* ================= RASENGAN ================= */
export function rasStart(btn) { const p = player; if (p.chakraCd > 0 || p.atk || p.dead) return; p.charge = .001; p.chargeBtn = btn; }
export function rasRelease() {
  const p = player; const c = p.charge; p.charge = 0; rasHum(0);
  if (c < .3) { flashMsg('Chakra insufficiente: tieni premuto più a lungo', 'warn'); return; }
  p.chakraCd = 2.5; SND.rasRelease();
  if (p.chargeBtn === 0) { p.atk = { type: 'rasengan', t: 0, dur: .5, done: false, power: c, side: 'R' }; }
  else {
    const dir = camFwd(); const mesh = makeRasengan(.06 + .07 * c); const pos = camera.position.clone().addScaledVector(dir, .6); mesh.position.copy(pos); scene.add(mesh);
    fxLight(pos, '#6fb4ff', 3, 2.6, mesh, 5);
    projectiles.push({ kind: 'ras', mesh, p: pos, v: dir.multiplyScalar(19), life: 2.6, power: c, t: 0 }); p.atk = { type: 'lancio', t: 0, dur: .35, done: true, side: 'R' };
  }
}
export function resolveRasMelee(a) {
  const dir = camFwd();
  for (const [yo, po] of [[0, 0], [.08, 0], [-.08, 0], [0, -.1], [0, .08]]) {
    const e = new THREE.Euler(player.pitch + po, player.yaw + yo, 0, 'YXZ'); const d = new V3(0, 0, -1).applyEuler(e);
    rc.set(camera.position, d); rc.far = 1.6; const h = rc.intersectObjects(targets(), false)[0]; if (!h) continue;
    if (h.object.userData.ch) { rasenganImpact(h.object.userData.ch, h.object.userData.seg, h.point, d, a.power, h.uv); return; }
    rasBurst(h.point, d, a.power); return;
  }
  rasBurst(camera.position.clone().addScaledVector(dir, 1.2), dir, a.power * .5);
}
function updateRasProjectile(pr, dt) {
  pr.t += dt; pr.life -= dt; pr.mesh.userData.update(G.t, pr.power);
  emitSoft('glow', pr.p, pr.v.clone().multiplyScalar(-.02), 3, .3, .6, { col: '#6fb4ff', size: [.03, .07], life: [.15, .35], g: 0, alpha: .7 });
  const step = pr.v.clone().multiplyScalar(dt); rc.set(pr.p, step.clone().normalize()); rc.far = step.length() + .08; const h = rc.intersectObjects(targets(), false)[0];
  if (h) {
    scene.remove(pr.mesh); pr.mesh.userData.dispose();
    if (h.object.userData.ch) rasenganImpact(h.object.userData.ch, h.object.userData.seg, h.point, pr.v.clone().normalize(), pr.power, h.uv); else rasBurst(h.point, pr.v.clone().normalize(), pr.power);
    return true;
  }
  pr.p.add(step); pr.mesh.position.copy(pr.p);
  if (pr.life <= 0 || pr.p.y < 0) { rasBurst(pr.p, pr.v.clone().normalize(), pr.power * .6); scene.remove(pr.mesh); pr.mesh.userData.dispose(); return true; }
  return false;
}
function rasBurst(pos, dir, power) {
  addShock(pos, .1, 1.5 + 2 * power, .4); emitSoft('glow', pos, dir.clone().negate(), 50, 1, 4, { col: '#7fc0ff', size: [.05, .14], life: [.2, .6], g: 0, alpha: .9 });
  emitSoft('mist', pos, UP, 25, 1, 2, { col: '#8a8578', size: [.2, .4], life: [.8, 2], g: -.05, alpha: .4 }); SND.rasImpact(pos); player.shake = Math.min(1, player.shake + .4);
  if (pos.y < .6) addScorch(pos, .6 + power * .7, true);
  for (const c of chars) { const d = c.J.chest.distanceTo(pos); if (d < 2.5) { const dd = c.J.chest.clone().sub(pos).normalize(); if (c.mode === 'stand') c.startRag(c.J.chest, dd.multiplyScalar(6 * power * (1 - d / 2.5)).addScaledVector(UP, 2)); } }
}
export function rasenganImpact(ch, sg, point, dir, power, uv) {
  setTarget(ch); const mesh = makeRasengan(.09 + .06 * power); mesh.position.copy(point); scene.add(mesh);
  rasEvents.push({ ch, sg, local: sg.mesh.worldToLocal(point.clone()), dir: dir.clone(), t: 0, power, mesh, uv, painted: false });
  fxLight(point, '#6fb4ff', 4, 1.2, mesh, 6);
  G.drama = { t: 1.1, scale: .3 }; SND.rasImpact(point); flashMsg('RASENGAN', 'legend');
  if (ch.mode === 'stand') { ch.stunT = 3; ch.guard = 0; ch.comboQ = []; ch.punch = null; }
}
export function updateRasEvents(dt) {
  for (let i = rasEvents.length - 1; i >= 0; i--) {
    const e = rasEvents[i]; e.t += dt; const ch = e.ch; const wp = e.sg.mesh.localToWorld(e.local.clone());
    e.mesh.position.copy(wp); e.mesh.userData.update(G.t, 1); e.mesh.scale.setScalar(1 + e.t * 1.2 + Math.sin(e.t * 60) * .08);
    if (!e.painted) { paintWound(e.sg, e.uv, 'spiral'); ch.zoneMark(e.sg, ch.isFront(e.sg, wp, e.dir), 70, wp, 'spiral'); e.painted = true; }
    // fase di "macinazione": scintille, brandelli di stoffa, sangue
    emitSoft('glow', wp, e.dir.clone().negate(), 6, 1.2, 2.5, { col: '#8cc8ff', size: [.02, .06], life: [.1, .3], g: 0, alpha: 1 });
    if (Math.random() < .5) emitDrops(wp, e.dir.clone().negate().addScaledVector(UP, .3), 3, .8, 2.5, { col: ch.mats.shirt, blood: false, size: [.004, .01] });
    if (Math.random() < .4) emitDrops(wp, e.dir.clone().negate(), 4, .9, 2, { size: [.002, .006] });
    if (ch.mode === 'stand') ch.sVel.addScaledVector(e.dir, 2.5 * dt); else if (ch.R) ch.ragImpulse(wp, e.dir, .0006);
    player.shake = Math.min(1, player.shake + dt * 1.5);
    if (e.t > .55) {
      const E = 1500 * e.power + 700;
      ch.hitBlunt(e.sg, wp, e.dir, E, 'RASENGAN', { rasengan: true, rot: 2.2, mEff: 30, guardBreak: true, uv: null });
      const imp = e.dir.clone().multiplyScalar(9 + 9 * e.power).addScaledVector(UP, 3 + 2 * e.power); const spin = e.dir.clone().cross(UP).multiplyScalar(-(5 + 5 * e.power));
      if (ch.mode !== 'rag') ch.startRag(wp, imp, spin); else { ch.ragImpulse(wp, e.dir, .08 * e.power); }
      addShock(wp, .1, 1.8 + 2.2 * e.power, .5); addShock(wp, .05, .9, .2, '#ffffff'); fxLight(wp, '#9fd0ff', 10, .4, null, 10);
      emitSoft('glow', wp, e.dir, 80, 1.2, 6, { col: '#7fc0ff', size: [.04, .12], life: [.2, .6], g: 0, alpha: 1 });
      emitDrops(wp, e.dir, 60, .5, 4, { size: [.002, .008] }); splatter(wp, e.dir, 5, .4, 4, .35);
      addScorch(new V3(wp.x, 0, wp.z).addScaledVector(e.dir, 1), 1 + e.power, true);
      for (const c of chars) { if (c === ch) continue; const d = c.J.chest.distanceTo(wp); if (d < 2.6 && c.mode === 'stand') { const dd = c.J.chest.clone().sub(wp).normalize(); c.startRag(c.J.chest, dd.multiplyScalar(5 * (1 - d / 2.6)).addScaledVector(UP, 1.5)); } }
      player.shake = 1; muffle(1, 900);
      scene.remove(e.mesh); e.mesh.userData.dispose(); rasEvents.splice(i, 1);
    }
  }
}
export function resetCombat() { for (const pr of projectiles) { pr.mesh.parent && pr.mesh.parent.remove(pr.mesh); } projectiles.length = 0; for (const e of rasEvents) scene.remove(e.mesh); rasEvents.length = 0; }

/* ================= AGGIORNAMENTO ATTACCHI ================= */
export function tickAttack(dt) {
  const p = player; if (!p.atk) return; p.atk.t += dt;
  const w = W.def(p.weapon);
  if (!p.atk.done) {
    if (p.atk.type === 'rasengan' && p.atk.t >= p.atk.dur * .4) { p.atk.done = true; resolveRasMelee(p.atk); }
    else if (p.atk.type !== 'rasengan') { const P = W.moves(w.kind)?.[p.atk.type]; if (P && p.atk.t >= p.atk.dur * P.hit) { p.atk.done = true; resolveAttack(p.atk); } }
  }
  if (p.atk.t >= p.atk.dur) { p.atk = null; if (p.queued) { const q = p.queued; p.queued = null; playerAttack(q === 'auto' ? null : q); } }
}
