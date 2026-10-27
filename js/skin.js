// HELIX · superficie dei personaggi: ogni segmento del corpo ha una texture-canvas su cui vengono
// dipinti fori d'entrata/uscita, tagli, lividi che maturano, sangue che impregna i vestiti e cola verso il basso.
import { THREE, rand, clamp } from './core.js';

const SIZE = { tho: [256, 256], abd: [256, 192], head: [256, 128], neck: [128, 64], uarm: [128, 128], farm: [128, 128], thigh: [128, 160], shin: [128, 160], hand: [64, 64], foot: [64, 64] };
// verso della colata nella texture (+1 = verso il basso del canvas) per un corpo in piedi
const DRIP = { abd: 1, tho: 1, neck: 1, head: 1, uarm: -1, farm: -1, hand: -1, thigh: -1, shin: -1, foot: -1 };

export function makeSurface(sg, baseHex, cloth) {
  const [W, H] = SIZE[sg.k] || [128, 128];
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = baseHex; g.fillRect(0, 0, W, H);
  // grana: trama del tessuto o pori della pelle
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let y = 0; y < H; y++)for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; let n = (Math.random() - .5) * (cloth ? 14 : 7);
    if (cloth) n += ((x + y) % 4 < 2 ? 4 : -4) * .6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(im, 0, 0);
  if (cloth && sg.k === 'tho') { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, W, 6); } // cuciture del colletto
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  sg.surf = { c, g, tex, W, H, cloth, drip: DRIP[sg.k] || 1, soak: [] };
  return tex;
}

const XY = (s, uv) => [uv.x * s.W, (1 - uv.y) * s.H];
// disegna con ripetizione orizzontale (la texture si avvolge attorno al cilindro)
function wrap(s, x, r, fn) { fn(x); if (x - r < 0) fn(x + s.W); if (x + r > s.W) fn(x - s.W); }
function irregular(g, x, y, r, rough = .35, n = 14) {
  g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 + (Math.random() - .5) * rough * 2); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * .85); } g.closePath();
}
const px = s => s.W / 128; // scala in pixel per texture più grandi

