// HELIX · avvio: caricamento asset, menu, input, ciclo di gioco
import { THREE, V3, $, $$, S, G, DATA, player, keys, mouse, chars, renderer, scene, camera, mountRenderer, loadAssets, rand } from './core.js';
import { buildWorld, applyTod, updateSky } from './world.js';
import { buildNav } from './nav.js';
import { auInit, AU, rasHum } from './audio.js';
import { initFx, updateFx, resetFx } from './fx.js';
import { Char, resetCID } from './char.js';
import { W, buildViewmodels, setWeapon } from './weapons.js';
import { updatePlayer } from './player.js';
import { playerAttack, fire, reload, initAmmo, cycleThrow, throwItem, rasStart, rasRelease, updateProjectiles, updateRasEvents, resetCombat, fireBullet, explode } from './combat.js';
import { updateKillcam, killcamActive, skipKillcam } from './killcam.js';
import { resetPlayerBody, bandage, PB } from './playerbody.js';
import { buildHUD, renderHUD, renderPanel, resetPanel, log, flashMsg } from './ui.js';

const SPAWNS = [[0, -4], [-8, 2], [8, 0], [-3, 8], [14, -6], [-14, -2]];

async function boot() {
  await loadAssets(p => { $('#loadBar').style.width = Math.round(p * 100) + '%'; });
  mountRenderer($('#stage'));
  buildWorld(); buildNav(); initFx(); buildViewmodels(); buildHUD();
  readCfg(); applyTod(); initAmmo(); setWeapon('fists');
  newRound(); updatePlayer(0, 0);
  $('#loading').hidden = true; $('#menu').hidden = false;
  requestAnimationFrame(loop);
}

/* ================= ROUND ================= */
function newRound() {
  for (const c of chars) c.dispose(); chars.length = 0; resetCID(); resetFx(); resetCombat(); resetPlayerBody(); resetPanel();
  Object.assign(player, { pos: new V3(0, 0, -14), vel: new V3(), yaw: Math.PI, pitch: 0, health: 100, stamina: 100, dead: false, reloading: 0, atk: null, queued: null, combo: [], charge: 0, chakraCd: 0, bandages: 3, bandaging: 0, bolt: 0, pumpT: 0, guard: 0, deadT: 0 });
  initAmmo(); $('#fade').style.opacity = 0; $('#fade').innerHTML = ''; $('#log').innerHTML = ''; rasHum(0);
  for (let i = 0; i < S.n; i++) { const [x, z] = SPAWNS[i]; chars.push(new Char({ pos: new V3(x + rand(-1, 1), 0, z + rand(-1, 1)), yaw: Math.PI })); }
  G.target = chars[0]; renderPanel(true);
}

/* ================= MENU ================= */
function readCfg() {
  S.n = +$('#cN').value; S.behavior = $('#cB').value; S.skill = $('#cK').value; S.enemyArms = $('#cA').value; S.tod = $('#cT').value; S.gfx = $('#cG').value;
  S.sens = +$('#cS').value; S.fov = +$('#cF').value; S.voice = +$('#cV').value; S.sandbox = $('#cX').value === '1'; S.killcam = $('#cKc').value === '1';
  if (AU.voice) AU.voice.gain.value = S.voice; applyTod();
  try { localStorage.setItem('helix.cfg', JSON.stringify(S)); } catch (e) { }
}
function loadCfg() {
  try { const s = JSON.parse(localStorage.getItem('helix.cfg') || 'null'); if (!s) return; const map = { cN: s.n, cB: s.behavior, cK: s.skill, cA: s.enemyArms, cT: s.tod, cG: s.gfx, cS: s.sens, cF: s.fov, cV: s.voice, cX: s.sandbox ? '1' : '0', cKc: s.killcam === false ? '0' : '1' }; for (const k in map) if (map[k] !== undefined) $('#' + k).value = map[k]; } catch (e) { }
}
function pause() { G.running = false; $('#menu').hidden = false; $('#bPlay').textContent = 'Riprendi'; $('#bNew').hidden = false; rasHum(0); }
function resume() {
  auInit(); if (AU.ctx.state === 'suspended') AU.ctx.resume(); const prev = [S.n, S.behavior, S.skill, S.enemyArms].join(); readCfg();
  $('#menu').hidden = true; $('#hud').hidden = false; G.running = true;
  if (!G.started || prev !== [S.n, S.behavior, S.skill, S.enemyArms].join()) { G.started = true; newRound(); }
  lock();
}
$('#bPlay').onclick = resume; $('#bNew').onclick = () => { readCfg(); newRound(); resume(); };

