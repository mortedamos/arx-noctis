// Disposable items: thrown with the SPELL key (C / I) once selected on the hotbar (Q / V move the selection).  Counts are capped per item,
// saved with the game, and found as drops, in statues and lying around the castle.
//   dagger   - weak, fast, long flat throw
//   torch    - slow arc; sets what it hits ablaze (damage over time), burns wooden barricades, leaves a short ground fire
//   marrow   - the magic arrow: a dagger that homes in on the nearest foe, trailing white sparks
//   salt     - Sal Terrae: a handful of salt that lies where it falls; whatever stands in it is hurt, the undead much more      bandage - heals 35% of your max HP over ~1.5 s
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { T, rand, clamp, choice } from './util.js';
import { TILE } from './world.js';

import { ITEMS, ITEM_ORDER, itemCount, addItem, randomItemId } from './itemdata.js';
export { ITEMS, ITEM_ORDER, itemCount, addItem, randomItemId };
const UNDEAD = new Set(['skeleton', 'zombie', 'ghost', 'wraith', 'ghoul', 'wyrm', 'frostwyrm', 'emberwyrm', 'fireskull']);

const hitId = () => -Math.floor(Math.random() * 1e9) - 1e6;

// ------------------------------------------------------------------------------------------------ thrown things
class Thrown {
  constructor(x, y, vx, vy, o = {}) {
    Object.assign(this, { x, y, vx, vy, owner: 'player', dead: false, t: 0, dmg: 4, w: 6, h: 6, grav: 0, life: 120, rot: 0, spin: 0, pierce: false, hits: new Set(), dir: vx >= 0 ? 1 : -1, kind: 'thrown' }, o);
  }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }          // the game's generic projectile test must not touch these: they resolve their own hits
  hb() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  solidAt(g, x, y) { return g.room.solid(Math.floor(x / T), Math.floor(y / T)); }
  // enemies currently touched (that haven't been hit by this throw yet)
  touching(g) { const b = this.hb(), out = []; for (const e of g.enemies) if (!e.dead && !this.hits.has(e) && e.hitBy(b)) out.push(e); return out; }
  strike(g, e, dmg, color, extra = {}) { this.hits.add(e); return e.hurt(dmg, this.dir, { id: hitId(), color, kb: 1.1, ...extra }); }
  explode() { this.dead = true; }
  step(g) {                                                       // returns 'wall' | 'floor' | null after moving one step
    this.t++; this.vy += this.grav; this.rot += this.spin; const nx = this.x + this.vx, ny = this.y + this.vy;
    if (--this.life <= 0) { this.dead = true; return 'life'; }
    if (this.solidAt(g, nx, this.y)) { this.hitTile = [Math.floor(nx / T), Math.floor(this.y / T)]; return 'wall'; }
    if (this.vy > 0 && this.solidAt(g, this.x, ny + 2)) { this.hitTile = [Math.floor(this.x / T), Math.floor((ny + 2) / T)]; return 'floor'; }
    if (this.vy < 0 && this.solidAt(g, this.x, ny - 2)) { this.vy = 0.5; }
    this.x = nx; this.y = ny; return null;
  }
  tileAt() { return this.hitTile ? this.hitTile : null; }
}

class Dagger extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 5.4, 0, { dmg, w: 8, h: 4, grav: 0.015, life: 55 }); }
  update(g) {
    const r = this.step(g);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x + this.dir * 4, this.y, 4, [[1, 1, 1], [0.7, 0.75, 0.9]], 1.6); A.sfx('block'); this.dead = true; return; }
    for (const e of this.touching(g)) { if (this.strike(g, e, this.dmg, '#dfe6f5')) { g.fx.sparks(this.x, this.y, 4, [[1, 1, 1], [1, 0.9, 0.5]], 2); this.dead = true; return; } }
    for (const o of g.props) if (o.hit && !o.dead && o.box && this.x > o.box.x && this.x < o.box.x + o.box.w && this.y > o.box.y && this.y < o.box.y + o.box.h) { o.hit(g, this.dmg, this.dir); this.dead = true; return; }
  }
  draw(ctx, cx, cy) { const x = this.x - cx, y = this.y - cy, d = this.dir; ctx.fillStyle = '#dfe6f5'; ctx.fillRect(Math.round(x - 4 * d - (d < 0 ? 4 : 0)), Math.round(y - 1), 8, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x + (d > 0 ? 1 : -4)), Math.round(y - 1), 3, 1); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(Math.round(x - (d > 0 ? 6 : -3)), Math.round(y - 1), 3, 2); }
}

