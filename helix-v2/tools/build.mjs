// HELIX · build "standalone": un unico file HTML giocabile anche aprendolo con doppio clic (file://).
// Uso: npm install && npm run build   →   dist/helix-standalone.html
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFile(join(root, p), 'utf8');

// 1) bundle dei moduli ES in un solo script
const out = await build({ entryPoints: [join(root, 'js/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = out.outputFiles[0].text;

// 2) shader GLSL e dati JSON iniettati come stringhe (letti da core.js tramite window.__HELIX_INLINE)
const inline = {};
for (const f of await readdir(join(root, 'shaders'))) if (f.endsWith('.glsl')) inline['shaders/' + f] = await rd('shaders/' + f);
for (const f of await readdir(join(root, 'data'))) if (f.endsWith('.json')) inline['data/' + f] = await rd('data/' + f);

// 3) HTML con CSS e three.js inclusi
let html = await rd('index.html');
const css = await rd('css/style.css');
const three = await rd('vendor/three.min.js');
const esc = s => s.replace(/<\/script/gi, '<\\/script');
html = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script src="vendor/three.min.js"></script>', `<script>${esc(three)}</script>`);
html = html.replace('<script type="module" src="js/main.js"></script>', `<script>window.__HELIX_INLINE=${esc(JSON.stringify(inline))};</script>\n<script>${esc(js)}</script>`);
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/helix-standalone.html'), html);
console.log(`dist/helix-standalone.html · ${(html.length / 1024).toFixed(0)} KB`);
