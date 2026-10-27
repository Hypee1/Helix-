// HELIX · mappa del corpo umano in SVG: le zone colpite diventano rosse in base al danno,
// pulsano quando sono doloranti e mostrano i punti esatti di entrata/uscita, tagli e coltellate.
import { G } from './core.js';

// forme per il LATO SINISTRO della persona in vista frontale (a destra dello schermo); il lato destro è speculare
const SHAPES = {
  head: { e: [50, 17, 10, 12.5] },
  neck: { d: 'M44.5 27 L55.5 27 L56.5 36 L43.5 36 Z' },
  tho: { d: 'M31 39 Q50 33 69 39 L71 50 L67 74 L33 74 L29 50 Z' },
  abd: { d: 'M33 74 L67 74 L67.5 92 Q50 99 32.5 92 Z' },
  uarm: { d: 'M70 39.5 Q77.5 40 79.5 48 L79 71 L71.5 71 L70.5 52 Z', side: 1 },
  farm: { d: 'M71.5 72 L79 72 L82.5 97 L76 98 Z', side: 1 },
  hand: { e: [80, 105, 4.6, 6.8], side: 1 },
  thigh: { d: 'M51 95 L67 92 Q67.5 112 64 136 L54.5 136 Q51 115 51 95 Z', side: 1 },
  shin: { d: 'M54.5 138 L64 138 Q63.5 158 62 178 L56.5 178 Q55 158 54.5 138 Z', side: 1 },
  foot: { d: 'M56 180 L62.5 180 L66 188 Q60 190 55 188 Z', side: 1 },
};
const DECO_F = 'M50 42 L50 72 M36 52 Q43 57 49 53 M64 52 Q57 57 51 53 M42 78 L58 78 M42 84 L58 84 M50 74 L50 92 M56 128 Q59 131 62 128 M38 128 Q41 131 44 128';
const DECO_B = 'M50 38 L50 94 M38 46 Q42 54 47 50 M62 46 Q58 54 53 50 M40 88 Q45 92 50 90 Q55 92 60 88';
const mirrorPath = d => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, x, y) => `${(100 - +x).toFixed(1)} ${y}`);
const pts = d => [...d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map(m => [+m[1], +m[2]]);

function shapeFor(k, sd, view) {
  const S = SHAPES[k]; let mirror = false;
  if (S.side) mirror = view === 'f' ? sd === 'R' : sd === 'L'; // in vista frontale la sinistra della persona sta a destra
  if (S.e) { const [cx, cy, rx, ry] = S.e; const x = mirror ? 100 - cx : cx; return { el: `<ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}"/>`, bb: [x - rx, cy - ry, rx * 2, ry * 2] }; }
  const d = mirror ? mirrorPath(S.d) : S.d; const p = pts(d); const xs = p.map(a => a[0]), ys = p.map(a => a[1]);
  return { el: `<path d="${d}"/>`, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] };
}
const KEYS = ['head', 'neck', 'tho', 'abd', 'uarmL', 'uarmR', 'farmL', 'farmR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
const BB = {}; // bounding box per zona/vista, per collocare i segni

// SVG per un avversario: vista 'f' (fronte) o 'b' (retro)
export function enemySVG(view) {
  let h = `<svg viewBox="0 0 100 196" class="body" data-view="${view}"><g class="zones">`;
  for (const key of KEYS) { const k = key.replace(/[LR]$/, ''), sd = k !== key ? key.slice(-1) : ''; const s = shapeFor(k, sd, view); BB[key + '_' + view] = s.bb; h += s.el.replace(/^<(\w+)/, `<$1 data-z="${key}_${view}"`); }
  h += `</g><path class="deco" d="${view === 'f' ? DECO_F : DECO_B}"/><g class="marks"></g></svg>`; return h;
}
// SVG per il giocatore (solo fronte), zone raggruppate
const PGROUP = { testa: ['head'], collo: ['neck'], torace: ['tho'], addome: ['abd'], braccioL: ['uarmL', 'farmL', 'handL'], braccioR: ['uarmR', 'farmR', 'handR'], gambaL: ['thighL', 'shinL', 'footL'], gambaR: ['thighR', 'shinR', 'footR'] };
export function playerSVG() {
  let h = '<svg viewBox="0 0 100 196" class="body me"><g class="zones">';
  for (const pz in PGROUP) for (const key of PGROUP[pz]) { const k = key.replace(/[LR]$/, ''), sd = k !== key ? key.slice(-1) : ''; const s = shapeFor(k, sd, 'f'); h += s.el.replace(/^<(\w+)/, `<$1 data-pz="${pz}"`); }
  h += `</g><path class="deco" d="${DECO_F}"/><g class="fx"></g></svg>`; return h;
}

const BASE = [44, 52, 48], HOT = [255, 52, 34], MID = [150, 34, 26];
export function sevColor(v) {
  if (v <= 0) return `rgb(${BASE})`; const t = Math.min(1, v / 100);
  const a = t < .5 ? BASE.map((b, i) => b + (MID[i] - b) * t * 2) : MID.map((m, i) => m + (HOT[i] - m) * (t - .5) * 2);
  return `rgb(${a.map(Math.round)})`;
}

// aggiorna la mappa dell'avversario
export function updateEnemyMap(root, c) {
  root.querySelectorAll('[data-z]').forEach(el => {
    const z = el.dataset.z; const v = c.zoneDmg[z] || 0; el.style.fill = sevColor(v);
    const recent = G.t - (c.zoneHitT[z] || -99); el.classList.toggle('hurt', recent < 5 && !c.ph.dead); el.classList.toggle('ache', v > 30 && recent >= 5 && c.ph.pain > 3 && !c.ph.dead);
  });
  const sig = c.marks.length + '|' + c.id; if (root.dataset.sig === sig) return; root.dataset.sig = sig;
  for (const svg of root.querySelectorAll('svg.body')) {
    const view = svg.dataset.view; let h = '';
    for (const m of c.marks) {
      if (!m.z.endsWith('_' + view)) continue; const key = m.z.slice(0, -2); const bb = BB[m.z]; if (!bb) continue;
      const [bx, by, bw, bh] = bb; const cx = bx + bw / 2;
      let x = cx + (view === 'f' ? 1 : -1) * Math.max(-1, Math.min(1, m.u)) * bw * .4;
      let y;
      if (m.k === 'head') y = by + bh / 2 - Math.max(-1, Math.min(1, m.v)) * bh * .45;
      else if (m.k === 'tho' || m.k === 'abd' || m.k === 'neck') y = by + bh - Math.max(0, Math.min(1, m.v)) * bh;
      else y = by + Math.max(0, Math.min(1, m.v)) * bh;
      x = Math.max(bx + 1, Math.min(bx + bw - 1, x)); y = Math.max(by + 1, Math.min(by + bh - 1, y));
      if (m.type === 'bullet') h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" class="m-in"/>`;
      else if (m.type === 'exit') h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" class="m-out"/>`;
      else if (m.type === 'cut') h += `<line x1="${(x - 3).toFixed(1)}" y1="${(y - .8).toFixed(1)}" x2="${(x + 3).toFixed(1)}" y2="${(y + .8).toFixed(1)}" class="m-cut"/>`;
      else if (m.type === 'stab') h += `<line x1="${(x - 1.4).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + 1.4).toFixed(1)}" y2="${y.toFixed(1)}" class="m-stab"/>`;
      else if (m.type === 'spiral') h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="m-ras"/>`;
    }
    svg.querySelector('.marks').innerHTML = h;
  }
}
// aggiorna la mappa del giocatore
export function updatePlayerMap(root, PB) {
  root.querySelectorAll('[data-pz]').forEach(el => {
    const Z = PB.z[el.dataset.pz]; el.style.fill = sevColor(Z.dmg * .9 + Z.pain * 25);
    el.classList.toggle('hurt', G.t - Z.hitT < 3); el.classList.toggle('ache', Z.pain > .35 && G.t - Z.hitT >= 3);
    el.classList.toggle('fract', Z.fract); el.classList.toggle('bleed', Z.bleed > 3);
  });
}