// the magic arrow: it leaves the hand like a dagger, then bends toward the nearest foe it can see (turning at a limited rate, so it can still be dodged round a corner)
// and trails white sparks.  It breaks on walls and on the first thing it hits.
const seen = (g, x0, y0, x1, y1) => { for (let i = 1; i < 8; i++) { const k = i / 8; if (g.room.solid(Math.floor((x0 + (x1 - x0) * k) / T), Math.floor((y0 + (y1 - y0) * k) / T))) return false; } return true; };
class MagicArrow extends Thrown {
  constructor(g, x, y, dir, dmg) { super(x, y, dir * 4, -0.3, { dmg, w: 8, h: 6, life: 160 }); this.ang = dir > 0 ? -0.07 : Math.PI + 0.07; this.spd = 4; this.target = null; }
  pick(g) {
    let best = null, bs = 1e9; const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (const e of g.enemies) {
      if (e.dead || e.invuln || e.talk || (e.harmless && !e.isBoss)) continue; const dx = e.x - this.x, dy = e.cy - this.y, d = Math.hypot(dx, dy); if (d > 280) continue;
      const ahead = (dx * ca + dy * sa) / (d || 1); if (ahead < -0.3 || !seen(g, this.x, this.y, e.x, e.cy)) continue;                  // not behind it, and not through a wall
      const score = d * (1.5 - 0.5 * ahead); if (score < bs) { bs = score; best = e; }
    }
    return best;
  }
  update(g) {
    if (!this.target || this.target.dead || this.target.invuln || this.t % 12 === 0) this.target = this.pick(g) || (this.target && !this.target.dead && !this.target.invuln ? this.target : null);
    if (this.target) { const da = Math.atan2(this.target.cy - this.y, this.target.x - this.x) - this.ang; this.ang += clamp(Math.atan2(Math.sin(da), Math.cos(da)), -0.15, 0.15); }
    this.spd = Math.min(5.2, this.spd + 0.04); this.vx = Math.cos(this.ang) * this.spd; this.vy = Math.sin(this.ang) * this.spd; this.dir = this.vx >= 0 ? 1 : -1;
    const r = this.step(g), ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    for (let i = 0; i < 2; i++) g.fx.emit({ x: this.x - ca * (3 + i * 4) + rand(-1, 1), y: this.y - sa * (3 + i * 4) + rand(-1, 1), vx: rand(-0.25, 0.25) - this.vx * 0.05, vy: rand(-0.25, 0.2), life: rand(18, 36), s0: i ? 3 : 6, s1: 0.5, c0: [1, 1, 1], c1: [0.72, 0.86, 1], a0: 1, a1: 0, kind: i ? 1 : 6, drag: 0.96 });      // white sparks behind it
    g.fx.glow(this.x, this.y, 8, [0.9, 0.95, 1], 0.5); g.fx.light(this.x, this.y, 30, 0.4, [0.85, 0.92, 1]);
    if (r === 'wall' || r === 'floor') { g.fx.sparks(this.x + ca * 4, this.y + sa * 4, 6, [[1, 1, 1], [0.7, 0.85, 1]], 2); A.sfx('block'); this.dead = true; return; }
    for (const q of g.projectiles) if (q.destructible && !q.dead && Math.abs(q.x - this.x) < 9 && Math.abs(q.y - this.y) < 9) { q.explode(g); g.fx.sparks(this.x, this.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 2.4); this.dead = true; return; }          // it shoots down a wisp
    for (const e of this.touching(g)) if (this.strike(g, e, this.dmg, '#e8f0ff')) { g.fx.sparks(this.x, this.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 2.6); g.fx.ring(this.x, this.y, 12, [0.9, 0.95, 1], 12, 0.25); this.dead = true; return; }
    for (const o of g.props) if (o.hit && !o.dead && o.box && this.x > o.box.x && this.x < o.box.x + o.box.w && this.y > o.box.y && this.y < o.box.y + o.box.h) { o.hit(g, this.dmg, this.dir); this.dead = true; return; }
  }
  draw(ctx, cx, cy) {
    ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.ang);
    ctx.fillStyle = '#9bb0ff'; ctx.fillRect(-8, -3, 3, 2); ctx.fillRect(-8, 1, 3, 2); ctx.fillStyle = '#d8e2ff'; ctx.fillRect(-6, -1, 2, 2);        // feathers
    ctx.fillStyle = '#e9efff'; ctx.fillRect(-6, -0.5, 10, 1);                                                                                         // shaft
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(3, -2.5); ctx.lineTo(8, 0); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();                  // head
    ctx.restore();
  }
}

