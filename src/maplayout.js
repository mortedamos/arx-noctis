// WHERE EVERY ROOM SITS ON THE CASTLE MAP (the map screen is MapScreen in ui.js; levelgen.js feeds this its blueprint).
// The map is a PACKED one, like the maps of the old castle games: a room is a block of whole cells (see mapCells: one cell per screen of the room), rooms touch, and there is no empty space and no line between areas.
//   * Each chain of rooms (levelgen CHAINS) is a STRIP: its rooms side by side, touching, all flush with the edge that faces the strip it hangs from (bottoms level above it, tops level below it).
//   * A strip is set against the room its first room is entered from (its ANCHOR), above it, below it, or continuing on from the end of its strip, and it settles as close to that room as the rooms already
//     placed allow, like a piece falling into a puzzle, so the zone it makes touches the zone it comes from.  It is tried on the sides the blueprint prefers, then the others.
//   * A side room (a sanctuary, a house, a vault, a lair) is set against its parent room, below it if there is room, side by side with its brothers.
// Rooms never overlap.  If nothing touching can be found (it should not happen) the room is put beside everything else, so that no room is ever left off the map.
import { clamp } from './util.js';

export const mapCells = r => ({ cw: clamp(Math.round(r.w / 24), 1, 7), ch: clamp(Math.round(r.h / 14), 1, 4) });          // (a room is one cell across per 24 tiles and one up per 14: at least 1, at most 7 and 4)

