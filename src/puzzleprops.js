// WHAT THE PUZZLE ROOMS ARE MADE OF (the rules are in puzzle.js): the levers, and the things they light - candelabra, altar candles, bog vents, frost lenses - with the beam that crosses the lenses and the carved stone
// beside the vents.  A lever can be pulled as often as you like, and each pull works its rule on the pattern (kept in the save flag 'pzc_<room>').  A two-position lever stays where it is put ('pzl_<room>', a bit for
// each); a lever on a spring swings over and comes back.  When the pattern wanted is made the chest unlocks (flag 'pzs_<room>') and the levers are done with.
import { Lever, Chest } from './props.js';
import { drawDeco, candelabraWicks } from './decor.js';
import { pull, candlesNow } from './puzzle.js';
import { Audio_ as A } from './audio.js';
import { rand } from './util.js';

const isLit = (g, pz, i) => !!((candlesNow(g.save.flags, pz) >> i) & 1);

export class PuzzleLever extends Lever {
  constructor(x, y, o, flags) {
    super(x, y); this.pz = o.pz; this.i = o.i; this.hold = 0; this.up = !o.pz.spring && !!(((flags['pzl_' + o.pz.id] ?? o.pz.levers) >> o.i) & 1); this.open = !!flags['pzs_' + o.pz.id]; this.k = this.up ? 1 : -1;          // (open: solved - nothing left to do with it)
  }
  update(g) {
    this.t++; if (this.hold > 0) this.hold--; const to = this.up || this.hold ? 1 : -1; this.k += Math.max(-0.14, Math.min(0.14, to - this.k));
    if (!this.open) { g.fx.glow(this.x, this.y - 12, 14, [1, 0.85, 0.6], 0.14 + 0.05 * Math.sin(this.t * 0.06)); if (this.t % 11 === 0) g.fx.emit({ x: this.x + rand(-11, 11), y: this.y - rand(2, 18), vx: 0, vy: -rand(0.12, 0.34), life: rand(45, 80), s0: rand(5, 8), s1: 2, c0: [1, 0.86, 0.5], c1: [1, 1, 0.92], a0: 1, a1: 0, kind: 6 }); }
  }
  interact(g) {
    const f = g.save.flags, id = this.pz.id, done = 'pzs_' + id; if (f[done]) return false; if (this.hold) return true;          // (still swinging back)
    const was = candlesNow(f, this.pz), now = pull(this.pz.rules[this.i], was); f['pzc_' + id] = now;
    if (this.pz.spring) this.hold = 18; else { const levers = (f['pzl_' + id] ?? this.pz.levers) ^ (1 << this.i); f['pzl_' + id] = levers; this.up = !!((levers >> this.i) & 1); }
    A.sfx('click'); A.sfx('gear'); if (now & ~was) A.sfx('fire'); g.fx.sparks(this.x, this.y - 14, 6, [[1, 0.9, 0.6], [0.8, 0.8, 1]], 2, { gy: 0.1 });
    if (now === this.pz.goal) {
      f[done] = true; for (const o of g.props) if (o instanceof PuzzleLever) o.open = true;
      g.after(40, () => { A.sfx('seal'); A.sfx('item'); g.shake(1.5, 20); const c = g.props.find(o => o instanceof Chest && o.lock === done); if (c) { g.fx.ring(c.x, c.y - 10, 40, [1, 0.85, 0.5], 30, 0.15); g.fx.sparks(c.x, c.y - 10, 18, [[1, 0.9, 0.5], [0.7, 0.7, 0.8]], 2.6, { gy: 0.12 }); g.popup(c.x, c.y - 32, 'UNLOCKED', '#ffe9a0'); } });
    }
    return true;
  }
}

// one light of a puzzle: it follows bit i of the pattern.  (It keeps this.lit, and calls change() when that turns)
class Piece {
  constructor(x, y, o) { this.x = x; this.y = y; this.pz = o.pz; this.i = o.i; this.t = 0; this.lit = null; this.dead = false; }
  update(g) { this.t++; const lit = isLit(g, this.pz, this.i); if (this.lit !== null && lit !== this.lit) this.change(g, lit); this.lit = lit; this.glow(g); }
  change() { }
  glow() { }
}

