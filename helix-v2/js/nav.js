// HELIX · griglia di navigazione + A* per gli avversari
import { V3, clamp, lerp, obstacles } from './core.js';

const NG = { n: 120, off: 60, blk: null };
export function buildNav() {
  NG.blk = new Uint8Array(NG.n * NG.n);
  for (let i = 0; i < NG.n; i++)for (let j = 0; j < NG.n; j++) {
    const x = i - NG.off + .5, z = j - NG.off + .5; let b = (Math.abs(x) > 58.5 || Math.abs(z) > 58.5);
    if (!b) for (const o of obstacles) { if (o.max.y < .4) continue; if (x > o.min.x - .45 && x < o.max.x + .45 && z > o.min.z - .45 && z < o.max.z + .45) { b = true; break; } }
    NG.blk[i * NG.n + j] = b ? 1 : 0;
  }
}
const cellOf = (x, z) => [clamp(Math.floor(x + NG.off), 0, NG.n - 1), clamp(Math.floor(z + NG.off), 0, NG.n - 1)];
const blocked = (i, j) => i < 0 || j < 0 || i >= NG.n || j >= NG.n || NG.blk[i * NG.n + j] === 1;
export function los(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / .4); for (let k = 1; k < n; k++) { const x = lerp(a.x, b.x, k / n), z = lerp(a.z, b.z, k / n); const [i, j] = cellOf(x, z); if (blocked(i, j)) return false; } return true; }
function nearestFree(i, j) { if (!blocked(i, j)) return [i, j]; for (let r = 1; r < 6; r++)for (let di = -r; di <= r; di++)for (let dj = -r; dj <= r; dj++)if (!blocked(i + di, j + dj)) return [i + di, j + dj]; return [i, j]; }
export function astar(from, to) {
  let [si, sj] = nearestFree(...cellOf(from.x, from.z)); let [gi, gj] = nearestFree(...cellOf(to.x, to.z));
  const N = NG.n, start = si * N + sj, goal = gi * N + gj;
  const gS = new Float32Array(N * N).fill(1e9), came = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N); const heap = [];
  const push = (f, id) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = (i, j) => { const dx = Math.abs(i - gi), dy = Math.abs(j - gj); return dx + dy - .586 * Math.min(dx, dy); };
  gS[start] = 0; push(h(si, sj), start); let it = 0;
  while (heap.length && it++ < 9000) {
    const [, cur] = pop(); if (cur === goal) break; if (closed[cur]) continue; closed[cur] = 1; const ci = (cur / N) | 0, cj = cur % N;
    for (let di = -1; di <= 1; di++)for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (blocked(ni, nj)) continue; if (di && dj && (blocked(ci + di, cj) || blocked(ci, cj + dj))) continue;
      const nid = ni * N + nj, ng = gS[cur] + (di && dj ? 1.414 : 1); if (ng < gS[nid]) { gS[nid] = ng; came[nid] = cur; push(ng + h(ni, nj), nid); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null; const path = []; let c = goal;
  while (c !== start && c >= 0) { path.push(new V3(((c / N) | 0) - NG.off + .5, 0, (c % N) - NG.off + .5)); c = came[c]; }
  path.reverse();
  const out = []; let a = from.clone(); for (let k = 0; k < path.length; k++) { if (k === path.length - 1 || !los(a, path[k + 1])) { out.push(path[k]); a = path[k]; } } return out;
}
