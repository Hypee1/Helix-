// HELIX · corpo del giocatore: danni per zona, fratture, sanguinamento, commozione, effetti su vista/udito/movimento
import { G, player, clamp, rand, $, camera, _v1 } from './core.js';
import { SND, muffle } from './audio.js';
import { log } from './ui.js';

export const PZ = ['testa', 'collo', 'torace', 'addome', 'braccioL', 'braccioR', 'gambaL', 'gambaR'];
export const PZLABEL = { testa: 'Testa', collo: 'Collo', torace: 'Torace', addome: 'Addome', braccioL: 'Braccio sx', braccioR: 'Braccio dx', gambaL: 'Gamba sx', gambaR: 'Gamba dx' };
// soglia di frattura (danno accumulato) per zona; null = non si frattura (in questo modello)
const FRACT = { testa: 90, collo: null, torace: 60, addome: null, braccioL: 60, braccioR: 60, gambaL: 70, gambaR: 70 };
const FRACT_N = { testa: 'frattura cranica', torace: 'costole fratturate', braccioL: 'frattura avambraccio sx', braccioR: 'frattura avambraccio dx', gambaL: 'frattura tibia sx', gambaR: 'frattura tibia dx' };

export const PB = {};
export function resetPlayerBody() {
  Object.assign(PB, { z: {}, blood: 5000, vol0: 5000, conc: 0, blur: 0, koT: 0, lastHitT: -99, wobble: 0, ears: 0, beatAcc: 0 });
  for (const z of PZ) PB.z[z] = { dmg: 0, pain: 0, fract: false, bleed: 0, hitT: -99, cuts: 0 };
}
resetPlayerBody();

/* o: {zone, E, kind: 'blunt'|'cut'|'stab'|'bullet'|'blast', move, from} */
export function hurtPlayer(o) {
  if (player.dead) return;
  let zone = o.zone, E = o.E || 0; const kind = o.kind || 'blunt';
  // parata: guardia alta con pugni/tirapugni/mazza contro un avversario frontale
  let blocked = false;
  if (o.from && player.guard > .5 && kind !== 'bullet' && kind !== 'blast') {
    const toE = _v1.copy(o.from.pos).sub(player.pos); toE.y = 0; toE.normalize();
    const fwd = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) }; const facing = toE.x * fwd.x + toE.z * fwd.z;
    if (facing > .55 && (zone === 'testa' || zone === 'torace' || zone === 'collo' || (zone === 'addome' && Math.random() < .5))) {
      blocked = true; const arm = Math.random() < .5 ? 'braccioL' : 'braccioR';
      zone = arm; E *= kind === 'blunt' ? .45 : .7; player.stamina = Math.max(0, player.stamina - 6 - E / 25);
      if (player.stamina < 8) { blocked = false; log('<b>La tua guardia cede</b> — sei senza fiato'); }
    }
  }
  const Z = PB.z[zone]; Z.hitT = G.t; PB.lastHitT = G.t; player.lastHit = G.t;
  let dmg = 0, txt = '';
  if (kind === 'blunt') {
    dmg = E / (zone === 'testa' ? 7 : 9); Z.pain = Math.min(1, Z.pain + E / 300);
    if (zone === 'testa') {
      const c = E / 380 * (o.move === 'gancio' || o.move === 'montante' ? 1.35 : 1); PB.conc += c; PB.blur = Math.min(1, PB.blur + c * .9); PB.wobble = Math.min(1, PB.wobble + c);
      if (c > .35) { SND.tinnitus(1 + c * 3); muffle(1 + c * 2.5, 500); }
      if (E > 140 && Math.random() < .35) { Z.bleed += 4 + E / 60; txt = 'arcata sopraccigliare aperta'; }
      if (PB.conc > 1.15 || (c > .7 && Math.random() < (c - .6))) { PB.koT = 4; txt = 'KO'; }
    }
    if (zone === 'addome') { player.stamina = Math.max(0, player.stamina - E / 6); if (E > 120) txt = 'colpo allo stomaco: senza fiato'; }
    if (zone === 'torace') player.stamina = Math.max(0, player.stamina - E / 12);
  } else if (kind === 'cut') { dmg = 12; Z.bleed += 25; Z.cuts++; Z.pain = Math.min(1, Z.pain + .4); txt = 'taglio'; }
  else if (kind === 'stab') { dmg = 26; Z.bleed += zone === 'collo' ? 400 : zone === 'torace' || zone === 'addome' ? 90 : 50; Z.cuts++; Z.pain = Math.min(1, Z.pain + .7); txt = 'coltellata'; }
  else if (kind === 'bullet') { dmg = E / 14; Z.bleed += 60 + E / 8; Z.pain = 1; txt = 'ferita d\'arma da fuoco'; }
  else if (kind === 'blast') { dmg = E / 10; Z.bleed += E / 15; Z.pain = Math.min(1, Z.pain + .6); PB.blur = Math.min(1, PB.blur + .6); txt = 'schegge'; }
  if (blocked) { dmg *= .6; txt = 'parato con ' + (zone === 'braccioL' ? 'il braccio sx' : 'il braccio dx'); }
  Z.dmg = Math.min(100, Z.dmg + dmg);
  if (FRACT[zone] && !Z.fract && Z.dmg > FRACT[zone] && kind !== 'cut') { Z.fract = true; Z.pain = 1; txt = (txt ? txt + ' · ' : '') + '<b>' + FRACT_N[zone] + '</b>'; SND.impact(camera.position, 'bone', 200); }
  player.shake = Math.min(1, player.shake + .15 + E / 600); SND.hurtMe(clamp(E / 250, .2, 1));
  if (kind === 'blunt' && E > 0) SND.impact(camera.position.clone().addScaledVector(_v1.set(0, 0, -.3).applyQuaternion(camera.quaternion), 1), 'flesh', E);
  $('#vign').style.opacity = clamp(.25 + dmg / 25, 0, .95);
  const who = o.from ? o.from.name : 'Ambiente';
  log(`<span class="me">${who} → TU</span> · ${PZLABEL[zone]} · ${o.move ? o.move + ' · ' : ''}${Math.round(E)} J${txt ? ' · ' + txt : ''}`);
  checkDeath();
}