// a candelabrum on a bracket high on the wall, or ('altar') a tall candle on a stone ledge
class PuzzleCandle extends Piece {
  constructor(x, y, o) { super(x, y - (o.pz.look === 'altar' ? 40 : 46), o); this.altar = o.pz.look === 'altar'; }          // (y: what it stands on - the ledge or its shelf)
  get box() { return { x: this.x - 14, y: this.y - 44, w: 28, h: 44 }; }
  wicks() { return this.altar ? [[this.x, this.y - 26]] : candelabraWicks(this); }
  change(g, lit) { if (lit) g.fx.ring(this.x, this.y - 30, 24, [1, 0.8, 0.45], 14, 0.2); else for (const [wx, wy] of this.wicks()) g.fx.smoke(wx, wy - 3, 2); }
  glow(g) {
    if (this.altar) g.fx.light(this.x, this.y - 40, 46, 0.3);          // (a little light on the wall, so the soot marks can be made out)
    if (!this.lit) return;
    for (const [wx, wy] of this.wicks()) g.fx.flame(wx, wy, { scale: this.altar ? 1.05 : 0.85, seed: wx, sparks: false });
    g.fx.light(this.x, this.y - 34, 66, 0.85);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.altar) {          // a brass dish, a tall candle of yellow wax with its drips, the wick
      ctx.fillStyle = '#8a6a2a'; ctx.fillRect(x - 7, y - 3, 14, 3); ctx.fillStyle = '#c9a14a'; ctx.fillRect(x - 7, y - 3, 14, 1); ctx.fillStyle = '#8a6a2a'; ctx.fillRect(x - 2, y - 5, 4, 2);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 4, y - 24, 8, 19); ctx.fillStyle = '#b8a888'; ctx.fillRect(x + 1, y - 24, 3, 19); ctx.fillStyle = '#f6efd8'; ctx.fillRect(x - 4, y - 24, 8, 1); ctx.fillRect(x - 4, y - 23, 2, 6); ctx.fillRect(x + 2, y - 23, 1, 9);
      ctx.fillStyle = '#1a1208'; ctx.fillRect(x, y - 27, 1, 3); return;
    }
    ctx.fillStyle = '#1c1722'; ctx.fillRect(x - 3, y + 3, 6, 8); ctx.fillStyle = '#4a4352'; ctx.fillRect(x - 15, y + 1, 30, 4); ctx.fillStyle = '#6a647a'; ctx.fillRect(x - 15, y + 1, 30, 1);          // the stone shelf and its corbel
    drawDeco(ctx, { t: 'cdl', x: this.x, y: this.y }, cx, cy, 0, null);
  }
}

