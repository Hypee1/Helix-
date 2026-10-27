// HELIX · audio: tutto sintetizzato con Web Audio (nessun file esterno)
import { S, G, clamp, rand, camera, _v3, _v4 } from './core.js';

export const AU = {};
export function auInit() {
  if (AU.ctx) return; const C = new (window.AudioContext || window.webkitAudioContext)(); AU.ctx = C;
  AU.comp = C.createDynamicsCompressor(); AU.comp.threshold.value = -14; AU.comp.connect(C.destination);
  // filtro "orecchie ovattate" dopo colpi alla testa / esplosioni
  AU.muffle = C.createBiquadFilter(); AU.muffle.type = 'lowpass'; AU.muffle.frequency.value = 20000; AU.muffle.connect(AU.comp);
  AU.master = C.createGain(); AU.master.gain.value = .9; AU.master.connect(AU.muffle);
  AU.voice = C.createGain(); AU.voice.gain.value = S.voice; AU.voice.connect(AU.master);
  const imp = (sec, dec) => { const n = C.sampleRate * sec | 0, b = C.createBuffer(2, n, C.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++)d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, dec); } return b; };
  AU.rO = C.createConvolver(); AU.rO.buffer = imp(1.1, 3.5); AU.rI = C.createConvolver(); AU.rI.buffer = imp(2.4, 2.2);
  AU.wO = C.createGain(); AU.wI = C.createGain(); AU.wO.gain.value = .22; AU.wI.gain.value = 0;
  AU.send = C.createGain(); AU.send.connect(AU.rO); AU.send.connect(AU.rI); AU.rO.connect(AU.wO); AU.rI.connect(AU.wI); AU.wO.connect(AU.master); AU.wI.connect(AU.master);
  const nb = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++)nd[i] = Math.random() * 2 - 1; AU.nb = nb;
  const src = C.createBufferSource(); src.buffer = nb; src.loop = true; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .8;
  AU.breath = C.createGain(); AU.breath.gain.value = 0; src.connect(bp); bp.connect(AU.breath); AU.breath.connect(AU.master); src.start();
  // ronzio del Rasengan (loop controllabile)
  const o1 = C.createOscillator(), o2 = C.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 110; o2.frequency.value = 113.5;
  const ns = C.createBufferSource(); ns.buffer = nb; ns.loop = true; const nf = C.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 1.2;
  const rf = C.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 900; AU.rasF = rf; AU.rasO = [o1, o2]; AU.rasNF = nf;
  AU.ras = C.createGain(); AU.ras.gain.value = 0; o1.connect(rf); o2.connect(rf); ns.connect(nf); nf.connect(AU.ras); rf.connect(AU.ras); AU.ras.connect(AU.master); o1.start(); o2.start(); ns.start();
}
export function out(pos, vol = 1, wet = .3) {
  const C = AU.ctx; const g = C.createGain(); let gain = vol, pan = 0;
  if (pos) { const d = pos.distanceTo(camera.position); gain = vol / (1 + d * .18); const r = _v4.set(1, 0, 0).applyQuaternion(camera.quaternion); const dir = _v3.copy(pos).sub(camera.position).normalize(); pan = clamp(dir.dot(r), -1, 1) * .8; }
  g.gain.value = gain; let node = g; if (C.createStereoPanner) { const p = C.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  node.connect(AU.master); if (wet > 0) { const s = C.createGain(); s.gain.value = wet * gain; g.connect(s); s.connect(AU.send); } return g;
}
export function nz(dest, t0, dur, type, freq, q, a = .002, peak = 1) { const C = AU.ctx; const s = C.createBufferSource(); s.buffer = AU.nb; const f = C.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = C.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05); return f; }
export function tone(dest, t0, dur, type, f0, f1, peak = 1, a = .003) { const C = AU.ctx; const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur); const g = C.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(.001, t0 + dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + .05); return o; }
const T = () => AU.ctx.currentTime;