function checkDeath(why) {
  if (player.dead) return;
  const frac = 1 - PB.blood / PB.vol0;
  const r = why || (PB.z.testa.dmg >= 100 ? 'trauma cranico' : PB.z.torace.dmg >= 100 ? 'trauma toracico' : PB.z.collo.dmg >= 90 ? 'lesione al collo' : frac > .42 ? 'emorragia' : null);
  if (!r) return;
  player.dead = true; player.deathWhy = r; $('#fade').innerHTML = `SEI A TERRA<small>${r}</small>`; $('#fade').style.opacity = .88;
}
export function playerDeadNow(why) { checkDeath(why); }

// stato derivato: mobilità, mira, forza dei colpi
export function pmods() {
  const z = PB.z; const legs = Math.max(z.gambaL.dmg, z.gambaR.dmg) / 100; const legF = z.gambaL.fract || z.gambaR.fract;
  const arm = (a) => (z[a].fract ? .45 : 1) * (1 - z[a].dmg / 250);
  const frac = 1 - PB.blood / PB.vol0;
  return {
    speed: clamp((1 - legs * .45) * (legF ? .5 : 1) * (1 - frac * .8), .25, 1),
    sprint: !legF && frac < .3 && z.torace.dmg < 80,
    power: clamp((arm('braccioL') + arm('braccioR')) / 2 * (1 - frac * .6), .3, 1.1),
    powerL: arm('braccioL'), powerR: arm('braccioR'),
    sway: 1 + (z.braccioL.fract || z.braccioR.fract ? 2.2 : 0) + (z.braccioL.dmg + z.braccioR.dmg) / 120 + PB.conc * 1.5 + frac * 2,
    regen: clamp(1 - z.torace.dmg / 150 - z.addome.dmg / 200 - (z.torace.fract ? .35 : 0), .25, 1),
    limp: legF ? 1 : legs * .6,
    frac
  };
}

export function updatePlayerBody(dt) {
  if (player.dead) return;
  let bleed = 0; for (const k of PZ) { const Z = PB.z[k]; Z.bleed *= Math.exp(-dt / 300); bleed += Z.bleed; Z.pain = Math.max(Z.fract ? .5 : 0, Z.pain - dt * .05); if (G.t - PB.lastHitT > 10 && !Z.fract && Z.dmg > 0 && Z.cuts === 0) Z.dmg = Math.max(0, Z.dmg - dt * .5); }
  PB.bleedRate = bleed; PB.blood = Math.max(0, PB.blood - bleed * dt / 60);
  PB.conc = Math.max(0, PB.conc - dt * .03); PB.blur = Math.max(0, PB.blur - dt * .12); PB.wobble = Math.max(0, PB.wobble - dt * .2);
  if (PB.koT > 0) { PB.koT -= dt; }
  const frac = 1 - PB.blood / PB.vol0;
  // battito nelle orecchie quando si perde molto sangue
  if (frac > .18) { PB.beatAcc += dt * (1.3 + frac * 2); if (PB.beatAcc > 1) { PB.beatAcc = 0; SND.heartbeat(clamp(frac * 2.5, .3, 1)); } }
  // salute globale (per HUD): sangue, testa, torace
  const z = PB.z; player.health = clamp(Math.round(100 * Math.min(1 - frac / .42, 1 - z.testa.dmg / 100, 1 - z.torace.dmg / 110, 1 - z.collo.dmg / 95)), 0, 100);
  checkDeath();
  // effetti visivi sulla tela
  const sat = clamp(1 - frac * 1.8, .15, 1), blur = PB.blur * 3.5 + (PB.koT > 0 ? 6 : 0);
  const el = document.querySelector('#stage canvas'); if (el) el.style.filter = (blur > .1 || sat < .98) ? `blur(${blur.toFixed(2)}px) saturate(${sat.toFixed(2)}) brightness(${(PB.koT > 0 ? .25 : 1 - frac * .4).toFixed(2)})` : '';
}

// bendaggio (tasto B): riduce il sanguinamento della zona peggiore
export function bandage() {
  if (player.bandages <= 0 || player.bandaging > 0 || player.dead) return false;
  let worst = null; for (const k of PZ) if (!worst || PB.z[k].bleed > PB.z[worst].bleed) worst = k;
  if (!worst || PB.z[worst].bleed < 2) { log('Nessuna ferita che sanguina da bendare'); return false; }
  player.bandaging = 2.6; player.bandageZone = worst; SND.bandage(); return true;
}
export function finishBandage() { const Z = PB.z[player.bandageZone]; if (Z) { Z.bleed *= .15; Z.cuts = Math.max(0, Z.cuts - 1); } player.bandages--; log(`Bendaggio applicato: ${PZLABEL[player.bandageZone]}`); }