/* ================= INPUT ================= */
const cvs = renderer.domElement;
function weaponByKey(k) { return DATA.weapons.weapons.find(w => w.key === k); }
function cycleWeapon(d) { const L = DATA.weapons.weapons; const i = L.findIndex(w => w.id === player.weapon); setWeapon(L[(i + d + L.length) % L.length].id); }
addEventListener('keydown', e => {
  keys[e.code] = true; if (!G.running) return;
  if (killcamActive()) { if (e.code === 'Space' || e.code === 'Enter') skipKillcam(); return; }
  if (e.code === 'Tab') { e.preventDefault(); if (chars.length) { const i = chars.indexOf(G.target); G.target = chars[(i + 1) % chars.length]; resetPanel(); renderPanel(true); } }
  if (e.code.startsWith('Digit')) { const w = weaponByKey(e.code.slice(5)); if (w) setWeapon(w.id); }
  const w = W.def(player.weapon);
  if (e.code === 'KeyG' && w.kind === 'throw') cycleThrow();
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyF') { if (w.kind === 'fists') playerAttack('calcio'); else if (w.id === 'bat') playerAttack('dallalto'); else if (w.id === 'knife') playerAttack('affondo'); }
  if (e.code === 'KeyV') { if (w.kind === 'fists') playerAttack('gomitata'); else if (w.id === 'bat') playerAttack('affondoM'); }
  if (e.code === 'KeyB') bandage();
  if (e.code === 'KeyX') { G.userSlow = G.userSlow === 1 ? .25 : 1; }
  if (e.code === 'KeyT') { const o = ['giorno', 'tramonto', 'notte']; S.tod = o[(o.indexOf(S.tod) + 1) % 3]; $('#cT').value = S.tod; applyTod(); }
  if (e.code === 'KeyN') newRound();
  if (e.code === 'KeyH') { const o = ['org', 'ske', 'vas', 'ner', 'mus']; G.tab = o[(o.indexOf(G.tab) + 1) % o.length]; $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === G.tab)); renderPanel(true); }
  if (G.noLock && e.code === 'Escape') pause();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => {
  if (!G.running || !(G.locked || G.noLock) || killcamActive()) return;
  const w = W.def(player.weapon); const zoom = w.id === 'sniper' && player.ads > .6 ? 1 / w.scope : 1;
  const k = .0022 * S.sens * (1 - player.ads * .35) * zoom; player.yaw -= e.movementX * k; player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * k));
  mouse.hist.push({ t: performance.now(), dx: e.movementX, dy: e.movementY }); if (mouse.hist.length > 40) mouse.hist.shift();
});
cvs.addEventListener('mousedown', e => {
  if (!G.running) return; if (killcamActive()) { skipKillcam(); return; }
  if (!G.locked && !G.noLock) { lock(); return; }
  const w = W.def(player.weapon);
  if (e.button === 0) {
    mouse.l = true;
    if (w.kind === 'gun') fire(); else if (w.kind === 'throw') { if (!player.atk) player.charge = .001; } else if (w.kind === 'legend') rasStart(0); else playerAttack();
  }
  if (e.button === 2) { mouse.r = true; if (w.id === 'knife') playerAttack('affondo'); if (w.kind === 'legend') rasStart(2); }
});
addEventListener('mouseup', e => {
  const w = W.def(player.weapon);
  if (e.button === 0) { mouse.l = false; if (G.running && w.kind === 'throw' && player.charge > 0) throwItem(); if (G.running && w.kind === 'legend' && player.chargeBtn === 0 && player.charge > 0) rasRelease(); }
  if (e.button === 2) { mouse.r = false; if (G.running && w.kind === 'legend' && player.chargeBtn === 2 && player.charge > 0) rasRelease(); }
});
addEventListener('wheel', e => { if (G.running && !killcamActive()) cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
cvs.addEventListener('contextmenu', e => e.preventDefault());
function lock() { try { const r = cvs.requestPointerLock(); if (r && r.catch) r.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; } }
document.addEventListener('pointerlockchange', () => { G.locked = document.pointerLockElement === cvs; if (!G.locked && G.running && !G.noLock) pause(); });
document.addEventListener('pointerlockerror', () => { G.noLock = true; });

/* ================= CICLO ================= */
let last = performance.now(), hudT = 0, fpsN = 0, fpsT = 0, kcCamNow = null;
// un passo di simulazione (usato dal ciclo e dai test automatici)
function step(rdt) {
  let drama = 1; if (G.drama) { G.drama.t -= rdt; drama = G.drama.scale; if (G.drama.t <= 0) G.drama = null; }
  kcCamNow = updateKillcam(rdt);
  const dt = rdt * G.timeScale * G.userSlow * drama; G.t += dt;
  updatePlayer(dt, rdt); for (const c of chars) c.update(dt); updateProjectiles(dt); updateRasEvents(dt); updateFx(dt, rdt);
  hudT += rdt; if (hudT > .1) { hudT = 0; renderHUD(W); renderPanel(false); }
  if (player.dead) { player.deadT = (player.deadT || 0) + rdt; if (player.deadT > 4.5) newRound(); }
}
function loop(now) {
  requestAnimationFrame(loop); const rdt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.running && !G.frozen) step(rdt);
  updateSky(player.pos, G.t);
  renderer.render(scene, (G.running && kcCamNow) || camera); fpsN++; fpsT += rdt; if (fpsT > 1) { $('#fps').textContent = fpsN + ' fps'; fpsN = 0; fpsT = 0; }
}

loadCfg();
boot().catch(err => { console.error(err); $('#loadMsg').textContent = 'Errore di caricamento: ' + err.message + ' — apri il gioco tramite un server (vedi README) oppure usa dist/helix-standalone.html'; });
// gancio per debug / test automatici
window.__helix = { G, S, player, chars, scene, camera, fireBullet, explode, newRound, setWeapon, PB, W, keys, mouse, playerAttack, fire, throwItem, rasStart, rasRelease, cycleThrow, skipKillcam, killcamActive,
  steps: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(dt); } };
