// WHERE EVERY ROOM SITS ON THE CASTLE MAP (the map screen is MapScreen in ui.js; levelgen.js feeds this its blueprint).
// The map is the GEOGRAPHY of the world: a room is a block of whole cells (see mapCells: one cell per screen of the room), up on the map is up in the world, and every way from a room to the next is drawn
// level - the doorway of one meets the doorway of the other.  It may sprawl and leave empty ground (the player scrolls about it), but rooms never overlap.
//   * Each chain of rooms (levelgen CHAINS) is a STRIP: its rooms side by side, touching, each set so that its way in is level with the way out of the room before it (`steps`).
//   * A strip is set against the room it is entered from (its ANCHOR) in the direction the blueprint says (`sides`): 'beside' (to the right, level with the door), 'below' or 'above'.  If that place is
//     taken it slides along or further out until it fits.  The strips are placed in the blueprint's `order`, so the ones that must be close to their anchor come first.
//   * A side room (a sanctuary, a house, a vault, a lair) is set against its parent room, below it if there is room (above it if it climbs: `above`), side by side with its brothers.
//   * A side room with a PLACE of its own (`slots`: the rooms off a two-floor room) goes right above or below its parent, under or over its door, and the parent's strip is only laid where that place is free.
import { clamp } from './util.js';

export const mapCells = r => ({ cw: clamp(Math.round(r.w / 24), 1, 7), ch: clamp(Math.round(r.h / 14), 1, 7) });          // (a room is one cell across per 24 tiles and one up per 14: at least 1, at most 7 and 7 - the long ways down)