// ground fire left by a torch: ignites ground enemies that walk through it
class GroundFlame {
  constructor(x, y, dmg) { this.x = x; this.y = y; this.dmg = dmg; this.life = 170; this.owner = 'player'; this.dead = false; this.t = 0; this.w = 20; this.h = 12; this.vx = 0; this.vy = 0; }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }
  explode() { this.dead = true; }
  update(g) {
    this.t++; if (--this.life <= 0) { this.dead = true; return; }
    g.fx.fire(this.x + rand(-4, 4), this.y, { scale: 0.55 + 0.35 * Math.min(1, this.life / 50), n: 1 }); g.fx.light(this.x, this.y - 6, 50, 0.7);
    if (this.t % 10 === 0) for (const e of g.enemies) if (!e.dead && !e.invuln && Math.abs(e.x - this.x) < this.w / 2 + e.w / 2 && e.y > this.y - 4 && e.y - e.h < this.y + 4 && (e.burnT || 0) < 80) e.ignite(150, this.dmg);
  }
  draw() {}
}

class ThrownTorch extends Thrown {
  constructor(g, x, y, dir, dmg, burn) { super(x, y, dir * 1.8, -3.9, { dmg, burn, w: 8, h: 8, grav: 0.14, life: 160, spin: 0.22 * dir }); }          // (a high lob: up and over, landing about as far as before)
  update(g) {
    const r = this.step(g);
    g.fx.fire(this.x, this.y, { scale: 0.5, n: 1 }); g.fx.light(this.x, this.y, 78, 0.95, [1, 0.72, 0.35]); g.fx.glow(this.x, this.y, 26, [1, 0.6, 0.2], 0.4);          // (its flame lights the air round it as it flies)
    if (r === 'wall' || r === 'floor') {
      const [tx, ty] = this.tileAt() || [0, 0]; if (g.room.get(tx, ty) === TILE.BARRICADE) { g.burnBarricade(tx, ty); this.dead = true; return; }      // wooden barricades go up in flames.  (Ice does not melt for a torch: that takes the Ember spell)
      if (r === 'floor') g.addProjectile(new GroundFlame(this.x, Math.floor((this.y + 4) / T) * T, this.burn)); else g.fx.burst(this.x, this.y, 5, COLORS.fire, { speed: 1.2, s0: 8 });
      A.sfx('fire'); this.dead = true; return;
    }
    for (const e of this.touching(g)) {
      if (this.strike(g, e, this.dmg, '#ff9a40', { fire: true })) { e.ignite(200, this.burn); g.fx.burst(this.x, this.y, 8, COLORS.fire, { speed: 1.6, s0: 10 }); A.sfx('fire'); this.dead = true; return; }
    }
  }
  draw(ctx, cx, cy) { ctx.save(); ctx.translate(Math.round(this.x - cx), Math.round(this.y - cy)); ctx.rotate(this.rot); ctx.fillStyle = '#6a4220'; ctx.fillRect(-1, -2, 2, 8); ctx.fillStyle = '#2a1a0c'; ctx.fillRect(-2, -3, 4, 3); ctx.restore(); }
}

