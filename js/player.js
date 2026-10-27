// HELIX · giocatore: movimento, camera, mira, respiro, guardia, ricariche e tempi delle armi
import { V3, S, G, player, keys, mouse, camera, clamp, lerp, rand } from './core.js';
import { collideCircle, surfaceAt, insideWare } from './world.js';
import { SND, AU, setReverb, rasHum } from './audio.js';
import { W, animVM } from './weapons.js';
import { pmods, PB, updatePlayerBody, finishBandage } from './playerbody.js';
import { fire, tickReload, tickAttack } from './combat.js';

export function updatePlayer(dt, rdt) {
  const p = player; const m = pmods(); const w = W.def(p.weapon);
  updatePlayerBody(dt);
  const ko = PB.koT > 0 || p.dead;
  const fw = new V3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw)), rt = new V3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
  const mx = ko ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), mz = ko ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const crouchT = (keys.KeyC || keys.ControlLeft) ? 1 : 0; p.crouch = lerp(p.crouch, ko ? 1 : crouchT, Math.min(1, dt * 8));
  const scoped = w.id === 'sniper' && p.ads > .5;
  const sprint = keys.ShiftLeft && mz > 0 && p.stamina > 4 && p.crouch < .4 && p.ads < .3 && m.sprint && !ko && p.charge <= 0;
  const spd = ko ? 0 : (sprint ? 6.2 : p.crouch > .5 ? 1.4 : 2.7) * m.speed * (1 - p.ads * .45) * (p.bandaging > 0 ? .4 : 1);
  const want = fw.multiplyScalar(mz).addScaledVector(rt, mx); if (want.lengthSq() > 0) want.normalize().multiplyScalar(spd);
  const acc = p.onGround ? 9 : 1.5; p.vel.x = lerp(p.vel.x, want.x, Math.min(1, dt * acc)); p.vel.z = lerp(p.vel.z, want.z, Math.min(1, dt * acc));
  if (keys.Space && p.onGround && p.stamina > 10 && !ko && m.speed > .5) { p.vel.y = 4.1; p.onGround = false; p.stamina -= 10; }
  p.vel.y -= 9.81 * dt; p.pos.addScaledVector(p.vel, dt); if (p.pos.y <= 0) { if (!p.onGround) SND.step(null, surfaceAt(p.pos.x, p.pos.z), .4); p.pos.y = 0; p.vel.y = 0; p.onGround = true; }
  collideCircle(p.pos, .32, 1.7);
  const moving = Math.hypot(p.vel.x, p.vel.z);
  // fiato
  if (sprint && moving > 3) p.stamina = Math.max(0, p.stamina - dt * 13 * (PB.z.torace.fract ? 1.8 : 1));
  else p.stamina = Math.min(100, p.stamina + dt * (moving > .5 ? 7 : 13) * m.regen * (p.guard > .5 ? .5 : 1));
  // trattenere il respiro col cecchino (Shift mentre miri)
  const hold = scoped && keys.ShiftLeft && p.stamina > 5; if (hold) { p.breathHold += dt; p.stamina = Math.max(0, p.stamina - dt * 9); } else p.breathHold = Math.max(0, p.breathHold - dt * 2);
  const holding = hold && p.breathHold < 4.5;
  if (p.onGround && moving > .6) { p.bob += dt * moving * 2.1; p.stepAcc += dt * moving * .62; if (p.stepAcc > 1) { p.stepAcc = 0; SND.step(null, surfaceAt(p.pos.x, p.pos.z), sprint ? .45 : .28); } }
  const leanT = ko ? 0 : (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0); p.lean = lerp(p.lean, leanT, Math.min(1, dt * 7));
  // mira / guardia
  const adsT = (w.kind === 'gun' && mouse.r && !p.reloading && !sprint && !ko) ? 1 : 0; p.ads = lerp(p.ads, adsT, Math.min(1, rdt * (w.id === 'sniper' ? 7 : 10)));
  const guardT = ((w.kind === 'fists' || w.id === 'bat') && mouse.r && !ko && !p.atk) ? 1 : 0; p.guard = lerp(p.guard, guardT, Math.min(1, dt * 12));
  p.recP *= Math.exp(-dt * (w.id === 'sniper' ? 3.5 : 6.5)); p.recY *= Math.exp(-dt * 6.5);
  p.fireCd -= dt; p.pumpT = Math.max(0, (p.pumpT || 0) - dt); p.bolt = Math.max(0, p.bolt - dt); p.chakraCd = Math.max(0, p.chakraCd - dt);
  tickReload(dt);
  if (p.bandaging > 0) { p.bandaging -= dt; if (p.bandaging <= 0) { p.bandaging = 0; finishBandage(); } }
  if (w.auto && mouse.l && !ko && !G.killcam) fire();
  // caricamenti
  if (p.charge > 0) {
    if (w.kind === 'legend') { p.charge = Math.min(1, p.charge + dt / 1.1); rasHum(p.charge, 1 + p.charge * .7); p.shake = Math.max(p.shake, p.charge * .08); }
    else if (w.kind === 'throw') p.charge = Math.min(1, p.charge + dt / .8);
  }
  // oscillazione della mira: respiro, fiato, braccia ferite
  const breathAmp = ((1 - p.stamina / 100) * .012 + .0016) * m.sway * (scoped ? 2.2 : 1) * (holding ? .12 : 1);
  p.sway += dt * (1.2 + (1 - p.stamina / 100) * 2.5); const swP = Math.sin(p.sway * 1.3) * breathAmp * (1 - .55 * p.ads * (scoped ? 0 : 1)), swY = Math.cos(p.sway) * breathAmp * .7 * (1 - .55 * p.ads * (scoped ? 0 : 1));
  const wob = PB.wobble; const limpBob = p.onGround && moving > .5 ? Math.max(0, Math.sin(p.bob)) * .05 * m.limp : 0;
  const eye = lerp(1.66, 1.08, p.crouch) - (p.dead ? 1.25 : 0) - (PB.koT > 0 ? .4 : 0); const bobY = p.onGround ? Math.sin(p.bob * 2) * .028 * Math.min(1, moving / 3) : 0;
  camera.position.set(p.pos.x, p.pos.y + eye + bobY - limpBob, p.pos.z).addScaledVector(rt, p.lean * .38); p.shake *= Math.exp(-dt * 6); const sh = p.shake * .03;
  camera.rotation.set(p.pitch + p.recP + swP + rand(-sh, sh) + Math.sin(G.t * 1.7) * wob * .05 - (p.dead ? .6 : 0), p.yaw + p.recY + swY + rand(-sh, sh) + Math.sin(G.t * 1.1) * wob * .06, -p.lean * .14 + Math.sin(G.t * 2.3) * wob * .09 + (p.dead ? .5 : 0));
  const zoom = w.id === 'sniper' ? 1 - (1 - 1 / w.scope) * clamp((p.ads - .6) / .4, 0, 1) : 1 - p.ads * .18;
  const fovT = S.fov * zoom; if (Math.abs(camera.fov - fovT) > .05) { camera.fov = lerp(camera.fov, fovT, Math.min(1, rdt * 12)); camera.updateProjectionMatrix(); }
  tickAttack(dt);
  if (AU.breath) AU.breath.gain.setTargetAtTime(holding ? 0 : Math.pow(1 - p.stamina / 100, 1.5) * .22 * (.55 + .45 * Math.sin(G.t * (2 + (1 - p.stamina / 100) * 4))), AU.ctx.currentTime, .05);
  setReverb(insideWare(p.pos)); animVM(dt, moving, sprint, G.t);
}
