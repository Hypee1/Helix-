// HELIX · interfaccia: registro eventi, cartella clinica dell'avversario, HUD del giocatore, barra armi
import { $, $$, G, S, DATA, chars, player, mouse, clamp } from './core.js';
import { CAT, ORDER, statusOf, COL } from './anatomy.js';
import { enemySVG, playerSVG, updateEnemyMap, updatePlayerMap } from './bodymap.js';
import { PB, PZ, PZLABEL, pmods } from './playerbody.js';

export function log(html) { const d = document.createElement('div'); d.innerHTML = html; const L = $('#log'); if (!L) return; L.prepend(d); while (L.children.length > 6) L.lastChild.remove(); }
export function setTarget(c) { G.target = c; }

export function buildHUD() {
  $('#silh').innerHTML = `<figure>${enemySVG('f')}<figcaption>Fronte</figcaption></figure><figure>${enemySVG('b')}<figcaption>Retro</figcaption></figure>`;
  $('#meBody').innerHTML = playerSVG();
  $$('#tabs button').forEach(b => b.onclick = () => { G.tab = b.dataset.t; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); renderPanel(true); });
  $('#wbar').innerHTML = DATA.weapons.weapons.map(w => `<div data-w="${w.id}" class="${w.legend ? 'legend' : ''}"><kbd>${w.key}</kbd><span>${w.n}</span><em></em></div>`).join('');
}
export function showCombo(name, mul) { const el = $('#combo'); el.innerHTML = `<b>${name}</b><span>×${mul.toFixed(2)}</span>`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
export function flashMsg(txt, cls = '') { const el = $('#msg'); el.textContent = txt; el.className = cls; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

let panelSig = '';
export function resetPanel() { panelSig = ''; }
export function renderPanel(force) {
  const c = G.target || chars[0]; if (!c) return; const ph = c.ph;
  $('#tName').textContent = c.name; const cond = c.condition(); $('#tCond').style.width = cond + '%'; $('#tCond').style.background = cond > 60 ? 'var(--ok)' : cond > 30 ? 'var(--warn)' : 'var(--bad)'; $('#tCondV').textContent = cond + '%'; $('#tBlood').textContent = ((c.vol0 - c.blood) / 1000).toFixed(2) + ' L';
  $('#pTgt').textContent = `${c.sex === 'M' ? 'Uomo' : 'Donna'} · ${c.height.toFixed(2)} m · ${Math.round(c.mass)} kg · abilità ${Math.round(c.skill * 100)}`;
  const [stt, col] = c.stateText(); $('#pState').innerHTML = `<span style="color:${col}">${stt}</span>`;
  const v = (l, b, u) => `<div><label>${l}</label><b>${b}</b> <small>${u || ''}</small></div>`;
  $('#vitals').innerHTML = v('FC', Math.round(ph.hr), 'bpm') + v('PA', `${Math.round(ph.sys)}/${Math.round(ph.dia)}`, 'mmHg') + v('SpO₂', Math.round(ph.spo2), '%') + v('FR', Math.round(ph.rr), '/min') + v('Temp', ph.temp.toFixed(1), '°C') + v('GCS', ph.gcs, '/15') + v('Dolore', ph.pain.toFixed(1), '/10') + v('Adrenalina', Math.round(ph.adr * 100), '%') + v('Shock', 'Classe ' + ['I', 'II', 'III', 'IV'][ph.cls - 1], c.lossRate ? Math.round(c.lossRate) + ' mL/min' : '');
  updateEnemyMap($('#silh'), c);
  const sig = G.tab + '|' + Object.values(c.A).join(',') + c.id; if (!force && sig === panelSig) return; panelSig = sig; let h = '';
  const row = id => { const hp = c.A[id]; const [s, cl] = statusOf(id, hp); return `<div class="row"><span>${CAT[id].n}</span><div class="bar"><i style="width:${hp}%;background:${COL[cl] === '#2c3530' ? 'var(--ok)' : COL[cl]}"></i></div><em class="${cl}">${s}</em></div>`; };
  if (G.tab === 'ske') {
    const groups = {}; for (const id of ORDER.ske) { const g = CAT[id].g; (groups[g] = groups[g] || []).push(id); }
    for (const g in groups) { h += `<div class="grp">${g}</div>`; if (groups[g].length > 8) { h += '<div class="chips">' + groups[g].map(id => { const [s, cl] = statusOf(id, c.A[id]); return `<span class="chip ${cl}" title="${CAT[id].n}: ${s}" style="border-color:${COL[cl]}">${CAT[id].short || CAT[id].n}</span>`; }).join('') + '</div>'; } else h += groups[g].map(row).join(''); }
  } else {
    const list = ORDER[G.tab]; h = list.map(row).join('');
    if (G.tab === 'ner') { const pz = c.paralysis(); h += `<div class="grp">Funzione</div><div class="row"><span>${pz ? pz[0].toUpperCase() + pz.slice(1) : 'Motilità conservata'}</span><span></span><em class="${pz ? 's-fra' : 's-ok'}">${pz ? 'lesione midollare' : '—'}</em></div>`; }
    if (G.tab === 'org') {
      h += `<div class="grp">Complicanze</div>`; const cx = []; if (ph.pneumoL > .05) cx.push(['Pneumotorace sx', ph.pneumoL]); if (ph.pneumoR > .05) cx.push(['Pneumotorace dx', ph.pneumoR]); if (ph.tamp > .05) cx.push(['Tamponamento cardiaco', ph.tamp]); if (ph.conc > .15) cx.push(['Trauma cranico / commozione', Math.min(1, ph.conc)]);
      h += cx.length ? cx.map(([n, x]) => `<div class="row"><span>${n}</span><div class="bar"><i style="width:${x * 100}%;background:var(--bad)"></i></div><em class="s-fra">${Math.round(x * 100)}%</em></div>`).join('') : '<div class="row"><span style="color:var(--dim)">Nessuna</span></div>';
    }
    if (G.tab === 'mus') { /* muscoli */ }
  }
  $('#tabBody').innerHTML = h;
}

export function renderHUD(W) {
  const p = player; const m = pmods();
  $('#pHp').style.width = p.health + '%'; $('#pHp').style.background = p.health > 50 ? 'var(--ok)' : p.health > 25 ? 'var(--warn)' : 'var(--bad)'; $('#pSt').style.width = p.stamina + '%';
  $('#pBl').style.width = clamp(PB.blood / PB.vol0 * 100, 0, 100) + '%';
  updatePlayerMap($('#meBody'), PB);
  const st = []; for (const z of PZ) { const Z = PB.z[z]; if (Z.fract) st.push(`<span class="s-fra">${PZLABEL[z]}: frattura</span>`); else if (Z.dmg > 45) st.push(`<span class="s-les">${PZLABEL[z]}: dolorante</span>`); }
  if (PB.bleedRate > 2) st.push(`<span class="s-dis">Sanguinamento ${Math.round(PB.bleedRate)} mL/min</span>`);
  if (PB.conc > .3) st.push(`<span class="s-les">Stordito</span>`);
  if (m.limp > .4) st.push(`<span class="s-les">Zoppichi</span>`);
  st.push(`<span class="dim">Bende: ${p.bandages} (B)</span>`);
  $('#meStat').innerHTML = st.join('');
  // arma
  const w = W.def(p.weapon); $('#wName').textContent = p.weapon === 'throw' ? DATA.weapons.throwables[p.throwKind].n : w.n;
  let a = '';
  if (w.kind === 'gun') { const am = p.ammo[w.id]; a = p.reloading > 0 ? 'ricarica…' : `<b>${am.mag}</b> / ${S.sandbox ? '∞' : am.reserve}`; if (w.id === 'sniper' && p.bolt > 0) a += ' · otturatore'; }
  else if (w.kind === 'throw') a = `<b>${S.sandbox ? '∞' : p.throwN[p.throwKind]}</b> · G cambia`;
  else if (w.kind === 'legend') a = p.chakraCd > 0 ? `chakra ${Math.round((1 - p.chakraCd / 2.5) * 100)}%` : 'tieni premuto sx = colpo · dx = lancio';
  else a = p.guard > .5 ? 'guardia' : '';
  if (p.bandaging > 0) a = 'bendaggio…';
  $('#wAmmo').innerHTML = a;
  $$('#wbar [data-w]').forEach(el => { el.classList.toggle('on', el.dataset.w === p.weapon); const id = el.dataset.w, def = W.def(id); let t = ''; if (def.kind === 'gun') t = p.ammo[id].mag; if (def.kind === 'throw') t = p.throwN[p.throwKind]; el.querySelector('em').textContent = t; });
  // mirino e cannocchiale
  const scoped = w.id === 'sniper' && p.ads > .85;
  $('#scope').hidden = !scoped; $('#cross').style.opacity = scoped ? 0 : w.kind === 'gun' ? 1 - p.ads * .8 : .7;
  const gap = w.kind === 'gun' ? (6 + (w.spread[0] * (1 - p.ads) + Math.hypot(p.vel.x, p.vel.z) * .5 + p.recP * 6) * 4) : 4; const cr = $('#cross').children; cr[0].style.left = (-gap - 7) + 'px'; cr[1].style.left = gap + 'px'; cr[2].style.top = (-gap - 7) + 'px'; cr[3].style.top = gap + 'px';
  const ch = $('#charge'); const showC = (w.kind === 'legend' && p.charge > 0) || (w.kind === 'throw' && p.charge > 0) || p.bandaging > 0;
  ch.hidden = !showC; if (showC) ch.firstElementChild.style.width = (p.bandaging > 0 ? (1 - p.bandaging / 2.6) : p.charge) * 100 + '%';
  const v = $('#vign'); v.style.opacity = Math.max(0, parseFloat(v.style.opacity || 0) - .04) + (p.health < 35 ? (35 - p.health) / 80 : 0);
  $('#slow').hidden = G.userSlow === 1;
}
