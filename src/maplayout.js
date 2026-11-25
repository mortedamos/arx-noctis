// WHERE EVERY ROOM SITS ON THE CASTLE MAP (the map screen is MapScreen in ui.js; levelgen.js feeds this its blueprint).
// The map is the GEOGRAPHY of the world: a room is a block of whole cells (see mapCells: one cell per screen of the room), up on the map is up in the world, and every way from a room to the next is drawn
// level - the doorway of one meets the doorway of the other.  It may sprawl and leave empty ground (the player scrolls about it), but rooms never overlap.
//   * Each chain of rooms (levelgen CHAINS) is a STRIP: its rooms side by side, touching, each set so that its way in is level with the way out of the room before it (`steps`).
//   * A strip is set against the room it is entered from (its ANCHOR) in the direction the blueprint says (`sides`): 'beside' (to the right, level with the door), 'below' or 'above'.  If that place is
//     taken it slides along or further out until it fits.  The strips are placed in the blueprint's `order`, so the ones that must be close to their anchor come first.
//   * A side room (a sanctuary, a house, a vault, a lair) is set against its parent room, below it if there is room (above it if it climbs: `above`), side by side with its brothers.
import { clamp } from './util.js';

export const mapCells = r => ({ cw: clamp(Math.round(r.w / 24), 1, 7), ch: clamp(Math.round(r.h / 14), 1, 7) });          // (a room is one cell across per 24 tiles and one up per 14: at least 1, at most 7 and 7 - the long ways down)

// ids: the rooms to put on the map, in a fixed order; size[id] = { cw, ch }; zone[id]; chains: [[ids]] (the first is the main row); anchor[i] = the room chain i is entered from;
// parent[id] = the room a side room hangs from; sides[i] = 'beside' | 'below' | 'above' for chain i; order = the chain indices in the order to place them; steps[id] = how many cells id's top lies below
// the top of the room before it (above, if negative) - for the first room of a strip, below the top of its anchor.  -> { id: { x, y } } in cells, the whole map starting at 0, 0
export function packMap({ ids, size, zone, chains, anchor, parent, sides, order, above = [], early = [], steps = {}, log }) {
  const pos = {}, occ = new Map(), key = (x, y) => x + ',' + y, has = id => !!size[id];
  const free = (x, y, cw, ch) => { for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (occ.has(key(x + i, y + j))) return false; return true; };
  const put = (id, x, y) => { const { cw, ch } = size[id]; pos[id] = { x, y }; for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) occ.set(key(x + i, y + j), id); };
  const right = id => pos[id].x + size[id].cw;

  // ---- a strip: rooms side by side, each level with the one before it by its doorway (flush at the foot where no step is given)
  const layStrip = (c, x0, y0) => { const out = []; let x = x0; for (const id of c) { const prev = out[out.length - 1]; out.push([id, x, !prev ? y0 : steps[id] !== undefined ? prev[2] + steps[id] : prev[2] + size[prev[0]].ch - size[id].ch]); x += size[id].cw; } return out; };
  const fits = lay => lay.every(([id, x, y]) => free(x, y, size[id].cw, size[id].ch));
  const spread = n => [0, ...Array.from({ length: n }, (_, i) => i + 1).flatMap(i => [i, -i])];          // 0, 1, -1, 2, -2, ...

  function placeStrip(c, A, side) {
    c = c.filter(has); if (!c.length) return;
    if (!A || !pos[A]) { for (const [id, x, y] of layStrip(c, 0, 0)) put(id, x, y); return; }
    const a = pos[A], aw = size[A].cw, ah = size[A].ch, h0 = size[c[0]].ch;
    let best = null;
    const offer = (x, y, score) => { if (best && score >= best.score) return; const lay = layStrip(c, x, y); if (fits(lay)) best = { lay, score }; };
    if (side === 'beside') { for (let dx = 0; dx < 40; dx++) for (const dy of spread(10)) offer(a.x + aw + dx, a.y + (steps[c[0]] || 0) + dy, dx + Math.abs(dy) * 6); }
    else for (let d = 0; d < 40; d++) for (const dx of spread(14)) offer(a.x + dx, side === 'below' ? a.y + ah + d : a.y - h0 - d, d * 2 + Math.max(0, Math.abs(dx) - 1) * 3 + (dx < 0 ? 0.2 : 0));          // (in line with the door before anything: rather further out than off to one side)
    if (best) { if (log) log(`${c[0]} ${side} ${A}: score ${best.score.toFixed(1)} at ${best.lay[0][1]},${best.lay[0][2]}`); for (const [id, x, y] of best.lay) put(id, x, y); return; }
    const x0 = Math.max(0, ...Object.keys(pos).map(right)) + 1; for (const [id, x, y] of layStrip(c, x0, 0)) put(id, x, y);          // (nowhere near: beside everything)
  }

  // ---- a side room: against its parent, below it if it can (above it if it climbs), else beside
  function placeChild(id) {
    const P = parent[id], p0 = pos[P], pw = size[P].cw, ph = size[P].ch, { cw, ch } = size[id], cands = [];
    const tryAt = (x, y, cost) => { if (free(x, y, cw, ch)) cands.push({ x, y, score: cost }); };
    const up = above.includes(id), dn = up ? 2 : 0, ab = up ? 0 : 2;
    for (let d = 0; d < 12; d++) {
      for (let x = p0.x - cw + 1; x < p0.x + pw; x++) { tryAt(x, p0.y + ph + d, dn + d * 3 + Math.abs(x - p0.x) * 0.2); tryAt(x, p0.y - ch - d, ab + d * 3 + Math.abs(x - p0.x) * 0.2); }
      for (let y = p0.y - ch + 1; y < p0.y + ph; y++) { tryAt(p0.x + pw + d, y, 4 + d * 3 + Math.abs(y - p0.y) * 0.2); tryAt(p0.x - cw - d, y, 5 + d * 3 + Math.abs(y - p0.y) * 0.2); }
    }
    if (cands.length) { cands.sort((p, q) => p.score - q.score); put(id, cands[0].x, cands[0].y); return; }
    put(id, Math.max(0, ...Object.keys(pos).map(right)) + 1, 0);
  }
  const flat = ids.filter(has), inChain = new Set(chains.flat());
  const kids = which => { for (let again = true; again;) { again = false; for (const id of flat) if (!pos[id] && !inChain.has(id) && parent[id] && pos[parent[id]] && which(id)) { placeChild(id); again = true; } } };

  // ---- the main row, the rooms that must have their places before the branches do (`early`), the branches in the blueprint's order, and last the side rooms
  placeStrip(chains[0], null);
  for (const ci of order) {
    if (!ci) continue;
    kids(id => early.includes(id));
    placeStrip(chains[ci], anchor[ci], sides[ci]);
  }
  kids(id => early.includes(id));
  kids(() => true);
  for (const id of flat) if (!pos[id]) put(id, Math.max(0, ...Object.keys(pos).map(right)) + 1, 0);          // (a room the blueprint does not reach: it should not happen)
  let mx = 1e9, my = 1e9; for (const id of flat) { mx = Math.min(mx, pos[id].x); my = Math.min(my, pos[id].y); }
  const out = {}; for (const id of ids) out[id] = has(id) ? { x: pos[id].x - mx, y: pos[id].y - my } : null;
  return out;
}