export const SND = {
  gun(kind = 'pistol') {
    if (!AU.ctx) return; const t = T();
    if (kind === 'pistol') { const d = out(null, 1.1, .9); nz(d, t, .09, 'highpass', 1800, .5, .001, 1.4); nz(d, t, .35, 'lowpass', 700, .7, .001, 1.6); tone(d, t, .22, 'sine', 140, 40, 1.3, .001); tone(d, t + .25, .04, 'triangle', 3200, 2600, .04); }
    if (kind === 'shotgun') { const d = out(null, 1.5, 1.1); nz(d, t, .12, 'highpass', 1200, .5, .001, 1.6); nz(d, t, .6, 'lowpass', 450, .6, .001, 2.2); tone(d, t, .4, 'sine', 95, 30, 1.8, .001); }
    if (kind === 'rifle') { const d = out(null, 1.2, .8); nz(d, t, .06, 'highpass', 2600, .5, .001, 1.6); nz(d, t, .25, 'lowpass', 900, .7, .001, 1.3); tone(d, t, .14, 'sine', 180, 50, 1.1, .001); }
    if (kind === 'sniper') { const d = out(null, 1.7, 1.4); nz(d, t, .08, 'highpass', 3000, .4, .001, 2); nz(d, t, .9, 'lowpass', 380, .6, .001, 2.4); tone(d, t, .5, 'sine', 80, 26, 2, .001); nz(d, t + .25, 1.6, 'lowpass', 260, .5, .2, .5); }
  },
  pump() { if (!AU.ctx) return; const t = T(), d = out(null, .5, 0); nz(d, t + .15, .05, 'bandpass', 1400, 4); nz(d, t + .38, .07, 'bandpass', 900, 3); },
  bolt() { if (!AU.ctx) return; const t = T(), d = out(null, .5, 0); nz(d, t + .2, .04, 'bandpass', 2400, 5); nz(d, t + .45, .06, 'bandpass', 1600, 4); nz(d, t + .7, .05, 'bandpass', 2800, 6); },
  dry() { if (!AU.ctx) return; const t = T(), d = out(null, .5, 0); nz(d, t, .03, 'bandpass', 3000, 4, .001, .6); },
  reload() { if (!AU.ctx) return; const t = T(), d = out(null, .45, 0); nz(d, t + .2, .05, 'bandpass', 2200, 5); nz(d, t + 1.1, .06, 'bandpass', 1500, 4); nz(d, t + 1.55, .05, 'bandpass', 2600, 6); },
  shell() { if (!AU.ctx) return; const t = T(), d = out(null, .4, 0); nz(d, t + .1, .05, 'bandpass', 1800, 4); },
  impact(pos, kind, E = 100) {
    if (!AU.ctx) return; const t = T(), v = clamp(.3 + E / 300, .3, 1.4), d = out(pos, v, .2);
    if (kind === 'flesh') { tone(d, t, .12, 'sine', 120, 55, 1); nz(d, t, .07, 'lowpass', 900, 1, .001, .8); }
    else if (kind === 'bone') { tone(d, t, .1, 'sine', 110, 50, .9); nz(d, t, .04, 'highpass', 2500, 1, .001, 1); tone(d, t, .03, 'square', 900, 600, .25); }
    else if (kind === 'wet') { nz(d, t, .09, 'lowpass', 700, 2, .001, .9); nz(d, t + .02, .12, 'bandpass', 400, 3, .01, .5); }
    else if (kind === 'metal') { tone(d, t, .5, 'sine', 1300, 1250, .25); tone(d, t, .35, 'sine', 2750, 2700, .15); nz(d, t, .04, 'highpass', 3000, 1, .001, .5); }
    else if (kind === 'wood') { tone(d, t, .12, 'triangle', 300, 180, .5); nz(d, t, .06, 'bandpass', 900, 2); }
    else { nz(d, t, .06, 'bandpass', 2200, 1, .001, .7); nz(d, t, .12, 'lowpass', 500, 1, .001, .5); }
  },
  step(pos, surf, vol = .25) {
    if (!AU.ctx) return; const t = T(), d = out(pos, vol, .1);
    if (surf === 'gravel') { for (let i = 0; i < 5; i++)nz(d, t + i * .012, .05, 'highpass', 3500, .5, .001, .6); }
    else if (surf === 'grass') { nz(d, t, .12, 'highpass', 2200, .3, .02, .35); }
    else if (surf === 'metal') { tone(d, t, .18, 'sine', 420, 400, .2); nz(d, t, .03, 'bandpass', 1800, 2); }
    else if (surf === 'concrete') { nz(d, t, .05, 'bandpass', 900, 1.4, .002, .8); }
    else { nz(d, t, .06, 'bandpass', 1400, 1, .002, .7); nz(d, t, .04, 'lowpass', 300, 1, .002, .5); }
  },
  swish(heavy = 0) { if (!AU.ctx) return; const t = T(), d = out(null, .25 + heavy * .25, 0); const f = nz(d, t, .16 + heavy * .15, 'bandpass', 600 - heavy * 250, 1.5, .05, .7); f.frequency.exponentialRampToValueAtTime(2200 - heavy * 1200, t + .15 + heavy * .12); },
  blade() { if (!AU.ctx) return; const t = T(), d = out(null, .3, 0); const f = nz(d, t, .14, 'bandpass', 3500, 6, .02, .6); f.frequency.exponentialRampToValueAtTime(6500, t + .12); },
  hurtMe(E = 1) { if (!AU.ctx) return; const t = T(), d = out(null, .6 + E * .5, 0); tone(d, t, .15, 'sine', 90, 45, 1.2); nz(d, t, .08, 'lowpass', 600, 1); },
  bounce(pos) { if (!AU.ctx) return; const t = T(), d = out(pos, .6, .2); tone(d, t, .15, 'triangle', 900, 700, .3); nz(d, t, .03, 'highpass', 3000, 1, .001, .4); },
  explosion(pos) {
    if (!AU.ctx) return; const t = T(), d = out(pos, 3, 1.4);
    nz(d, t, 1.8, 'lowpass', 300, .5, .002, 2.6); nz(d, t, .25, 'highpass', 1500, .4, .001, 1.4); tone(d, t, .9, 'sine', 70, 22, 2.4, .002);
    const dist = pos ? pos.distanceTo(camera.position) : 0; if (dist < 12) muffle(2.5 * (1 - dist / 12) + .4, 300);
  },
  rasRelease() { if (!AU.ctx) return; const t = T(), d = out(null, 1, .4); const f = nz(d, t, .5, 'bandpass', 800, 1.2, .01, 1.2); f.frequency.exponentialRampToValueAtTime(3500, t + .4); },
  rasImpact(pos) {
    if (!AU.ctx) return; const t = T(), d = out(pos, 2.4, 1.2);
    for (let i = 0; i < 6; i++)nz(d, t + i * .08, .15, 'bandpass', 900 + i * 300, 2, .01, .8);
    nz(d, t + .5, 1.5, 'lowpass', 400, .5, .002, 2.4); tone(d, t + .5, 1.2, 'sine', 60, 25, 2.2, .003); nz(d, t + .5, .5, 'highpass', 2500, .5, .001, 1.2);
  },
  tinnitus(sec = 3) { if (!AU.ctx) return; const t = T(), C = AU.ctx; const o = C.createOscillator(); o.frequency.value = rand(5200, 6800); const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .05); g.gain.exponentialRampToValueAtTime(.0005, t + sec); o.connect(g); g.connect(AU.comp); o.start(t); o.stop(t + sec + .1); },
  heartbeat(rate = 1) { if (!AU.ctx) return; const t = T(), d = out(null, .5 * rate, 0); tone(d, t, .12, 'sine', 60, 40, 1); tone(d, t + .22, .14, 'sine', 55, 38, .8); },
  bulletWhoosh() { if (!AU.ctx) return; const t = T(), d = out(null, .7, .6); const f = nz(d, t, 1.4, 'bandpass', 400, 3, .3, 1); f.frequency.exponentialRampToValueAtTime(2400, t + 1.3); },
  xrayHit() { if (!AU.ctx) return; const t = T(), d = out(null, 1.2, .8); tone(d, t, .5, 'sine', 70, 30, 1.6); nz(d, t, .3, 'lowpass', 600, 1, .001, 1.2); nz(d, t + .05, .1, 'highpass', 2500, 1, .001, .8); },
  bandage() { if (!AU.ctx) return; const t = T(), d = out(null, .35, 0); for (let i = 0; i < 5; i++)nz(d, t + i * .4, .25, 'highpass', 2500, .4, .05, .5); },
};
// ovatta l'audio (cutoff Hz) per 'sec' secondi
export function muffle(sec, cutoff = 600) { if (!AU.ctx) return; const t = T(), f = AU.muffle.frequency; f.cancelScheduledValues(t); f.setValueAtTime(cutoff, t); f.setTargetAtTime(20000, t + sec * .6, sec * .4); }

