// HELIX · core: renderer, scena, stato condiviso, utilità, caricamento asset (GLSL + JSON)
'use strict';
export const THREE = window.THREE;
THREE.ColorManagement.legacyMode = false;

export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const V3 = THREE.Vector3;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const UP = new V3(0, 1, 0);
export const _v1 = new V3(), _v2 = new V3(), _v3 = new V3(), _v4 = new V3();
export const _c = new THREE.Color();

// impostazioni (menu) e stato di gioco
export const S = { n: 2, behavior: 'reagisce', tod: 'giorno', gfx: 'media', sens: 1, fov: 78, voice: .8, sandbox: false, enemyArms: 'misto', killcam: true, skill: 'medio' };
export const G = { running: false, started: false, timeScale: 1, userSlow: 1, t: 0, locked: false, noLock: false, tab: 'org', target: null, killcam: false };
export const GFX = { bassa: .35, media: .7, alta: 1 };

// registri condivisi tra i moduli
export const chars = [];          // personaggi (avversari)
export const hitMeshes = [];      // mesh colpibili dei personaggi
export const obstacles = [];      // AABB per collisioni
export const obstacleMeshes = []; // mesh ambiente colpibili
export const keys = {};
export const mouse = { l: false, r: false, hist: [] };

// stato del giocatore (la logica sta in player.js / playerbody.js)
export const player = {
  pos: new V3(0, 0, -14), vel: new V3(), yaw: Math.PI, pitch: 0, onGround: true, crouch: 0, lean: 0,
  stamina: 100, health: 100, weapon: 'fists', ads: 0, recP: 0, recY: 0, bob: 0, stepAcc: 0,
  atk: null, queued: null, combo: [], lastHit: -99, reloading: 0, fireCd: 0, dead: false, shake: 0,
  nextHand: 'L', sway: 0, ammo: {}, throwKind: 'tknife', throwN: {}, charge: 0, chargeBtn: -1, chakraCd: 0,
  breathHold: 0, bandages: 3, bandaging: 0, guard: 0, bolt: 0
};

/* ================= RENDERER ================= */
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, .03, 500);
camera.rotation.order = 'YXZ'; scene.add(camera);

export function mountRenderer(el) {
  el.appendChild(renderer.domElement);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });
}

/* ================= ASSET: shader GLSL e dati JSON ================= */
// In produzione (GitHub Pages) vengono letti con fetch; la build "standalone" li inietta in window.__HELIX_INLINE.
export const SHADERS = {};
export const DATA = {};
const SHADER_FILES = ['sky.vert', 'sky.frag', 'decal.vert', 'decal.frag', 'mist.vert', 'mist.frag', 'rasengan.vert', 'rasengan.frag', 'xray.frag', 'shock.frag'];
const DATA_FILES = ['weapons'];
export async function loadAssets(onProgress) {
  const inline = window.__HELIX_INLINE || {};
  const total = SHADER_FILES.length + DATA_FILES.length; let done = 0;
  const step = () => onProgress && onProgress(++done / total);
  await Promise.all([
    ...SHADER_FILES.map(async f => {
      const key = 'shaders/' + f + '.glsl';
      SHADERS[f] = inline[key] ?? await (await fetch(key)).text(); step();
    }),
    ...DATA_FILES.map(async f => {
      const key = 'data/' + f + '.json';
      DATA[f] = inline[key] ? JSON.parse(inline[key]) : await (await fetch(key)).json(); step();
    })
  ]);
}

// texture da canvas
export function canvasTex(size, fn, rep = true, h) {
  const c = document.createElement('canvas'); c.width = size; c.height = h || size;
  const g = c.getContext('2d'); fn(g, size, h || size);
  const t = new THREE.CanvasTexture(c);
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}
export function noise(g, s, base, amt, blots = 0, blotCol = '#000', blotA = .08, h) {
  h = h || s; g.fillStyle = base; g.fillRect(0, 0, s, h);
  for (let i = 0; i < blots; i++) { g.globalAlpha = Math.random() * blotA; g.fillStyle = blotCol; g.beginPath(); g.arc(Math.random() * s, Math.random() * h, rand(s * .02, s * .15), 0, 7); g.fill(); }
  g.globalAlpha = 1; const im = g.getImageData(0, 0, s, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
}

// semplice bus eventi tra moduli (evita import circolari)
const BUS = {};
export const on = (ev, fn) => (BUS[ev] = BUS[ev] || []).push(fn);
export const emitEv = (ev, ...a) => (BUS[ev] || []).forEach(f => f(...a));