// a bog vent: a cone of mud standing out of the mire behind the causeway.  Dormant it bubbles; lit it burns blue-green
class PuzzleVent extends Piece {
  constructor(x, y, o) { super(x, y - 34, o); }          // (y: its mouth)
  get box() { return { x: this.x - 12, y: this.y - 30, w: 24, h: 64 }; }
  change(g, lit) { if (lit) g.fx.ring(this.x, this.y - 8, 28, [0.4, 1, 0.75], 16, 0.2); else g.fx.smoke(this.x, this.y - 4, 4); }
  glow(g) {
    if (this.lit) { g.fx.flame(this.x, this.y - 2, { scale: 2.6, seed: this.x, color: 'green', sparks: false }); for (const [dx, k] of [[-4, 5], [4, 11]]) g.fx.flame(this.x + dx, this.y + 1, { scale: 1.3, seed: this.x + k, color: 'ice', sparks: false, glow: 0.4 }); g.fx.light(this.x, this.y - 14, 90, 0.95, [0.4, 1, 0.75]); }
    else g.fx.light(this.x, this.y, 30, 0.25, [0.4, 0.8, 0.6]);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#1c2318'; ctx.beginPath(); ctx.moveTo(x - 15, y + 34); ctx.lineTo(x - 8, y + 3); ctx.lineTo(x + 8, y + 3); ctx.lineTo(x + 15, y + 34); ctx.closePath(); ctx.fill();          // the mud cone
    ctx.fillStyle = '#2f3a24'; ctx.beginPath(); ctx.moveTo(x - 11, y + 30); ctx.lineTo(x - 7, y + 4); ctx.lineTo(x - 2, y + 4); ctx.lineTo(x - 5, y + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a5638'; ctx.fillRect(x - 9, y + 1, 18, 3); ctx.fillStyle = '#6b7a4e'; ctx.fillRect(x - 9, y + 1, 18, 1);          // its lip
    ctx.fillStyle = this.lit ? '#7fffd0' : '#0a100c'; ctx.fillRect(x - 6, y, 12, 2);
    if (this.lit) return;
    for (let k = 0; k < 3; k++) {          // slow, murky bubbles
      const p = ((this.t + k * 47 + this.i * 29) % 140) / 140, r = 1 + p * 2.4;
      if (p > 0.85) continue; ctx.strokeStyle = 'rgba(150,190,130,' + (0.75 * (1 - p)).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + (k - 1) * 4 + Math.sin(p * 7 + k) * 2, y - p * 22, r, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// a frosted-glass lens in a brass ring: CLEAR when its bit is set, FROSTED when not.  The third lies flat, in the beam's lower branch
const LENS_UP = [74, 74, 44];          // (how high each hangs over the floor)
class PuzzleLens extends Piece {
  constructor(x, y, o) { super(x, y - LENS_UP[o.i], o); this.flat = o.i === 2; }
  get box() { return { x: this.x - 14, y: this.y - 14, w: 28, h: 28 }; }
  change(g, lit) { g.fx.sparks(this.x, this.y, 8, lit ? [[0.9, 0.97, 1], [0.6, 0.8, 1]] : [[1, 1, 1], [0.75, 0.85, 0.95]], 1.4, { gy: 0.04 }); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), rx = this.flat ? 13 : 5, ry = this.flat ? 5 : 13;
    ctx.strokeStyle = '#4a4456'; ctx.lineWidth = 1; ctx.beginPath();          // what holds it
    if (this.i === 0) { ctx.moveTo(x, y - ry); ctx.lineTo(x, Math.round(32 - cy)); }
    else if (this.i === 1) { ctx.moveTo(x - 3, y - ry); ctx.lineTo(x - 18, Math.round(32 - cy)); ctx.moveTo(x + 3, y - ry); ctx.lineTo(x + 18, Math.round(32 - cy)); }
    else { ctx.moveTo(x - rx, y); ctx.lineTo(x - 24, y); ctx.lineTo(x - 24, y + 44); }
    ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = this.lit ? 'rgba(150,205,240,0.28)' : 'rgba(222,236,246,0.93)'; ctx.fill();
    if (!this.lit) { ctx.clip(); ctx.fillStyle = '#ffffff'; for (let k = 0; k < 14; k++) ctx.fillRect(x - rx + ((k * 53) % (rx * 2)), y - ry + ((k * 31) % (ry * 2)), 2, 1); ctx.fillStyle = '#a9c4d8'; for (let k = 0; k < 8; k++) ctx.fillRect(x - rx + ((k * 29) % (rx * 2)), y - ry + ((k * 47) % (ry * 2)), 1, 2); }
    ctx.restore();
    ctx.strokeStyle = '#c9a14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    if (this.lit) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - (this.flat ? 7 : 2), y - (this.flat ? 2 : 7), this.flat ? 5 : 1, this.flat ? 1 : 5); }          // (a glint: you see through it)
  }
}

export const puzzlePiece = (x, y, o) => o.pz.look === 'vent' ? new PuzzleVent(x, y, o) : o.pz.look === 'lens' ? new PuzzleLens(x, y, o) : new PuzzleCandle(x, y, o);

// THE BEAM of the lens room, all of it: the brazier it comes from, the way it goes, the two side crystals and the node in the middle that must NOT be struck.
// It runs level through lens 1 (if frosted it scatters there and is lost) to lens 2.  Lens 2 clear: straight on into the node.  Lens 2 frosted: it splits, one branch up to a crystal, the other down through lens 3 to the
// second crystal (a frosted lens 3 scatters that one).  So both crystals shine, and the node stays dark, only with lens 1 clear, 2 frosted and 3 clear.
class PuzzleBeam {
  constructor(x, y, o) { const px = tx => tx * 16 + 8; this.pz = o.pz; this.floor = y; this.h = y - LENS_UP[0]; this.src = px(o.src); this.g1 = px(o.g1); this.g2 = px(o.g2); this.node = px(o.node); this.x = x; this.y = y; this.t = 0; this.dead = false; this.s = o.pz.start; }
  get box() { return { x: this.src - 10, y: this.floor - 140, w: this.node - this.src + 20, h: 140 }; }
  paths() {          // the straight runs of light, where it scatters, and what it strikes
    const clear = i => !!((this.s >> i) & 1), H = this.h, top = this.floor - 124, low = this.floor - 14, out = { runs: [[this.src, H, this.g1, H]], lost: null, top: false, low: false, node: false };
    if (!clear(0)) { out.lost = [this.g1, H]; return out; }
    out.runs.push([this.g1, H, this.g2, H]);
    if (clear(1)) { out.runs.push([this.g2, H, this.node, H]); out.node = true; return out; }
    out.runs.push([this.g2, H, this.g2, top], [this.g2, H, this.g2, this.floor - LENS_UP[2]]); out.top = true;
    if (clear(2)) { out.runs.push([this.g2, this.floor - LENS_UP[2], this.g2, low]); out.low = true; } else out.lost = [this.g2, this.floor - LENS_UP[2]];
    return out;
  }
  update(g) {
    this.t++; this.s = candlesNow(g.save.flags, this.pz); const p = this.paths(), warm = [1, 0.75, 0.4];
    g.fx.flame(this.src, this.h + 3, { scale: 1.3, seed: this.src, sparks: false }); g.fx.light(this.src, this.h, 80, 0.9);
    for (const [x0, y0, x1, y1] of p.runs) g.fx.light((x0 + x1) / 2, (y0 + y1) / 2, 44, 0.45, warm);
    if (p.lost) { g.fx.glow(p.lost[0], p.lost[1], 30, warm, 0.45 + 0.1 * Math.sin(this.t * 0.2)); if (this.t % 6 === 0) g.fx.sparks(p.lost[0], p.lost[1], 1, [[1, 0.85, 0.5], [1, 1, 0.9]], 1.2, { gy: 0.03 }); }
    for (const [on, cy] of [[p.top, this.floor - 130], [p.low, this.floor - 8]]) if (on) { g.fx.glow(this.g2, cy, 30, [1, 0.85, 0.55], 0.55); g.fx.light(this.g2, cy, 60, 0.8, warm); }
    if (p.node) { g.fx.glow(this.node, this.h, 34 + 5 * Math.sin(this.t * 0.4), [1, 0.25, 0.15], 0.6); if (this.t % 5 === 0) g.fx.sparks(this.node, this.h, 2, [[1, 0.4, 0.2], [1, 0.85, 0.5]], 2, { gy: 0.08 }); }
  }
  draw(ctx, cx, cy) {
    const p = this.paths(), X = v => Math.round(v - cx), Y = v => Math.round(v - cy), H = this.h;
    // the brazier on its iron stand
    ctx.fillStyle = '#2a2833'; ctx.fillRect(X(this.src) - 2, Y(H) + 8, 4, this.floor - H - 8); ctx.fillRect(X(this.src) - 9, Y(this.floor) - 3, 18, 3);
    ctx.fillStyle = '#48465a'; ctx.beginPath(); ctx.moveTo(X(this.src) - 10, Y(H) + 3); ctx.lineTo(X(this.src) + 10, Y(H) + 3); ctx.lineTo(X(this.src) + 6, Y(H) + 10); ctx.lineTo(X(this.src) - 6, Y(H) + 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8a8aa0'; ctx.fillRect(X(this.src) - 10, Y(H) + 3, 20, 1);
    // the light
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const k = 0.85 + 0.15 * Math.sin(this.t * 0.17);
    for (const [w, col] of [[9, 'rgba(255,140,40,' + (0.16 * k).toFixed(3) + ')'], [4, 'rgba(255,180,80,' + (0.4 * k).toFixed(3) + ')'], [1.5, 'rgba(255,240,190,0.95)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (const [x0, y0, x1, y1] of p.runs) { ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); } ctx.stroke();
    }
    ctx.restore();
    // the node: a black stone in an iron cage on a post
    const nx = X(this.node), ny = Y(H);
    ctx.fillStyle = '#2a2833'; ctx.fillRect(nx - 2, ny + 8, 4, this.floor - H - 8); ctx.fillRect(nx - 7, Y(this.floor) - 3, 14, 3);
    ctx.fillStyle = p.node ? '#ff5a30' : '#17121c'; ctx.beginPath(); ctx.arc(nx, ny, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6c6c80'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(nx, ny, 8.5, 0, Math.PI * 2); ctx.moveTo(nx - 8, ny); ctx.lineTo(nx + 8, ny); ctx.moveTo(nx, ny - 8); ctx.lineTo(nx, ny + 8); ctx.stroke();
    // the two side crystals
    for (const [on, wy, up] of [[p.top, this.floor - 130, false], [p.low, this.floor - 8, true]]) {
      const x = X(this.g2), y = Y(wy);
      ctx.fillStyle = on ? '#ffd890' : '#3a5a78'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = on ? '#fff4d0' : '#6f9cc0'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x - 6, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a4456'; if (up) ctx.fillRect(x - 8, y + 7, 16, 2); else { ctx.fillRect(x - 8, y - 10, 16, 2); ctx.fillRect(x - 1, Y(32), 2, y - 10 - Y(32)); }
    }
  }
}

// THE CARVED STONE beside the vent room's chest: a totem's face over four marks, one for each vent from the left - a flame where it must burn, a closed ring where it must not.  Each mark gleams while its vent burns (teal if it should, red if not).
// And while the SECOND vent burns, sludge wells up over the chest's lock.
class PuzzleStele {
  constructor(x, y, o) { this.x = x; this.y = y; this.pz = o.pz; this.chest = o.chest * 16 + 8; this.s = o.pz.start; this.t = 0; this.dead = false; }
  get box() { return { x: this.x - 20, y: this.y - 52, w: 40, h: 52 }; }
  update(g) { this.t++; this.s = candlesNow(g.save.flags, this.pz); this.solved = !!g.save.flags['pzs_' + this.pz.id]; g.fx.light(this.x, this.y - 26, 46, 0.4, [0.5, 0.9, 0.75]); if (this.s & 2 && this.t % 9 === 0) g.fx.emit({ x: this.chest + rand(-9, 9), y: this.y - 16, vx: 0, vy: rand(0.15, 0.4), life: 30, s0: 4, s1: 2, c0: [0.45, 0.65, 0.2], c1: [0.25, 0.35, 0.1], a0: 0.9, a1: 0, kind: 6 }); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    ctx.fillStyle = '#2e3630'; ctx.fillRect(x - 20, y - 28, 40, 28); ctx.fillRect(x - 11, y - 50, 22, 22); ctx.fillStyle = '#4b574c'; ctx.fillRect(x - 20, y - 28, 40, 2); ctx.fillRect(x - 11, y - 50, 22, 2); ctx.fillStyle = '#39433b'; ctx.fillRect(x - 18, y - 24, 36, 20);
    ctx.fillStyle = '#121814'; ctx.fillRect(x - 7, y - 44, 4, 3); ctx.fillRect(x + 3, y - 44, 4, 3); ctx.fillRect(x - 1, y - 41, 2, 6); ctx.fillRect(x - 6, y - 33, 12, 2);          // the totem's face
    for (let i = 0; i < 4; i++) {
      const mx = x - 13 + i * 9, my = y - 14, burns = (this.s >> i) & 1, wanted = (this.pz.goal >> i) & 1;
      ctx.fillStyle = ctx.strokeStyle = burns ? (wanted ? '#8fffd8' : '#ff7a4a') : '#10160f'; ctx.lineWidth = 1;          // (teal: it burns as it should; red: it should not be burning)
      if (wanted) { ctx.beginPath(); ctx.moveTo(mx, my - 8); ctx.quadraticCurveTo(mx + 5, my - 1, mx + 3, my + 3); ctx.quadraticCurveTo(mx, my + 6, mx - 3, my + 3); ctx.quadraticCurveTo(mx - 5, my - 1, mx, my - 8); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.moveTo(mx - 3.5, my); ctx.lineTo(mx + 3.5, my); ctx.stroke(); }
    }
    if (this.s & 2 && !this.solved) {          // sludge over the lock
      const c = Math.round(this.chest - cx); ctx.fillStyle = '#4d6b22'; ctx.fillRect(c - 12, y - 17, 24, 6); for (const [dx, len] of [[-10, 9], [-3, 13], [5, 7], [9, 11]]) ctx.fillRect(c + dx, y - 12, 3, len); ctx.fillStyle = '#7d9c38'; ctx.fillRect(c - 12, y - 17, 24, 2); ctx.fillRect(c - 15, y - 2, 30, 2);
    }
  }
}

export const puzzleDress = (x, y, o) => o.kind === 'beam' ? new PuzzleBeam(x, y, o) : new PuzzleStele(x, y, o);