// Voce sintetica: sorgente glottale + formanti (niente parole)
export function voice(ch, kind, int = 1) {
  if (!AU.ctx || ch.ph.dead) return; if (G.t - ch.lastVoice < .18 && kind !== 'scream') return; ch.lastVoice = G.t; const C = AU.ctx, t = C.currentTime;
  const strength = clamp(ch.str, .15, 1); const d = out(ch.J.head, .85 * strength * int, .3); d.disconnect(); const vg = C.createGain(); d.connect(vg); vg.connect(AU.voice);
  const P = { effort: [.16, 1.0, .95, 580, 1100], hurt: [.42, 1.25, 1.0, 700, 1250], scream: [.85, 1.55, 1.1, 800, 1350], groan: [1.1, .82, .9, 520, 950], cough: [.2, 1, 1, 500, 1500], gasp: [.3, 1.1, 1, 650, 1200], kiai: [.22, 1.1, .85, 650, 1150] }[kind];
  const [dur, pitch, end, F1, F2] = P; const f0 = ch.f0 * pitch * (1 + (ch.ph.adr * .15)) * rand(.94, 1.06);
  if (kind === 'cough') { for (let i = 0; i < 3; i++)nz(vg, t + i * .22, .13, 'bandpass', 900, 1.2, .005, .9 * strength); return; }
  const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * .9, t); o.frequency.linearRampToValueAtTime(f0, t + dur * .25); o.frequency.exponentialRampToValueAtTime(f0 * end * .82, t + dur);
  if (kind === 'scream') { const l = C.createOscillator(), lg = C.createGain(); l.frequency.value = 6.5; lg.gain.value = f0 * .03; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  const g = C.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .03); g.gain.setValueAtTime(.45, t + dur * .6); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  const sh = ch.sex === 'F' ? 1.18 : 1;
  const b1 = C.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = F1 * sh; b1.Q.value = 6; const b2 = C.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = F2 * sh; b2.Q.value = 8; const b3 = C.createBiquadFilter(); b3.type = 'bandpass'; b3.frequency.value = 2600 * sh; b3.Q.value = 10;
  const g2 = C.createGain(); g2.gain.value = .5; const g3 = C.createGain(); g3.gain.value = .25; o.connect(g); g.connect(b1); g.connect(b2); g.connect(b3); b1.connect(vg); b2.connect(g2); g2.connect(vg); b3.connect(g3); g3.connect(vg);
  nz(vg, t, dur * .9, 'bandpass', 1600 * sh, .8, .02, .12); o.start(t); o.stop(t + dur + .05);
}
export function setReverb(inside) { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.wO.gain.setTargetAtTime(inside ? 0 : .22, t, .3); AU.wI.gain.setTargetAtTime(inside ? .55 : 0, t, .3); }
export function rasHum(level, pitch = 1) { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.ras.gain.setTargetAtTime(level * .35, t, .05); AU.rasO[0].frequency.setTargetAtTime(110 * pitch, t, .1); AU.rasO[1].frequency.setTargetAtTime(113.5 * pitch, t, .1); AU.rasF.frequency.setTargetAtTime(500 + 1600 * level, t, .1); AU.rasNF.frequency.setTargetAtTime(1200 + 2400 * level, t, .1); }