// SAL TERRAE: a handful of salt.  It flies as one, in a low arc, and strikes: the grains (salt.js) bounce, roll and drop off ledges, and WHEREVER they come to lie - on the floor struck, on a plank, on a floor
// below an edge near enough - whatever stands in them is hurt.
class SaltBed {
  constructor(g, dmg, cloud, at) { this.x = at.x; this.y = at.floor !== undefined ? at.floor : at.y; this.dmg = dmg; this.life = 210; this.owner = 'player'; this.dead = false; this.t = 0; this.seen = new Map(); this.cloud = cloud; this.patches = []; g.fx.salt.burst(cloud, this, at); }
  get box() { return { x: -9999, y: -9999, w: 0, h: 0 }; }
  explode() { this.dead = true; }
  update(g) {
    this.t++; if (--this.life <= 0) { this.dead = true; return; }
    if (this.t % 4 === 1) this.patches = g.fx.salt.lies(this.cloud);          // (where it lies now: it may still be rolling)
    saltShine(g, this.patches, [0.95, 0.94, 0.86], Math.min(1, this.life / 40));
    for (const e of g.enemies) {
      if (e.dead || e.invuln) continue;
      const last = this.seen.get(e) ?? -99; if (this.t - last < 24) continue;
      const at = this.patches.find(q => standsIn(q, e.x, e.y, e.w)); if (!at) continue; this.seen.set(e, this.t);
      e.hurt(saltDmg(this.dmg, e), 0, { id: hitId(), color: '#f4f1e6', noKb: true }); saltBites(g, this.cloud, at, e.x);
    }
  }
  draw() {}
}
class SaltThrow extends Thrown {
  constructor(g, x, y, dir, dmg) { super(outOfWall(g, x, y, dir), y, dir * 1.95, -2.05, { dmg, w: 10, h: 8, grav: 0.16, life: 120 }); this.cloud = g.fx.salt.throwSalt(this, saltWorld(g)); }          // (a flatter arc than the old flask's: it rises two thirds as high and lands a little shorter)
  burst(g, at) { this.dead = true; A.sfx('salt'); g.addProjectile(new SaltBed(g, this.dmg, this.cloud, { x: this.x, y: this.y, dir: this.dir, ...at })); }
  update(g) {
    g.fx.light(this.x, this.y, 36, 0.55, [0.95, 0.95, 0.9]);
    const plank = plankUnder(g, this); if (plank !== null) return this.burst(g, { floor: plank });
    const r = this.step(g);
    if (r === 'floor') return this.burst(g, { floor: Math.floor((this.y + this.vy + 2) / T) * T });
    if (r === 'wall') return this.burst(g, { wall: true });          // it strikes the wall and showers down its foot
    for (const e of this.touching(g)) {
      const y = floorUnder(g, e.x, e.y - 4);
      if (y === null || e.y < y - 6) this.strike(g, e, saltDmg(this.dmg, e), '#f4f1e6', { noKb: true });          // (a foe in the air is hit by the handful itself; one on the ground will be standing in it)
      return this.burst(g, {});
    }
  }
  draw() {}
}