// ids: the rooms to put on the map, in a fixed order; size[id] = { cw, ch }; zone[id]; chains: [[ids]] (the first is the main row); anchor[i] = the room chain i is entered from;
// parent[id] = the room a side room hangs from; sides[i] = where chain i prefers to sit ('above' | 'below' | 'right', best first).  -> { id: { x, y } } in cells, the whole map starting at 0, 0
export function packMap({ ids, size, zone, chains, anchor, parent, sides, first = [], above = [], log }) {          // (above: side rooms that lie ABOVE their parent when they can, because the way into them climbs: the Orloj Tower and the Boiler Loft atop it)
  const pos = {}, occ = new Map(), key = (x, y) => x + ',' + y, has = id => !!size[id];
  // a PIECE is a strip: a chain, or - when a chain runs through more than one zone (the Cistern, then the Frozen Caverns) - each zone's run of it, hung from the end of the run before
  const pieces = [], pieceOf = {};
  chains.forEach((c, ci) => {
    const rs = ci === 0 ? [c.filter(has)] : c.filter(has).reduce((o, id) => { if (o.length && zone[o[o.length - 1][0]] === zone[id]) o[o.length - 1].push(id); else o.push([id]); return o; }, []);
    rs.forEach((ids, k) => { const p = { ids, ci, anchor: k ? rs[k - 1][rs[k - 1].length - 1] : anchor[ci], sides: k ? ['right', 'below', 'above'] : sides[ci] || [], first: first.includes(ci) }; pieces.push(p); ids.forEach(id => { pieceOf[id] = p; }); });
  });
  const free = (x, y, cw, ch) => { for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (occ.has(key(x + i, y + j))) return false; return true; };
  const put = (id, x, y) => { const { cw, ch } = size[id]; pos[id] = { x, y }; for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) occ.set(key(x + i, y + j), id); };
  const touched = (x, y, cw, ch) => {          // the rooms that a block at (x, y) would touch along its four edges
    const s = new Set(), look = (a, b) => { const o = occ.get(key(a, b)); if (o) s.add(o); };
    for (let i = 0; i < cw; i++) { look(x + i, y - 1); look(x + i, y + ch); } for (let j = 0; j < ch; j++) { look(x - 1, y + j); look(x + cw, y + j); }
    return s;
  };
  const right = id => pos[id].x + size[id].cw;

  // ---- a strip: the rooms of a chain, placed together
  function layStrip(c, x0, dir, edge, flush) {          // -> [[id, x, y]] for a strip whose first room is at x0 (running right, or left when dir is -1); flush 'bottom': bottoms on row `edge`; 'top': tops on it
    const out = [], first = size[c[0]].cw; let at = 0;
    for (const id of c) { const { cw, ch } = size[id], x = dir > 0 ? x0 + at : x0 + first - at - cw; out.push([id, x, flush === 'bottom' ? edge - ch : edge]); at += cw; }
    return out;
  }
  const fitsAll = lay => lay.every(([id, x, y]) => free(x, y, size[id].cw, size[id].ch));
  function placeStrip(P) {
    const c = P.ids, ci = P.ci; if (!c.length) return;
    if (!P.anchor) { for (const [id, x, y] of layStrip(c, 0, 1, 0, 'bottom')) put(id, x, y); return; }
    const A = P.anchor, az = zone[A], pref = P.sides.length ? P.sides : ['below', 'above', 'right'], order = [...pref, ...['below', 'above', 'right'].filter(s => !pref.includes(s))];
    const cands = [];
    order.forEach((side, si) => {
      for (const dir of [1, -1]) {
        const a0 = pos[A], aw = size[A].cw, ah = size[A].ch, fw = size[c[0]].cw;
        // the first room's left edge: it must share a stretch of the anchor's top or bottom edge (above / below), or sit just past the end of the anchor's own strip (right)
        const xs = [];
        if (side === 'right') { const last = (pieceOf[A] ? pieceOf[A].ids : [A]).map(id => right(id)); xs.push(Math.max(...last)); }
        else for (let k = 0; k < aw + fw; k++) xs.push(a0.x + (k % 2 ? -((k + 1) >> 1) : k >> 1));          // (straight under the anchor first, then to either side of that)
        for (const x0 of [...new Set(xs)]) {
          if (side !== 'right' && (x0 + fw <= a0.x || x0 >= a0.x + aw)) continue;
          for (let push = 0; push < 9; push++) {
            const edge = side === 'above' ? a0.y - push : side === 'below' ? a0.y + ah + push : a0.y + ah + (push % 2 ? -((push + 1) >> 1) : push >> 1);
            const lay = layStrip(c, x0, dir, edge, side === 'below' ? 'top' : 'bottom'); if (!fitsAll(lay)) continue;
            const near = new Set(); for (const [id, x, y] of lay) for (const t of touched(x, y, size[id].cw, size[id].ch)) near.add(t);
            const toAnchor = near.has(A), toZone = [...near].some(t => zone[t] === az); if (!near.size) continue;          // (touching its own zone is best; touching any room at all is still no gap)
            cands.push({ lay, score: si * 3 + (dir < 0 ? 0.6 : 0) + push * 1.5 + Math.abs(x0 - a0.x) * 0.05 + (toAnchor ? 0 : toZone ? 1.2 : 7) }); break;
          }
        }
      }
    });
    if (cands.length) { cands.sort((p, q) => p.score - q.score); if (log) log(`strip ${ci} (${c[0]}...) against ${A}: ${cands.length} ways, best score ${cands[0].score.toFixed(2)} at ${cands[0].lay[0][1]},${cands[0].lay[0][2]}`); for (const [id, x, y] of cands[0].lay) put(id, x, y); return; }
    if (log) log(`strip ${ci} (${c[0]}...) against ${A}: NO WAY TOUCHING ${az}`);
    const x0 = Math.max(0, ...Object.keys(pos).map(right)) + 1; for (const [id, x, y] of layStrip(c, x0, 1, 0, 'bottom')) put(id, x, y);          // (nowhere to touch: beside everything)
  }

  // ---- a side room: against its parent, below it if it can (side by side with its brothers), else above, else beside
  function placeChild(id) {
    const P = parent[id], p0 = pos[P], pw = size[P].cw, ph = size[P].ch, { cw, ch } = size[id], cands = [];
    const tryAt = (x, y, cost) => { if (free(x, y, cw, ch)) cands.push({ x, y, score: cost }); };
    const up = above.includes(id), dn = up ? 2 : 0, ab = up ? 0 : 2;          // (a room that climbs prefers the place above its parent, the others the place below)
    for (let d = 0; d < 5; d++) {
      for (let x = p0.x - cw + 1; x < p0.x + pw; x++) { tryAt(x, p0.y + ph + d, dn + d * 3 + Math.abs(x - p0.x) * 0.2); tryAt(x, p0.y - ch - d, ab + d * 3 + Math.abs(x - p0.x) * 0.2); }
      for (let y = p0.y - ch + 1; y < p0.y + ph; y++) { tryAt(p0.x + pw + d, y, 4 + d * 3 + Math.abs(y - p0.y) * 0.2); tryAt(p0.x - cw - d, y, 5 + d * 3 + Math.abs(y - p0.y) * 0.2); }
      if (d >= 1) for (let x = p0.x - cw - 1; x < p0.x + pw + 2; x++) tryAt(x, p0.y + ph + d, dn + d * 3 + 1 + Math.abs(x - p0.x) * 0.2);          // (under a brother, a little to either side)
    }
    if (cands.length) { cands.sort((p, q) => p.score - q.score); put(id, cands[0].x, cands[0].y); return; }
    put(id, Math.max(0, ...Object.keys(pos).map(right)) + 1, 0);
  }

  // ---- the whole castle: the main strip and its side rooms, then every other strip (and its side rooms) as soon as the room it hangs from is on the map
  const flat = ids.filter(has), done = new Set();
  const kidsOf = () => { let again = true; while (again) { again = false; for (const id of flat) if (!pos[id] && !pieceOf[id] && parent[id] && pos[parent[id]]) { placeChild(id); again = true; } } };
  const rank = P => (P.first ? -1 : P.sides[0] === 'right' ? 0 : 1), todo = pieces.filter(P => P.anchor !== undefined || P.ci === 0).sort((p, q) => rank(p) - rank(q) || p.ci - q.ci);          // (first: the strips the blueprint names, then those that run on from a strip's end, which need it; the others fit in around them)
  for (const P of todo.filter(P => P.ci === 0)) { placeStrip(P); done.add(P); }
  for (let again = true; again;) { again = false; for (const P of todo) if (P.first && !done.has(P) && P.anchor && pos[P.anchor]) { placeStrip(P); done.add(P); again = true; } }          // (the strips the blueprint names are set against the main row before its side rooms take the places beside it: the Cistern gets the room under the bridge)
  kidsOf();
  for (let again = true; again;) {
    again = false;
    for (const P of todo) if (!done.has(P) && (P.ids.length === 0 || (P.anchor && pos[P.anchor]))) { placeStrip(P); done.add(P); kidsOf(); again = true; }
  }
  for (const id of flat) if (!pos[id]) put(id, Math.max(0, ...Object.keys(pos).map(right)) + 1, 0);          // (a room the blueprint does not reach: it should not happen)
  let mx = 1e9, my = 1e9; for (const id of flat) { mx = Math.min(mx, pos[id].x); my = Math.min(my, pos[id].y); }
  const out = {}; for (const id of ids) out[id] = has(id) ? { x: pos[id].x - mx, y: pos[id].y - my } : null;
  return out;
}