// ids: the rooms to put on the map, in a fixed order; size[id] = { cw, ch }; zone[id]; chains: [[ids]] (the first is the main row); anchor[i] = the room chain i is entered from;
// parent[id] = the room a side room hangs from; sides[i] = 'beside' | 'below' | 'above' for chain i; order = the chain indices in the order to place them; steps[id] = how many cells id's top lies below
// the top of the room before it (above, if negative) - for the first room of a strip, below the top of its anchor.  -> { id: { x, y } } in cells, the whole map starting at 0, 0
// spurs: [{ id, of, dy }] a room to the LEFT of room `of`, dy cells below its top (the chambers off the top of the Belfry and half way down the Oubliette); { id, of, right: true, dy } the same to its RIGHT (the Winding Room, half way up
// the Mainspring Shaft); or { id, of, below: true } a room right UNDER `of` (the Oubliette, under the Warder's grate).  need: true = the strip must be laid where the spur has its place
// slots: [{ id, of, side: 'above' | 'below', at }] a side room right above / below room `of`; at = how far along `of` its door stands (0..1)
export function packMap({ ids, size, zone, chains, anchor, parent, sides, order, above = [], early = [], steps = {}, spurs = [], slots = [], log }) {
  const pos = {}, occ = new Map(), key = (x, y) => x + ',' + y, has = id => !!size[id];
  const free = (x, y, cw, ch) => { for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (occ.has(key(x + i, y + j))) return false; return true; };
  const put = (id, x, y) => { const { cw, ch } = size[id]; pos[id] = { x, y }; for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) occ.set(key(x + i, y + j), id); };
  const right = id => pos[id].x + size[id].cw;

  // ---- a strip: rooms side by side, each level with the one before it by its doorway (flush at the foot where no step is given)
  const layStrip = (c, x0, y0) => { const out = []; let x = x0; for (const id of c) { const prev = out[out.length - 1]; out.push([id, x, !prev ? y0 : steps[id] !== undefined ? prev[2] + steps[id] : prev[2] + size[prev[0]].ch - size[id].ch]); x += size[id].cw; } return out; };
  const fits = lay => lay.every(([id, x, y]) => free(x, y, size[id].cw, size[id].ch));
  const spread = n => [0, ...Array.from({ length: n }, (_, i) => i + 1).flatMap(i => [i, -i])];          // 0, 1, -1, 2, -2, ...

  // ---- where the rooms with places of their own would go if the strip `lay` were put down: [[id, x, y]], or null if one of them (or a spur that needs its place) cannot be had there
  function placesFor(lay) {
    const mine = new Set(), take = (x, y, cw, ch) => { if (!free(x, y, cw, ch)) return false; for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) if (mine.has(key(x + i, y + j))) return false; for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) mine.add(key(x + i, y + j)); return true; };
    for (const [id, x, y] of lay) take(x, y, size[id].cw, size[id].ch);
    const out = [];
    for (const s of spurs) { if (!s.need || !has(s.id)) continue; const e = lay.find(l => l[0] === s.of); if (e && !take(s.right ? e[1] + size[s.of].cw : e[1] - size[s.id].cw, e[2] + (s.dy || 0), size[s.id].cw, size[s.id].ch)) return null; }
    for (const [of, px, py] of lay) for (const side of ['above', 'below']) {
      let from = -1e9;          // (left to right in the order their doors stand, never overlapping)
      for (const s of slots.filter(q => q.of === of && q.side === side && has(q.id)).sort((p, q) => p.at - q.at)) {
        const { cw, ch } = size[s.id], pw = size[of].cw, want = px + Math.max(0, Math.min(pw - cw, Math.round(s.at * pw - cw / 2))), y = side === 'above' ? py - ch : py + size[of].ch;
        let got = null; for (const d of [0, 1, -1, 2, -2]) { const x = Math.max(from, want + d); if (x > px + pw - 1 || x + cw - 1 < px) continue; if (take(x, y, cw, ch)) { got = x; break; } }
        if (got === null) return null; out.push([s.id, got, y]); from = got + cw;
      }
    }
    return out;
  }
  // the rooms with places off the rooms of a strip that has just been put down (whatever places can still be had; the rest go where side rooms go)
  const putSlots = list => { for (const [id, x, y] of list || []) if (!pos[id] && free(x, y, size[id].cw, size[id].ch)) put(id, x, y); };

  function placeStrip(c, A, side) {
    c = c.filter(has); if (!c.length) return;
    if (!A || !pos[A]) { const lay = layStrip(c, 0, 0), more = placesFor(lay); for (const [id, x, y] of lay) put(id, x, y); putSlots(more); return; }
    const a = pos[A], aw = size[A].cw, ah = size[A].ch, h0 = size[c[0]].ch;
    let best = null, strict = true;          // (strict: only where every room with a place of its own can have it)
    const offer = (x, y, score) => { if (best && score >= best.score) return; const lay = layStrip(c, x, y); if (!fits(lay)) return; const more = placesFor(lay); if (strict && !more) return; best = { lay, more, score }; };
    for (const pass of [true, false]) {
      strict = pass;
      if (side === 'beside') { for (let dx = 0; dx < 40; dx++) for (const dy of spread(10)) offer(a.x + aw + dx, a.y + (steps[c[0]] || 0) + dy, dx + Math.abs(dy) * 6); }
      else for (let d = 0; d < 40; d++) for (const dx of spread(14)) offer(a.x + dx, side === 'below' ? a.y + ah + d : a.y - h0 - d, d * 2 + Math.max(0, Math.abs(dx) - 1) * 3 + (dx < 0 ? 0.2 : 0));          // (in line with the door before anything: rather further out than off to one side)
      if (best) break;
    }
    if (best) { if (log) log(`${c[0]} ${side} ${A}: score ${best.score.toFixed(1)} at ${best.lay[0][1]},${best.lay[0][2]}`); for (const [id, x, y] of best.lay) put(id, x, y); placeSpurs(); putSlots(best.more); return; }
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

  // ---- a spur takes its place the moment the room it hangs from has one, before another strip can
  const placeSpurs = () => { for (let again = true; again;) { again = false; for (const s of spurs) if (has(s.id) && !pos[s.id] && pos[s.of]) {
    const { cw, ch } = size[s.id], p = pos[s.of];
    if (s.below) { const x0 = p.x + Math.floor((size[s.of].cw - cw) / 2), y0 = p.y + size[s.of].ch; for (let d = 0; d < 30 && !pos[s.id]; d++) for (const dx of spread(3)) if (!pos[s.id] && free(x0 + dx, y0 + d, cw, ch)) { put(s.id, x0 + dx, y0 + d); again = true; } }          // (it must have a place: other strips hang from it)
    else { const sx = s.right ? p.x + size[s.of].cw : p.x - cw; if (free(sx, p.y + (s.dy || 0), cw, ch)) { put(s.id, sx, p.y + (s.dy || 0)); again = true; } }
  } } };

  // ---- the main row, the rooms that must have their places before the branches do (`early`), the branches in the blueprint's order, and last the side rooms
  placeStrip(chains[0], null); placeSpurs();
  for (const ci of order) {
    if (!ci) continue;
    kids(id => early.includes(id));
    placeStrip(chains[ci], anchor[ci], sides[ci]); placeSpurs();
  }
  kids(id => early.includes(id));
  for (const s of spurs) if (!pos[s.id]) parent[s.id] = s.of;          // (its place was taken: it sits wherever it can against that room)
  kids(() => true);
  for (const id of flat) if (!pos[id]) put(id, Math.max(0, ...Object.keys(pos).map(right)) + 1, 0);          // (a room the blueprint does not reach: it should not happen)
  let mx = 1e9, my = 1e9; for (const id of flat) { mx = Math.min(mx, pos[id].x); my = Math.min(my, pos[id].y); }
  const out = {}; for (const id of ids) out[id] = has(id) ? { x: pos[id].x - mx, y: pos[id].y - my } : null;
  return out;
}