// ------------------------------------------------------------------------------------------------ salt (the player's, and the twin's: mirror.js)
// what a grain can strike in this room (see salt.js)
export function saltWorld(g) { const r = g.room; return { solid: (x, y) => r.solid(Math.floor(x / T), Math.floor(y / T)), plank: (x, y) => r.get(Math.floor(x / T), Math.floor(y / T)) === TILE.PLAT, slabs: () => (r.movers ? r.movers.list : []), bottom: r.h * T }; }
// the floor at or under (x, y): stone or planks; null over a bottomless drop
export function floorUnder(g, x, y) {
  const r = g.room, tx = Math.floor(x / T);
  for (let ty = Math.max(0, Math.floor(y / T)); ty < r.h; ty++) if (r.solid(tx, ty) || (r.get(tx, ty) === TILE.PLAT && ty * T >= y - 2)) return ty * T;
  return null;
}
// the hand (12 px ahead of the thrower) may be inside a wall they stand against: then the salt leaves from the thrower, and strikes that wall
export const outOfWall = (g, x, y, dir) => (g.room.solid(Math.floor(x / T), Math.floor(y / T)) ? x - dir * 12 : x);
// a thrown thing about to fall through the top of a plank or of a moving platform: where that top is (null: it is not)
export function plankUnder(g, o) {
  const vy = o.vy + o.grav; if (vy <= 0) return null;
  if (g.room.movers) for (const m of g.room.movers.list) if (m.active && Math.abs(o.x - m.x) <= m.w / 2 && o.y + 2 <= m.y && o.y + vy + 2 >= m.y) return m.y;
  const ty = Math.floor((o.y + vy + 2) / T);
  return g.room.get(Math.floor(o.x / T), ty) === TILE.PLAT && o.y + 2 <= ty * T ? ty * T : null;
}
export const standsIn = (patch, x, y, w) => x + w / 2 > patch.x0 && x - w / 2 < patch.x1 && y >= patch.y - 6 && y <= patch.y + 10;          // (feet in it: what flies over is spared)
const saltDmg = (dmg, e) => Math.round(dmg * (UNDEAD.has(e.name) ? 1.8 : 1));
// the pale light off the salt where it lies
export function saltShine(g, patches, col, k) {
  let best = null; for (const q of patches) { if (q.n >= 16) g.fx.glow((q.x0 + q.x1) / 2, q.y - 3, Math.max(10, (q.x1 - q.x0) * 0.55), col, 0.09 * k); if (!best || q.n > best.n) best = q; }
  if (best) g.fx.light((best.x0 + best.x1) / 2, best.y - 6, 58, 0.62 * k, col);          // (one light a throw: the room has only so many)
}
// something standing in it is hurt: grains jump, a hiss of white
export function saltBites(g, cloud, patch, x) {
  const at = Math.max(patch.x0, Math.min(patch.x1, x));
  g.fx.salt.kick(cloud, patch, at); g.fx.sparks(at, patch.y - 3, 5, [[1, 1, 1], [0.8, 0.85, 0.95]], 1.4, { gy: -0.03 });
  g.fx.smoke(at, patch.y - 2, 2, { c0: [0.82, 0.82, 0.8], c1: [0.5, 0.5, 0.52], s0: 4, s1: 13, a: 0.32, l: 0.6 }); A.sfx('sizzle');
}

// ------------------------------------------------------------------------------------------------ using an item
// Returns false (and tells the player why) when the item can't be used right now; the count is taken when it actually leaves your hand.
export function canUseItem(g, p, id) {
  if (itemCount(g.save, id) <= 0) return false;
  if (id === 'bandage' && g.save.hp >= g.save.maxHp - 0.5) { g.popup(p.x, p.y - 42, 'HP FULL', '#9fe8a8'); A.sfx('back'); return false; }
  return true;
}
// THE POWER OF THE THROWN ITEMS grows with the hero's sword, but only three quarters as fast: when the sword has become twice as strong as it was at the start (power 8), a dagger does three quarters as much again, not twice as much.
// Each number below is what the item does at the starting power; ITEM_SHARE is how much of the sword's growth it takes up.
const START_POWER = 8, ITEM_SHARE = 0.75, itemK = atk => 1 + ITEM_SHARE * (atk / START_POWER - 1);
export function releaseItem(g, p, id) {            // called mid-animation
  const S = g.save; if (itemCount(S, id) <= 0) return; S.items[id]--;
  const atk = p.atkPower, k = itemK(atk), d = p.dir, x = p.x + d * 12, y = p.y - (p.crouch ? 13 : 24);
  switch (id) {
    case 'dagger': g.addProjectile(new Dagger(g, x, y, d, Math.max(2, Math.round(5.6 * k)))); A.sfx('slash'); break;
    case 'torch': g.addProjectile(new ThrownTorch(g, x, y - 2, d, Math.max(1, Math.round(2.6 * k)), Math.max(1, Math.round(1.76 * k)))); A.sfx('cast'); break;
    case 'marrow': g.addProjectile(new MagicArrow(g, x, y, d, Math.max(2, Math.round(5.36 * k)))); A.sfx('cast'); break;
    case 'salt': g.addProjectile(new SaltThrow(g, x, y - 2, d, Math.max(1, Math.round(1.96 * k)))); A.sfx('cast'); break;
    case 'bandage': p.healT = 100; p.healPer = S.maxHp * 0.35 / 100; A.sfx('heal'); g.fx.ring(p.x, p.y - 18, 20, [0.95, 0.95, 0.9], 18, 0.2); g.popup(p.x, p.y - 42, 'PANACEA', '#f2efe6'); break;
  }
  if (S.items[id] <= 0) delete S.items[id];
}
