// FALLING ICICLES of the Frozen Caverns.  A few of the icicles that hang over the paths are loose: when the hero walks beneath one it shivers (a fraction of a second - time enough to leap clear), then drops
// like a spike trap.  It does damage to whatever it hits (the hero, or a monster standing under it) and shatters on the ground.  Every visit to the room hangs a fresh set.
// (def.icicleTraps: [{ x, y, len, w }] - x the middle, y the ceiling it hangs from, in pixels; made by levelgen's decorate)
import { overlap } from './util.js';
import { COLORS } from './fx.js';
import { TILE, isSolid } from './world.js';
import { Audio_ as A } from './audio.js';

const WARN = 36, DMG = 9;

export class Icicle {
  constructor(d) { this.x = d.x; this.y0 = d.y; this.len = d.len; this.w = d.w; this.y = d.y; this.state = 0; this.t = 0; this.vy = 0; this.dead = false; this.shake = 0; }
  get box() { return { x: this.x - this.w * 0.5, y: this.y + 2, w: this.w, h: this.len - 2 }; }
  // is there a clear drop from the ceiling to the hero's head?  (no stone in between)
  clearTo(room, y1) {
    const tx = Math.floor(this.x / 16);
    for (let ty = Math.floor((this.y0 + this.len) / 16); ty * 16 < y1; ty++) { const v = room.get(tx, ty); if (isSolid(v) || v === TILE.PLAT) return false; }          // (a ledge between: the icicle would break on it)
    return true;
  }
  shatter(g) {
    this.dead = true; const x = this.x, y = this.y + this.len;
    g.fx.burst(x, y - 4, 12, COLORS.ice, { speed: 2.4, s0: 10 }); g.fx.sparks(x, y - 4, 12, COLORS.white, 3.4, { gy: 0.2 }); g.fx.smoke(x, y - 2, 2, { c0: [0.85, 0.92, 1], c1: [0.6, 0.7, 0.85], s0: 5, s1: 18, l: 0.5 });
    A.sfx('break'); g.shake(1.5, 6);
  }
  step(g) {
    if (this.dead) return; const p = g.player, r = g.room;
    if (this.state === 0) {
      const dx = Math.abs(p.x - this.x), headY = p.y - 40;
      if (!p.dead && dx < 34 && p.y > this.y0 + this.len + 10 && p.y - this.y0 < 16 * 13 && this.clearTo(r, headY)) { this.state = 1; this.t = 0; A.sfx('crack'); }
      return;
    }
    if (this.state === 1) {                                                         // it shivers, flakes of ice falling from it
      this.t++; this.shake = Math.sin(this.t * 1.9) * (0.6 + this.t / WARN * 1.2);
      if (this.t % 7 === 0) { g.fx.sparks(this.x + this.shake, this.y0 + this.len * 0.7, 2, COLORS.white, 1.2, { gy: 0.1 }); A.sfx('crack'); }
      if (this.t >= WARN) { this.state = 2; this.shake = 0; }
      return;
    }
    // falling
    this.vy = Math.min(6.2, this.vy + 0.3); this.y += this.vy; g.fx.light(this.x, this.y + this.len, 26, 0.3, [0.6, 0.85, 1]);
    const box = this.box;
    if (!p.dead && overlap(box, p.hurtbox)) { p.hurt(DMG, this.x, { kb: 1.4, stun: 20 }); this.shatter(g); return; }
    for (const e of g.enemies) if (!e.dead && e.hitBy && e.hitBy(box)) { e.hurt(DMG + 4, this.x < e.x ? 1 : -1, { id: -(Math.floor(Math.random() * 1e6) + 7000), color: '#bfe4ff', kb: 0.8 }); this.shatter(g); return; }
    const tx = Math.floor(this.x / 16), ty = Math.floor((this.y + this.len) / 16), v = r.get(tx, ty);
    if (isSolid(v) || (v === TILE.PLAT && this.y + this.len - ty * 16 < 8)) { this.y = Math.min(this.y, ty * 16 - this.len + 3); this.shatter(g); }
    else if (this.y > r.ph + 64) this.dead = true;
  }
  draw(ctx, cx, cy, t) {
    if (this.dead) return;
    const x = Math.round(this.x + this.shake - cx), y = Math.round(this.y - cy), w = this.w * 0.5, len = this.len;
    ctx.fillStyle = this.state === 1 ? 'rgba(150,215,240,0.96)' : 'rgba(120,190,225,0.95)'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + len); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(232,248,255,0.92)'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - 1, y); ctx.lineTo(x - 1, y + len * 0.82); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(70,130,170,0.9)'; ctx.beginPath(); ctx.moveTo(x + w * 0.4, y); ctx.lineTo(x + w, y); ctx.lineTo(x + 1, y + len * 0.9); ctx.closePath(); ctx.fill();          // the shaded side
    if (this.state === 2) { ctx.fillStyle = 'rgba(235,248,255,0.55)'; ctx.fillRect(x - 1, y - 14, 2, 14); }          // (a streak above it as it falls)
    else if (this.state === 0 && Math.sin(t * 0.04 + this.x) > 0.97) { ctx.fillStyle = '#fff'; ctx.fillRect(x, Math.round(y + len * 0.55), 1, 1); }
  }
}