export function paintWound(sg, uv, type, o = {}) {
  const s = sg.surf; if (!s || !uv) return; const g = s.g; const [x, y] = XY(s, uv); const k = px(s);
  g.save();
  if (type === 'entry') {        // foro d'entrata: piccolo, anello di abrasione, alone di sangue
    wrap(s, x, 10 * k, X => {
      g.fillStyle = s.cloth ? 'rgba(90,6,6,.55)' : 'rgba(120,20,15,.5)'; irregular(g, X, y, (s.cloth ? 5 : 3.5) * k * (o.cal || 1)); g.fill();
      g.fillStyle = '#4a0f0a'; g.beginPath(); g.arc(X, y, 2.2 * k * (o.cal || 1), 0, 7); g.fill();
      g.fillStyle = '#080202'; g.beginPath(); g.arc(X, y, 1.3 * k * (o.cal || 1), 0, 7); g.fill();
    });
  } else if (type === 'exit') {  // foro d'uscita: lacero, stellato, più grande
    const R = (5 + (o.E || 300) / 160) * k;
    wrap(s, x, R * 3, X => {
      g.fillStyle = 'rgba(100,4,4,.6)'; irregular(g, X, y, R * 1.7, .5); g.fill();
      g.fillStyle = '#5a0807'; irregular(g, X, y, R, .6, 9); g.fill();
      g.fillStyle = '#1a0202'; irregular(g, X, y, R * .5, .7, 7); g.fill();
      g.fillStyle = 'rgba(80,4,4,.8)'; for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, d = R * rand(1.6, 3); g.beginPath(); g.arc(X + Math.cos(a) * d, y + Math.sin(a) * d, rand(.6, 1.8) * k, 0, 7); g.fill(); }
    });
  } else if (type === 'cut' || type === 'lacer') { // taglio: linea con bordi rossi
    const L = (type === 'lacer' ? 7 : 14) * k * (o.len || 1), ang = o.ang ?? rand(-.4, .4);
    wrap(s, x, L, X => {
      g.translate(X, y); g.rotate(ang);
      g.strokeStyle = 'rgba(140,20,15,.55)'; g.lineWidth = 4 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, rand(-1, 1) * k, L / 2, 0); g.stroke();
      g.strokeStyle = '#2a0303'; g.lineWidth = 1.4 * k; g.beginPath(); g.moveTo(-L / 2 + 1, 0); g.quadraticCurveTo(0, rand(-1, 1) * k, L / 2 - 1, 0); g.stroke();
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  } else if (type === 'stab') {
    wrap(s, x, 8 * k, X => {
      g.translate(X, y); g.rotate(o.ang ?? rand(-.3, .3));
      g.fillStyle = 'rgba(110,8,6,.6)'; irregular(g, 0, 0, 5 * k, .4); g.fill();
      g.fillStyle = '#1a0202'; g.fillRect(-4 * k, -.9 * k, 8 * k, 1.8 * k);
      g.setTransform(1, 0, 0, 1, 0, 0);
    });
  } else if (type === 'bruise') { // livido: rossore subito, poi violaceo (vedi ripasso ritardato)
    if (s.cloth) { g.restore(); return; }
    const R = (6 + Math.min(14, (o.E || 100) / 25)) * k, stage = o.stage || 0;
    const col = stage === 0 ? [200, 60, 50] : stage === 1 ? [95, 35, 70] : [70, 40, 60];
    const a = clamp((o.E || 100) / 500, .08, .38) * (stage === 0 ? .8 : 1);
    wrap(s, x, R, X => { const gr = g.createRadialGradient(X, y, 0, X, y, R); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(X - R, y - R, R * 2, R * 2); });
  } else if (type === 'spiral') { // Rasengan: tessuto strappato a spirale, pelle abrasa
    const R = 26 * k;
    wrap(s, x, R, X => {
      g.fillStyle = s.cloth ? 'rgba(60,10,10,.75)' : 'rgba(120,25,25,.7)'; irregular(g, X, y, R * .75, .35); g.fill();
      g.strokeStyle = 'rgba(25,0,0,.85)'; g.lineWidth = 2 * k;
      for (let j = 0; j < 4; j++) { g.beginPath(); for (let t = 0; t < 1; t += .02) { const a = t * 8 + j * 1.57, rr = t * R; g.lineTo(X + Math.cos(a) * rr, y + Math.sin(a) * rr * .85); } g.stroke(); }
    });
  } else if (type === 'burn') {
    const R = 12 * k; wrap(s, x, R, X => { const gr = g.createRadialGradient(X, y, 0, X, y, R); gr.addColorStop(0, 'rgba(20,10,5,.8)'); gr.addColorStop(1, 'rgba(60,30,10,0)'); g.fillStyle = gr; g.fillRect(X - R, y - R, R * 2, R * 2); });
  }
  g.restore(); s.tex.needsUpdate = true;
}

// il sangue impregna (vestiti: si allarga molto; pelle: macchia piccola) e cola verso il basso
export function bleedTick(w, mlPerSec, dt) {
  const s = w.seg.surf; if (!s || !w.uv) return; const g = s.g; const k = px(s);
  w.vol = (w.vol || 0) + mlPerSec * dt; if (!w.xy) w.xy = XY(s, w.uv);
  const [x, y] = w.xy;
  // macchia che si allarga
  const R = Math.min(s.cloth ? 45 : 14, (s.cloth ? 4 : 2) + Math.sqrt(w.vol) * (s.cloth ? 2.6 : .9)) * k;
  if (R > (w.lastR || 0) + .8 * k) {
    w.lastR = R;
    wrap(s, x, R, X => { g.fillStyle = s.cloth ? 'rgba(70,4,4,.10)' : 'rgba(110,6,6,.10)'; irregular(g, X, y + R * .25 * s.drip, R, .3, 18); g.fill(); });
  }
  // colata (solo se sanguina abbastanza)
  if (mlPerSec > .15) {
    w.drips = w.drips || [{ dx: rand(-2, 2) * k, len: 0, wd: rand(1.2, 2.2) * k }];
    if (w.drips.length < 3 && Math.random() < dt * .25) w.drips.push({ dx: rand(-5, 5) * k, len: 0, wd: rand(1, 1.8) * k });
    g.strokeStyle = 'rgba(85,4,4,.85)'; g.lineCap = 'round';
    for (const d of w.drips) {
      const add = Math.min(6, mlPerSec * dt * 18) * k; if (d.len > s.H * .7) continue;
      const x0 = x + d.dx + Math.sin(d.len * .2) * .7, y0 = y + d.len * s.drip, y1 = y + (d.len + add) * s.drip;
      g.lineWidth = d.wd; wrap(s, x0, 3, X => { g.beginPath(); g.moveTo(X, y0); g.lineTo(X + rand(-.4, .4), y1); g.stroke(); });
      d.len += add;
    }
  }
  s.tex.needsUpdate = true;
}
