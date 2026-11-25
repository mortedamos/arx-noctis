// Regular enemies.  Every enemy: x,y = feet centre; flying ones use y = centre + h/2.
import { Entity, moveX, moveY, groundAhead, wallAhead } from './entity.js';
import { drawSheet } from './assets.js';
import { Audio_ as A } from './audio.js';
import { COLORS } from './fx.js';
import { Projectile, FirePatch, HomingWisp, IceShard, SkyBolt } from './projectiles.js';
import { randomDrop, rollEnchantDrop } from './props.js';
import { TUNE } from './enchant.js';
import { T, clamp, rand, dist, approach, sign, TAU, overlap } from './util.js';
import { GRAV } from './player.js';

export class Enemy extends Entity {
  constructor(g, x, y, w, h, o = {}) {
    super(x, y, w, h); this.g = g; this.hp = this.maxHp = 10; this.dmg = 8; this.xp = 5; this.flashT = 0; this.kbRes = 0; this.invuln = false; this.harmless = false; this.alpha = 1;
    this.gravity = true; this.isBoss = false; this.lastHit = 0; this.gold = 0; this.o = o; this.hurtT = 0; this.name = 'enemy'; this.scale = 1; this.deathFx = COLORS.red;
    this.burnT = 0; this.burnDmg = 0; this.slowT = 0;                                  // thrown torches set things ablaze (slowT: slowed, kept for effects that slow)
    this.freezeT = 0; this.freezeImmune = 0; this.freezeImmuneAfter = 180;      // Frost enchant: frozen timer, and the grace period after thawing
  }
  // FROST: turn to ice for `frames`.  Ignored while already frozen, during the post-thaw immunity, or when invulnerable.
  freeze(frames, immuneAfter) {
    if (this.dead || this.invuln || this.freezeT > 0 || this.freezeImmune > 0 || (this.isBoss && (!this.active || this.dying))) return false;
    const g = this.g; this.freezeT = Math.round(frames); this.freezeImmuneAfter = immuneAfter; this.warns = null; this.intent = null; this._tellKind = null; this.vx = 0;
    g.fx.burst(this.x, this.cy, 16, COLORS.ice, { speed: 2.2, s0: 12 }); g.fx.ring(this.x, this.cy, 34, [0.6, 0.85, 1], 18, 0.2); g.fx.sparks(this.x, this.cy, 10, [[1, 1, 1], [0.5, 0.8, 1]], 2.6);
    A.sfx('freeze'); g.popup(this.x, this.y - this.h - 6, 'FROZEN', '#9fe8ff'); return true;
  }
  // burning: damage over time while burnT runs (a re-ignite only refreshes the timer, it never stacks)
  ignite(frames, dmg) { if (this.dead || this.invuln || (this.harmless && !this.isBoss)) return false; this.burnT = Math.max(this.burnT, frames); this.burnDmg = Math.max(this.burnDmg, dmg); return true; }
  tickStatus() {
    if (this.slowT > 0) this.slowT--;
    if (this.burnT > 0) {
      this.burnT--; const g = this.g;
      if (this.t % 4 === 0) g.fx.fire(this.x + rand(-5, 5), this.cy + this.h * 0.25, { scale: 0.5, n: 1 });
      if (this.burnT % 24 === 0 && !this.dead) { this.hurt(this.burnDmg, 0, { id: -Math.floor(Math.random() * 1e9) - 1e6, noKb: true, color: '#ff9a40' }); }
      if (this.burnT === 0) this.burnDmg = 0;
    }
  }
  freezeTick() {
    this.freezeT--; this.vx = 0; if (!this.gravity) this.vy = 0; this.physics();
    if (this.freezeT % 10 === 0) this.g.fx.emit({ x: this.x + (Math.random() - 0.5) * this.w, y: this.y - Math.random() * this.h, vx: 0, vy: -0.2, life: 24, s0: 5, s1: 1, c0: [0.85, 0.97, 1], a0: 1, a1: 0, kind: 6 });
    if (this.freezeT <= 0) this.thaw();
  }
  thaw() {
    this.freezeImmune = this.freezeImmuneAfter; const g = this.g;
    g.fx.burst(this.x, this.cy, 14, COLORS.ice, { speed: 2.6, s0: 10 }); g.fx.sparks(this.x, this.cy, 14, [[1, 1, 1], [0.5, 0.8, 1]], 3.2, { gy: 0.15 }); A.sfx('break');
  }
  get hurtbox() { return this.box; }
  hitBy(box) { return overlap(box, this.hurtbox); }       // player attacks call this (multi-part enemies override it)
  dx() { return this.g.player.x - this.x; }
  face() { this.dir = this.g.player.x >= this.x ? 1 : -1; }
  hurt(dmg, dir, opts = {}) {
    if (this.invuln || this.dead) return false;
    const g = this.g; if (opts.id && this.lastHit === opts.id) return false; if (opts.id) this.lastHit = opts.id;
    if (this.freezeT > 0) { dmg = Math.round(dmg * TUNE.frozenBonus); opts = { ...opts, noKb: true }; }     // frozen foes are brittle and don't budge
    dmg = this.modifyDamage(dmg, dir, opts);
    this.hp -= dmg; this.flashT = 6; this.hurtT = 8;
    if (!opts.noKb && this.kbRes < 1) { this.vx += dir * (opts.kb === undefined ? 1.6 : opts.kb) * (1 - this.kbRes); if (this.gravity && this.onGround && !this.heavy) this.vy = -1.2 * (1 - this.kbRes); }
    g.popup(this.x, this.y - this.h - 4, dmg, opts.color || '#fff'); g.fx.sparks(this.x, this.cy, 6, COLORS.gold, 2.4, { dir: dir > 0 ? 0 : Math.PI, spread: 1.1 }); A.sfx('hit'); this.onHurt(dmg, dir, opts);
    if (this.hp <= 0) this.die(); return true;
  }
  modifyDamage(d) { return Math.max(1, Math.round(d)); }
  onHurt() {}
  die() {
    if (this.dead) return; this.dead = true; const g = this.g; g.kills++; if (g.noteKill) g.noteKill(this); g.player.gainXp(this.xp); A.sfx(killSfx(this));
    g.fx.burst(this.x, this.cy, 14, this.deathFx, { speed: 2.4, s0: 14, s1: 2 }); g.fx.souls(this.x, this.cy, 4, COLORS.blue);
    if (!this.isBoss) { randomDrop(g, this.x, this.cy); rollEnchantDrop(g, this); }
    this.onDeath();
  }
  onDeath() {}
  touch() { // contact damage
    const p = this.g.player; if (this.harmless || this.dead) return;
    if (overlap(this.hurtbox, p.hurtbox)) p.hurt(this.dmg, this.x);
  }
  physics() {
    if (this.gravity) this.vy = Math.min(this.vy + GRAV, 6);
    const sv = this.vx; if (this.slowT > 0) this.vx *= 0.6;                                // slowed: half the ground covered per step
    moveX(this, this.g.room); if (this.slowT > 0 && this.vx !== 0) this.vx = sv; moveY(this, this.g.room); if (this.flashT > 0) this.flashT--; if (this.hurtT > 0) this.hurtT--;
  }
  update() {
    if (this.freezeT > 0) { this.freezeTick(); return; }            // frozen: AI, animation and contact damage all stop
    if (this.freezeImmune > 0) this.freezeImmune--;
    this.t++; this.tickStatus(); if (this.dead) return; this.ai(this.g); this.physics(); this.touch();
  }
  ai() {}
  spr(ctx, id, f, cx, cy, o = {}) { drawSheet(ctx, id, f, this.x - cx, this.y - cy, { dir: this.dir, flash: this.flashT > 0, alpha: this.alpha < 1 ? this.alpha : undefined, scale: this.scale, ...o }); }
  draw() {}
}

// ------------------------------------------------------------------------------------------------ BAT
class Bat extends Enemy {
  constructor(g, x, y, o) {
    super(g, x, y + 6, 14, 12, o); this.hp = this.maxHp = 3; this.dmg = 5; this.xp = 4; this.gravity = false; this.kbRes = 0.3; this.deathFx = COLORS.purple;
    const tx = Math.floor(x / T), ty = Math.floor((y - 8) / T); this.state = g.room.solid(tx, ty - 1) || g.room.solid(tx, ty) ? 'hang' : 'fly'; if (this.state === 'hang') { this.y = Math.floor(y / T) * T + 14 + 6; this.hang = this.y; } this.phase = rand(TAU); this.name = 'bat';
  }
  ai(g) {
    const p = g.player, room = g.room;
    if (this.state === 'hang') { this.harmless = true; if (Math.abs(this.dx()) < 90 && Math.abs(p.y - this.y) < 130) { this.state = 'fly'; this.harmless = false; this.vy = 1; A.sfx('flap'); } return; }
    this.face();
    const tx = p.x, ty = p.y - 22 + Math.sin(this.t * 0.07 + this.phase) * 26;
    this.vx += sign(tx - this.x) * 0.045; this.vy += clamp((ty - this.cy) * 0.012, -0.08, 0.08); this.vx = clamp(this.vx * 0.99, -1.5, 1.5); this.vy = clamp(this.vy, -1.3, 1.3);
    if (this.t % 18 === 0) A.sfx('flap');
    // collide softly with tiles
    const nx = this.x + this.vx, ny = this.cy + this.vy;
    if (room.solid(Math.floor(nx / T), Math.floor(this.cy / T))) this.vx *= -0.8;
    if (room.solid(Math.floor(this.x / T), Math.floor(ny / T))) this.vy *= -0.8;
  }
  physics() { this.x += this.vx; this.y += this.vy; if (this.flashT > 0) this.flashT--; }
  draw(ctx, cx, cy) {
    if (this.state === 'hang') drawSheet(ctx, 'bat', 4, this.x - cx, this.y - 7 - cy, { flipY: true, flash: this.flashT > 0, ay: 0.5 });
    else drawSheet(ctx, 'bat', Math.floor(this.t / 5) % 4, this.x - cx, this.cy - cy, { flash: this.flashT > 0, ay: 0.5 });
  }
}

// ------------------------------------------------------------------------------------------------ ZOMBIE
const ZOMBIE_RISE = 117;          // (px: how near the hero comes, side to side, before a buried one starts to climb out.  Was 78; raised by half on request, so they do not wait till he is on top of them)
export class Zombie extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 14, 32, o); this.hp = this.maxHp = 14; this.dmg = 8; this.xp = 8; this.state = 'buried'; this.harmless = true; this.invuln = true; this.kbRes = 0.4; this.speed = 0.38 + rand(0.1); this.name = 'zombie'; }
  ai(g) {
    const p = g.player;
    if (this.state === 'buried') { if (Math.abs(this.dx()) < ZOMBIE_RISE && Math.abs(p.y - this.y) < 50) { this.state = 'rise'; this.t = 0; this.face(); A.sfx('break'); g.fx.burst(this.x, this.y - 2, 10, [[0.45, 0.35, 0.25], [0.2, 0.15, 0.1]], { speed: 1.4, s0: 9, s1: 2, up: 0.8 }); } return; }
    if (this.state === 'rise') { if (this.t > 46) { this.state = 'walk'; this.harmless = false; this.invuln = false; } return; }
    this.face(); if (Math.abs(this.dx()) > 6 && groundAhead(this, g.room, 6) && !wallAhead(this, g.room, 3)) this.vx = approach(this.vx, this.dir * this.speed, 0.05); else this.vx = approach(this.vx, 0, 0.1);
  }
  draw(ctx, cx, cy) {
    if (this.state === 'buried') return;
    if (this.state === 'rise') this.spr(ctx, 'zombie_rise_g', Math.min(5, Math.floor(this.t / 7.7)), cx, cy);
    else this.spr(ctx, 'zombie_g', Math.floor(this.t / 9) % 8, cx, cy);
  }
}

// ------------------------------------------------------------------------------------------------ SKELETON
class Skeleton extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 14, 34, o); this.hp = this.maxHp = 10; this.dmg = 7; this.xp = 7; this.cool = 60 + rand(60); this.wind = 0; this.dir = Math.random() < 0.5 ? -1 : 1; this.name = 'skeleton'; this.deathFx = COLORS.white; }
  ai(g) {
    const p = g.player;
    if (this.wind > 0) { this.wind--; this.vx = 0; if (this.wind === 0) { A.sfx('bone'); g.addProjectile(Object.assign(new Projectile(this.x + this.dir * 8, this.y - 28, this.dir * 1.5, -3.1, 'bone'), { owner: 'enemy' })); } return; }
    const near = Math.abs(this.dx()) < 140 && Math.abs(p.y - this.y) < 44;
    if (near) this.dir = this.dx() > 0 ? 1 : -1;
    if (near && --this.cool <= 0) { this.wind = 16; this.cool = 110 + rand(50); this.vx = 0; return; }
    if (!near || Math.abs(this.dx()) > 70) { if (!groundAhead(this, g.room, 6) || wallAhead(this, g.room, 3)) this.dir *= -1; this.vx = approach(this.vx, this.dir * 0.5, 0.06); } else this.vx = approach(this.vx, -this.dir * 0.35, 0.06);   // keeps its distance
  }
  draw(ctx, cx, cy) { this.spr(ctx, 'skeleton_w', this.wind > 0 ? 0 : Math.floor(this.t / 8) % 8, cx, cy); }
}

// ------------------------------------------------------------------------------------------------ GHOST (phasing)
class Ghost extends Enemy {
  constructor(g, x, y, o) { super(g, x, y + 14, 18, 28, o); this.hp = this.maxHp = 14; this.dmg = 8; this.xp = 12; this.gravity = false; this.state = 'drift'; this.st = 0; this.phase = rand(TAU); this.timer = 180 + rand(120); this.kbRes = 0.4; this.name = 'ghost'; this.deathFx = COLORS.blue; this.sheet = o.green ? 'ghostg' : 'ghost'; }
  ai(g) {
    const p = g.player; this.st++;
    if (this.state === 'drift') {
      this.face(); const tx = p.x, ty = p.y - 28 + Math.sin(this.t * 0.04 + this.phase) * 14;
      this.vx = approach(this.vx, sign(tx - this.x) * 0.55, 0.02); this.vy = approach(this.vy, clamp((ty - this.cy) * 0.03, -0.5, 0.5), 0.02);
      if (--this.timer <= 0) { this.state = 'vanish'; this.st = 0; A.sfx('ghost'); }
    } else if (this.state === 'vanish') {
      this.invuln = true; this.harmless = true; this.vx *= 0.9; this.vy *= 0.9; this.alpha = Math.max(0.12, 1 - this.st / 30);
      if (this.st === 44) { const side = Math.random() < 0.5 ? -1 : 1; this.x = clamp(p.x + side * rand(60, 90), 24, g.room.pw - 24); this.y = clamp(p.y - rand(10, 40), 40, g.room.ph - 20) + this.h / 2; this.vx = this.vy = 0; this.face(); g.fx.burst(this.x, this.cy, 8, COLORS.blue, { speed: 1 }); }
      if (this.st > 50) { this.state = 'appear'; this.st = 0; }
    } else if (this.state === 'appear') {
      this.alpha = Math.min(1, 0.12 + this.st / 30); this.face(); if (this.st > 30) { this.state = 'shriek'; this.st = 0; this.harmless = false; this.invuln = false; A.sfx('shriek'); }
    } else if (this.state === 'shriek') {
      this.vx = this.vy = 0; if (this.st === 10) { g.fx.ring(this.x, this.cy, 56, COLORS.blue[0], 26, 0.14); if (dist(this.x, this.cy, p.x, p.y - 16) < 56) p.hurt(6, this.x); }
      if (this.st > 36) { this.state = 'drift'; this.timer = 220 + rand(120); }
    }
    g.fx.glow(this.x, this.cy, 20, [0.4, 0.7, 1], 0.28 * this.alpha); g.fx.light(this.x, this.cy, 34, 0.35 * this.alpha, [0.4, 0.7, 1]);
  }
  physics() { this.x += this.vx; this.y += this.vy; if (this.flashT > 0) this.flashT--; if (this.hurtT > 0) this.hurtT--; }   // passes through walls
  draw(ctx, cx, cy) {
    const s = this.sheet; let id = s + '_idle', f = Math.floor(this.t / 8) % 7;
    if (this.state === 'vanish') { id = s + '_vanish'; f = Math.min(6, Math.floor(this.st / 7)); }
    else if (this.state === 'appear') { id = s + '_appear'; f = Math.min(5, Math.floor(this.st / 5)); }
    else if (this.state === 'shriek') { id = s + '_shriek'; f = Math.min(3, Math.floor(this.st / 9)); }
    drawSheet(ctx, id, f, this.x - cx, this.cy - cy, { dir: this.dir, flash: this.flashT > 0, alpha: this.state === 'vanish' ? undefined : (this.alpha < 1 ? this.alpha : 0.92), ay: id.endsWith('idle') || id.endsWith('shriek') ? 0.6 : undefined });
  }
}

// ------------------------------------------------------------------------------------------------ WRAITH (lantern bearer, shoots wisps)
class Wraith extends Enemy {
  constructor(g, x, y, o) { super(g, x, y + 16, 16, 34, o); this.hp = this.maxHp = 16; this.dmg = 7; this.xp = 12; this.gravity = false; this.cool = 90 + rand(80); this.phase = rand(TAU); this.name = 'wraith'; this.deathFx = COLORS.green; this.kbRes = 0.3; }
  ai(g) {
    const p = g.player; this.face(); const d = Math.abs(this.dx());
    const ty = p.y - 44 + Math.sin(this.t * 0.03 + this.phase) * 20;
    this.vx = approach(this.vx, d > 90 ? this.dir * 0.4 : d < 60 ? -this.dir * 0.3 : 0, 0.02); this.vy = approach(this.vy, clamp((ty - this.cy) * 0.02, -0.4, 0.4), 0.02);
    if (--this.cool <= 0 && d < 190) { this.cool = 150; A.sfx('cast'); const a = Math.atan2(p.y - 18 - (this.y - 22), p.x - this.x); g.addProjectile(new Projectile(this.x + this.dir * 10, this.y - 22, Math.cos(a) * 1.25, Math.sin(a) * 1.25, 'orb', { dmg: 8, life: 260 })); g.fx.glow(this.x + this.dir * 10, this.y - 22, 26, [0.7, 0.4, 1], 0.9, 6); }
    g.fx.glow(this.x - this.dir * 8, this.y - 22, 16, [1, 0.5, 0.25], 0.4); g.fx.light(this.x, this.y - 22, 40, 0.5);
  }
  physics() { const room = this.g.room, nx = this.x + this.vx, ny = this.y + this.vy; if (!room.solid(Math.floor(nx / T), Math.floor(this.cy / T))) this.x = nx; else this.vx = 0; if (!room.solid(Math.floor(this.x / T), Math.floor((ny - this.h) / T)) && !room.solid(Math.floor(this.x / T), Math.floor(ny / T))) this.y = ny; else this.vy = 0; if (this.flashT > 0) this.flashT--; }
  draw(ctx, cx, cy) { this.spr(ctx, 'wraith', Math.floor(this.t / 10) % 4, cx, cy + Math.sin(this.t * 0.1) * 1.5, { alpha: 0.95 }); }
}

// ------------------------------------------------------------------------------------------------ FIRE SKULL
class FireSkull extends Enemy {
  constructor(g, x, y, o) { super(g, x, y + 10, 18, 20, o); this.hp = this.maxHp = 6; this.dmg = 10; this.xp = 8; this.gravity = false; this.state = 'float'; this.st = 0; this.ox = x; this.oy = y; this.phase = rand(TAU); this.scale = 0.5; this.name = 'fireskull'; this.deathFx = COLORS.fire; this.kbRes = 0.2; }
  ai(g) {
    const p = g.player; this.st++;
    if (this.state === 'float') {
      this.vx = approach(this.vx, Math.cos(this.t * 0.03 + this.phase) * 0.4, 0.03); this.vy = approach(this.vy, Math.sin(this.t * 0.05 + this.phase) * 0.35, 0.03);
      if (dist(this.x, this.cy, p.x, p.y - 16) < 150 && this.st > 40) { this.state = 'wind'; this.st = 0; A.sfx('fire'); this.face(); }
    } else if (this.state === 'wind') { this.vx = this.vy = 0; this.face(); g.fx.glow(this.x, this.cy, 30, [1, 0.5, 0.1], 0.7); if (this.st > 26) { this.state = 'charge'; this.st = 0; const a = Math.atan2(p.y - 16 - this.cy, p.x - this.x); this.vx = Math.cos(a) * 2.5; this.vy = Math.sin(a) * 2.5; this.dir = this.vx >= 0 ? 1 : -1; A.sfx('fireball'); } }
    else if (this.state === 'charge') { g.fx.fire(this.x, this.cy + 6, { scale: 0.7, n: 1 }); if (this.st > 55 || this.hitX || this.hitCeil) { this.state = 'float'; this.st = 0; this.vx *= 0.2; this.vy *= 0.2; } }
    if (this.state !== 'charge') g.fx.fire(this.x, this.cy + 6, { scale: 0.5, n: 1 });
    g.fx.light(this.x, this.cy, 44, 0.7);
  }
  physics() { const room = this.g.room, nx = this.x + this.vx, ny = this.y + this.vy; this.hitX = 0; this.hitCeil = false; if (room.solid(Math.floor(nx / T), Math.floor(this.cy / T))) { this.hitX = 1; this.vx = 0; } else this.x = nx; if (room.solid(Math.floor(this.x / T), Math.floor((ny - this.h / 2) / T))) { this.hitCeil = true; this.vy = 0; } else this.y = ny; if (this.flashT > 0) this.flashT--; }
  draw(ctx, cx, cy) { drawSheet(ctx, 'fireskull', Math.floor(this.t / 6) % 8, this.x - cx, this.cy - cy + 3, { dir: this.vx > 0.2 ? 1 : this.vx < -0.2 ? -1 : this.dir, flash: this.flashT > 0, scale: 0.5, ay: 0.55 }); }
}

// ------------------------------------------------------------------------------------------------ HELL HOUND
export class Hound extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 28, 20, o); this.hp = this.maxHp = 18; this.dmg = 10; this.xp = 12; this.state = 'patrol'; this.st = 0; this.cool = 0; this.dir = Math.random() < 0.5 ? -1 : 1; this.sheet = o.frost ? 'houndb' : 'hound'; this.name = 'hound'; this.kbRes = 0.4; }
  ai(g) {
    const p = g.player, d = Math.abs(this.dx()), same = Math.abs(p.y - this.y) < 34; this.st++; if (this.cool > 0) this.cool--;
    if (this.state === 'patrol') {
      if (!groundAhead(this, g.room, 6) || wallAhead(this, g.room, 3)) this.dir *= -1; this.vx = approach(this.vx, this.dir * 0.45, 0.05);
      if (same && d < 170 && this.cool === 0) { this.state = 'run'; this.st = 0; A.sfx('roar'); }
    } else if (this.state === 'run') {
      this.face(); this.vx = approach(this.vx, this.dir * 2.1, 0.12); if (!groundAhead(this, g.room, 12) && this.onGround) { this.vx = 0; this.state = 'patrol'; this.cool = 60; }
      if (d < 54 && this.onGround) { this.state = 'leap'; this.st = 0; this.vy = -3.6; this.vx = this.dir * 2.6; }
      if (this.st > 150) { this.state = 'patrol'; this.cool = 80; }
    } else if (this.state === 'leap') { if (this.onGround && this.st > 6) { this.state = 'rec'; this.st = 0; this.vx = 0; } }
    else if (this.state === 'rec') { this.vx = approach(this.vx, 0, 0.2); if (this.st > 34) { this.state = 'patrol'; this.cool = 50; } }
  }
  draw(ctx, cx, cy) {
    let id = this.sheet + '_walk', f = Math.floor(this.t / 5) % 12;
    if (this.state === 'run') { id = this.sheet + '_run'; f = Math.floor(this.t / 4) % 5; } else if (this.state === 'leap') { id = this.sheet + '_jump'; f = this.vy < -1.5 ? 1 : this.vy < 0.5 ? 2 : 4; } else if (this.state === 'rec') { id = this.sheet + '_idle'; f = Math.floor(this.t / 6) % 6; }
    this.spr(ctx, id, f, cx, cy + 1);
  }
}

// ------------------------------------------------------------------------------------------------ BURNING GHOUL
class Ghoul extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 16, 36, o); this.hp = this.maxHp = 24; this.dmg = 10; this.xp = 16; this.fcool = 70; this.name = 'ghoul'; this.deathFx = COLORS.fire; this.kbRes = 0.5; }
  ai(g) {
    this.face(); const d = Math.abs(this.dx());
    if (d > 10 && groundAhead(this, g.room, 6) && !wallAhead(this, g.room, 3) && d < 280) this.vx = approach(this.vx, this.dir * 0.58, 0.05); else this.vx = approach(this.vx, 0, 0.1);
    g.fx.fire(this.x - this.dir * 3, this.y - 32, { scale: 0.85, n: 2 }); g.fx.light(this.x, this.y - 30, 56, 0.8);
    if (--this.fcool <= 0 && this.onGround) { this.fcool = 85; g.addProjectile(new FirePatch(this.x, this.y, 150, { dmg: 6 })); }
  }
  draw(ctx, cx, cy) { this.spr(ctx, 'ghoul_burning', Math.floor(this.t / 6) % 8, cx, cy); }
}

// ------------------------------------------------------------------------------------------------ DARK WIZARD
export class Wizard extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 14, 34, o); this.hp = this.maxHp = 18; this.dmg = 6; this.xp = 16; this.state = 'idle'; this.st = 0; this.cool = 80 + rand(60); this.name = 'wizard'; this.deathFx = COLORS.purple; this.kbRes = 0.6; this.sheet = 'wizard'; }
  ai(g) {
    const p = g.player, d = Math.abs(this.dx()); this.st++; this.vx = approach(this.vx, 0, 0.2);
    if (this.state === 'idle') {
      this.face();
      if (d < 56 && this.st > 20) { this.state = 'fade'; this.st = 0; A.sfx('ghost'); }
      else if (--this.cool <= 0 && d < 230 && Math.abs(p.y - this.y) < 90) { this.state = 'cast'; this.st = 0; A.sfx('cast'); }
    } else if (this.state === 'cast') {
      this.face(); if (this.st === 30) { const a = Math.atan2(p.y - 20 - (this.y - 28), p.x - (this.x + this.dir * 14)); const sp = this.shotSpd || 1.9; g.addProjectile(new Projectile(this.x + this.dir * 14, this.y - 28, Math.cos(a) * sp, Math.sin(a) * sp, this.shot || 'fire', { dmg: this.shotDmg || 10, life: 220 })); A.sfx('fireball'); g.fx.burst(this.x + this.dir * 14, this.y - 28, 8, COLORS.fire, { speed: 1.5 }); }
      if (this.st > 52) { this.state = 'idle'; this.st = 0; this.cool = 120 + rand(60); }
    } else if (this.state === 'fade') {
      this.invuln = true; this.harmless = true; this.alpha = Math.max(0, 1 - this.st / 20);
      if (this.st === 24) { // reappear on a floor tile 5-8 tiles away
        for (let tries = 0; tries < 12; tries++) { const nx = this.x + (Math.random() < 0.5 ? -1 : 1) * rand(80, 140), tx = Math.floor(nx / T), ty = Math.floor((this.y + 4) / T); if (nx > 20 && nx < g.room.pw - 20 && g.room.solid(tx, ty) && !g.room.solid(tx, ty - 1) && !g.room.solid(tx, ty - 2)) { this.x = nx; break; } }
        g.fx.burst(this.x, this.y - 18, 10, COLORS.purple, { speed: 1.2 });
      }
      if (this.st > 24) this.alpha = Math.min(1, (this.st - 24) / 16);
      if (this.st > 40) { this.state = 'idle'; this.st = 0; this.invuln = false; this.harmless = false; this.alpha = 1; this.cool = 50; }
    }
  }
  draw(ctx, cx, cy) {
    if (this.state === 'cast') this.spr(ctx, 'wizard_cast', Math.min(9, Math.floor(this.st / 5.2)), cx, cy); else this.spr(ctx, 'wizard_idle', Math.floor(this.t / 10) % 5, cx, cy);
    if (this.alpha > 0.3) this.g.fx.glow(this.x + this.dir * 12, this.y - 28, 12, [1, 0.55, 0.15], 0.35 * this.alpha);
  }
}

// ------------------------------------------------------------------------------------------------ WYRM ("Cyber-tooth" by Emcee Flesher)
// A skull-headed serpent.  The head flies at a steady speed with a limited turn rate; the vertebrae and tail are laid along the path the
// head has flown, so the whole body follows every curve.  It weaves above the hero, then telegraphs (jaws gape, aim line, glowing mouth)
// and strikes where the hero WAS.  Hits on the head do full damage, hits on the armoured body 60%.  The ember kind spits fireballs.
const WY = { scale: 0.7, segs: 5, gap: 14, cruise: 0.95 };
const angDiff = (a, b) => ((b - a + 3 * Math.PI) % TAU) - Math.PI;
const turnTo = (a, b, r) => a + clamp(angDiff(a, b), -r, r);
const rot16 = a => ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;

class Wyrm extends Enemy {
  constructor(g, x, y, o) {
    super(g, x, y + 9, 22, 18, o); this.hp = this.maxHp = 22; this.dmg = 11; this.xp = 18; this.gravity = false; this.kbRes = 1; this.name = this.key; this.deathFx = this.fx;
    this.sheet = 'ct_' + this.variant; this.ang = Math.random() < 0.5 ? 0 : Math.PI; this.phase = rand(TAU); this.state = 'weave'; this.st = 0; this.cool = 50 + rand(60);
    this.spd = WY.cruise; this.kx = 0; this.ky = 0; this.home = { x, y }; this.body = false; this.blocked = false; this.dir = this.ang === 0 ? 1 : -1;
    this.trail = []; this.parts = Array.from({ length: WY.segs + 1 }, () => ({ x, y }));
    this.fast = 1; if (this.variant === 'bone') { this.hp = this.maxHp = 38; this.fast = 1.4; this.xp = 24; }          // the bone wyrm is quicker and tougher than its frost and ember cousins
  }
  begin(state) { this.state = state; this.st = 0; }
  free(room, x, y) {      // is a 14x14 box centred here clear of walls (and above the bottom of the room)?
    if (y > room.ph - 14) return false;
    return !(room.solid(Math.floor((x - 7) / T), Math.floor((y - 7) / T)) || room.solid(Math.floor((x + 7) / T), Math.floor((y - 7) / T)) || room.solid(Math.floor((x - 7) / T), Math.floor((y + 7) / T)) || room.solid(Math.floor((x + 7) / T), Math.floor((y + 7) / T)));
  }
  sees(px, py) {          // clear line from the head to a point?
    const room = this.g.room, n = Math.ceil(dist(this.x, this.cy, px, py) / 8);
    for (let i = 1; i < n; i++) { const f = i / n; if (room.solid(Math.floor((this.x + (px - this.x) * f) / T), Math.floor((this.cy + (py - this.cy) * f) / T))) return false; }
    return true;
  }
  steer(room, want) {     // feel ahead; if a wall is coming, turn toward the nearest open heading (preferring the side the target is on)
    const L = 20; if (this.free(room, this.x + Math.cos(this.ang) * L, this.cy + Math.sin(this.ang) * L)) return;
    const s = angDiff(this.ang, want) >= 0 ? 1 : -1;
    for (const off of [0.35, 0.7, 1.05, 1.5, 2.2]) for (const sg of [s, -s]) {
      const a = this.ang + off * sg; if (this.free(room, this.x + Math.cos(a) * L, this.cy + Math.sin(a) * L)) { this.ang = turnTo(this.ang, a, 0.14); return; }
    }
    this.ang = turnTo(this.ang, this.ang + Math.PI, 0.14);
  }
  ai(g) {
    const p = g.player, room = g.room, px = p.x, py = p.y - 18, d = dist(this.x, this.cy, px, py), hunting = d < 250; this.st++; if (this.cool > 0) this.cool--;
    let want = this.ang, spd = WY.cruise, rate = 0.055;
    if (this.state === 'weave') {           // loop high above the hero (or lazily around its lair while nobody is near)
      const bx = hunting ? px : this.home.x, by = hunting ? py - 44 : this.home.y;
      const tx = bx + Math.sin(this.t * 0.021 + this.phase) * 100, ty = by + Math.sin(this.t * 0.043 + this.phase * 1.7) * 22;
      want = Math.atan2(ty - this.cy, tx - this.x); spd = hunting && d > 140 ? 1.25 : WY.cruise;
      if (hunting && this.cool === 0 && d < 150 && Math.abs(py - this.cy) < 110 && this.sees(px, py)) { this.begin('wind'); A.sfx('roar'); this.dir = px >= this.x ? 1 : -1; }
    } else if (this.state === 'wind') {     // TELL: stops, turns to face the hero, jaws gape and the mouth glows - then the strike
      spd = 0; want = Math.atan2(py - this.cy, px - this.x); rate = this.st < 30 ? 0.12 : 0.02; this.dir = Math.cos(this.ang) >= 0 ? 1 : -1;
      const mx = this.x + Math.cos(this.ang) * 10, my = this.cy + Math.sin(this.ang) * 10, k = this.st / 40;
      g.fx.glow(mx, my, 10 + 14 * k, this.glowC, 0.25 + 0.55 * k); if (this.st === 28) A.sfx('tell');
      if (this.st >= 42) {
        if (this.spits && Math.random() < 0.55) { const a = Math.atan2(py - my, px - mx); A.sfx('fireball'); g.addProjectile(new Projectile(mx, my, Math.cos(a) * 1.7, Math.sin(a) * 1.7, 'fire', { dmg: 9, life: 220 })); g.fx.burst(mx, my, 8, COLORS.fire, { speed: 1.5 }); this.begin('rec'); this.cool = 120 + rand(60); }
        else { this.begin('lunge'); A.sfx('slash'); }
      }
    } else if (this.state === 'lunge') {
      spd = 3.3; rate = 0; g.fx.glow(this.x, this.cy, 16, this.glowC, 0.4);
      if (this.st > 26 || this.blocked) { this.begin('rec'); this.cool = 110 + rand(70); }
    } else if (this.state === 'rec') {      // winded: slow, and a good moment to strike back
      spd = 0.45 + Math.min(0.5, this.st * 0.012); if (this.st > 44) this.begin('weave');
    }
    this.ang = turnTo(this.ang, want, rate); if (this.state !== 'lunge') this.steer(room, want);
    if (this.state !== 'wind') this.dir = Math.cos(this.ang) >= 0 ? 1 : -1;
    this.spd = approach(this.spd, spd * this.fast, this.state === 'wind' ? 0.08 : 0.06);
    g.fx.light(this.x, this.cy, 30, 0.3);
  }
  physics() {
    if (this.flashT > 0) this.flashT--; if (this.hurtT > 0) this.hurtT--; if (this.freezeT > 0) return;
    const room = this.g.room, vx = Math.cos(this.ang) * this.spd + this.kx, vy = Math.sin(this.ang) * this.spd + this.ky; this.kx *= 0.86; this.ky *= 0.86; this.blocked = false;
    if (this.free(room, this.x + vx, this.cy)) this.x += vx; else this.blocked = true;
    if (this.free(room, this.x, this.cy + vy)) this.y += vy; else this.blocked = true;
    this.vx = vx; this.vy = vy;
    const last = this.trail[0]; if (!last || (this.x - last.x) ** 2 + (this.cy - last.y) ** 2 > 1) { this.trail.unshift({ x: this.x, y: this.cy }); if (this.trail.length > 260) this.trail.length = 260; }
    this.layout();
  }
  layout() {              // park each body part at its distance along the head's path
    const P = this.parts; let k = 0, acc = 0, ax = this.x, ay = this.cy;
    for (const q of this.trail) {
      const seg = Math.hypot(q.x - ax, q.y - ay);
      while (k < P.length && acc + seg >= WY.gap * (k + 1)) { const f = (WY.gap * (k + 1) - acc) / (seg || 1); P[k].x = ax + (q.x - ax) * f; P[k].y = ay + (q.y - ay) * f; k++; }
      acc += seg; ax = q.x; ay = q.y; if (k >= P.length) break;
    }
    for (; k < P.length; k++) { P[k].x = ax; P[k].y = ay; }
  }
  hitBy(box) {            // any part can be struck; the head hurts most
    if (overlap(box, this.hurtbox)) { this.body = false; return true; }
    for (const q of this.parts) if (overlap(box, { x: q.x - 7, y: q.y - 7, w: 14, h: 14 })) { this.body = true; return true; }
    return false;
  }
  modifyDamage(d) { const b = this.body; this.body = false; return Math.max(1, Math.round(b ? d * 0.6 : d)); }
  onHurt(dmg, dir) { this.kx += dir * 1.3; if (this.state === 'wind' && this.st < 34) { this.begin('rec'); this.cool = 80; } }   // a clean hit while it winds up breaks the attack
  touch() {
    const p = this.g.player; if (this.harmless || this.dead) return; const pb = p.hurtbox;
    if (overlap(this.hurtbox, pb)) { p.hurt(this.dmg, this.x); return; }
    for (const q of this.parts) if (overlap({ x: q.x - 6, y: q.y - 6, w: 12, h: 12 }, pb)) { p.hurt(Math.max(4, Math.round(this.dmg * 0.55)), q.x); return; }
  }
  onDeath() { const g = this.g; for (const q of this.parts) { g.fx.burst(q.x, q.y, 8, this.deathFx, { speed: 2, s0: 11, s1: 2 }); g.fx.sparks(q.x, q.y, 5, this.deathFx, 2.6); } g.shake(2, 8); A.sfx('boom'); }
  draw(ctx, cx, cy) {
    const id = this.sheet, sh = this.variant === 'bone' ? 0 : Math.floor(this.t / 6) % 5, P = this.parts, n = WY.segs, o = { flash: this.flashT > 0, scale: WY.scale, ay: 0.5 };
    if (this.state === 'wind' && this.st > 8) {       // aim line
      const a = this.ang, L = 70; ctx.save(); ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(this.st * 0.5)); ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(this.x - cx + Math.cos(a) * 12, this.cy - cy + Math.sin(a) * 12); ctx.lineTo(this.x - cx + Math.cos(a) * L, this.cy - cy + Math.sin(a) * L); ctx.stroke(); ctx.restore();
    }
    const tl = P[n], tp = P[n - 1];                    // tail: the tip trails away from the body
    drawSheet(ctx, id + '_tail', sh * 16 + rot16(Math.atan2(tl.y - tp.y, tl.x - tp.x)), tl.x - cx, tl.y - cy, o);
    for (let i = n - 1; i >= 0; i--) {                 // vertebrae: peg toward the part ahead; right-going parts are mirrored so the claws stay underneath
      const q = P[i], f = i === 0 ? { x: this.x, y: this.cy } : P[i - 1], dx = f.x - q.x, dy = f.y - q.y;
      drawSheet(ctx, id + '_seg', sh * 16 + rot16(Math.atan2(dy, -Math.abs(dx)) + Math.PI), q.x - cx, q.y - cy, { ...o, dir: dx > 0 ? -1 : 1 });
    }
    const pose = this.state === 'wind' ? (this.st < 16 ? 2 : 1) : this.state === 'lunge' ? 1 : this.state === 'rec' ? 2 : 0;
    let rot = this.dir > 0 ? this.ang : this.ang - Math.PI; rot = Math.atan2(Math.sin(rot), Math.cos(rot));
    drawSheet(ctx, id + '_head', pose * 5 + sh, this.x - cx + (this.state === 'wind' ? Math.sin(this.st * 2) * 1.1 : 0), this.cy - cy, { ...o, dir: this.dir, rot: clamp(rot, -1.2, 1.2) * 0.85 });
  }
}
Object.assign(Wyrm.prototype, { key: 'wyrm', variant: 'bone', fx: COLORS.purple, glowC: [0.75, 0.55, 1], spits: false });
class FrostWyrm extends Wyrm {}
Object.assign(FrostWyrm.prototype, { key: 'frostwyrm', variant: 'frost', fx: COLORS.ice, glowC: [0.5, 0.85, 1] });
class EmberWyrm extends Wyrm {}
Object.assign(EmberWyrm.prototype, { key: 'emberwyrm', variant: 'ember', fx: COLORS.fire, glowC: [1, 0.5, 0.2], spits: true });

// ------------------------------------------------------------------------------------------------ HAUNTED BOOKS (the Library of Ages)
// A TOME is a ghostly flying book - one of 32 different grimoires (Magic Book pack by CaptainSkolot, drawn half-seen with a pale halo, so the Library holds a whole shelf of kinds): it wheels about the shelves in slow loops, its pages turning, trailing sparkles; it hovers and glitters when it sees you,
// then swoops in a great curve, banking like a bird, and sweeps up and away again.  A GRIMOIRE is a great one: it hangs in the air, circled by sparks, and throws torn pages.
const ROW_SPARK = [[1, 0.72, 0.5], [1, 0.58, 0.28], [0.55, 0.85, 1], [0.92, 0.62, 0.55], [0.5, 0.75, 1], [0.78, 0.6, 1], [0.62, 0.52, 1], [1, 0.72, 0.4]];          // the sparkle colour of each row of covers in the sheet (red, fire, ice, ember-violet, blue, violet, dark, brown)
const BOOK_SPARK = Array.from({ length: 32 }, (_, v) => { const c = ROW_SPARK[v >> 2]; return [c[0] * 0.75 + 0.2, c[1] * 0.75 + 0.22, c[2] * 0.75 + 0.25]; });          // (each pulled toward a pale ghostly white)
const GRAND_BOOKS = [3, 7, 11, 15, 19, 22, 26, 30];
// What a book casts when it opens (by the row of its cover): the open page that shows is one of the eight in bookpages.png (the Magic Books interface art)
const SPELLS = {
  fire: { page: 2, glow: [1, 0.5, 0.15], name: 'fire' }, flame: { page: 3, glow: [1, 0.6, 0.2], name: 'homing flame' }, ice: { page: 1, glow: [0.55, 0.85, 1], name: 'icicles' },
  bolt: { page: 6, glow: [0.7, 0.85, 1], name: 'lightning' }, arcane: { page: 7, glow: [0.75, 0.45, 1], name: 'homing violet flame' },
};
const ROW_SPELL = ['fire', 'flame', 'ice', 'flame', 'ice', 'arcane', 'bolt', 'fire'];
const spellOf = v => SPELLS[ROW_SPELL[v >> 2]];
function castSpell(g, e, sp) {          // what comes out of an open book
  const p = g.player, base = Math.atan2(p.y - 16 - e.cy, p.x - e.x), at = (a, s) => [Math.cos(a) * s, Math.sin(a) * s];
  if (sp === SPELLS.fire) { A.sfx('fire'); for (let i = -1; i <= 1; i++) { const [vx, vy] = at(base + i * 0.24, 1.9); g.addProjectile(new Projectile(e.x, e.cy, vx, vy, 'fire', { dmg: 6, life: 200 })); } }
  else if (sp === SPELLS.flame || sp === SPELLS.arcane) { A.sfx('cast'); const [vx, vy] = at(base, 1.2); g.addProjectile(new HomingWisp(e.x, e.cy, vx, vy, 7, sp === SPELLS.arcane ? 'purple' : 'fire')); }
  else if (sp === SPELLS.ice) { A.sfx('freeze'); for (let i = -1; i <= 1; i++) { const [vx, vy] = at(base + i * 0.2, 2.5); g.addProjectile(new IceShard(e.x, e.cy, vx, vy, 7)); } }
  else if (sp === SPELLS.bolt) { A.sfx('cast'); for (const dx of [0, p.x < e.x ? -46 : 46]) { const bx = Math.max(24, Math.min(g.room.pw - 24, p.x + dx)); g.addProjectile(new SkyBolt(bx, g.groundBelow(bx, p.y - 8), { warn: 40 + (dx ? 12 : 0), dmg: 9 })); } }
  g.fx.burst(e.x, e.cy, 8, [sp.glow, [1, 1, 0.9]], { speed: 1.8, s0: 8 });
}          // the big, ornate covers: the grimoires
function bookSparkle(g, x, y, c, n, spread, o = {}) {
  for (let i = 0; i < n; i++) g.fx.emit({ x: x + rand(-spread, spread), y: y + rand(-spread, spread) * 0.8, vx: (o.vx || 0) + rand(-0.25, 0.25), vy: (o.vy || 0) + rand(-0.45, 0.1), gy: o.gy === undefined ? 0.012 : o.gy, drag: 0.97, life: rand(24, 46), s0: rand(3, 6), s1: 0.5, c0: Math.random() < 0.3 ? [1, 0.96, 0.8] : c, a0: 1, a1: 0, kind: 6 });
}
// o.v cover 0..31, o.s scale, o.rot tilt, o.flash.  The covers are single pictures, so the pages 'turn' by the book breathing wider and flatter (frame drives it); the whole thing is half-seen and wavers.
function drawBook(ctx, x, y, frame, o) {          // o.open 0..1: the book opens, and the page of its spell shows (o.page)
  const open = o.open || 0, fl = Math.sin(frame * 1.7) * (1 - open), a = (o.flash ? 1 : 0.72 + 0.1 * Math.sin(frame * 0.6 + o.v)), g = ctx;
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(1 + 0.07 * fl, 1 - 0.07 * fl);
  g.globalCompositeOperation = 'lighter'; drawSheet(g, 'magicbooks', o.v, 0, 0, { scale: o.s * 1.08, rot: o.rot || 0, ay: 0.5, alpha: 0.16 * (1 - open) });          // a pale ghost-glow of the cover behind it
  g.globalCompositeOperation = 'source-over'; if (open < 1) drawSheet(g, 'magicbooks', o.v, 0, 0, { scale: o.s * (1 + 0.5 * open), rot: o.rot || 0, ay: 0.5, flash: o.flash, alpha: a * (1 - open) });
  if (open > 0) drawSheet(g, 'bookpages', o.page, 0, 0, { scale: o.s * 0.84 * (0.6 + 0.4 * open), rot: (o.rot || 0) * 0.5, ay: 0.5, flash: o.flash, alpha: Math.min(1, open * 1.2) * (o.flash ? 1 : 0.85) });          // (the open book: cover and pages, from the Magic Books interface pack)
  g.restore();
}
class Tome extends Enemy {
  constructor(g, x, y, o) { super(g, x, y + 8, 22, 16, o); this.hp = this.maxHp = 7; this.dmg = 6; this.xp = 6; this.gravity = false; this.kbRes = 0.2; this.state = 'drift'; this.st = 0; this.phase = rand(TAU); this.name = 'tome'; this.deathFx = [[0.95, 0.9, 0.7], [0.5, 0.35, 0.2]]; this.openK = 0; this.castCd = 60 + rand(120); this.v = Math.floor(rand(32)); this.ang = 0; this.turn = 1; this.tilt = 0; this.pf = rand(9); }
  ai(g) {
    const p = g.player; this.st++; this.face(); const sp = BOOK_SPARK[this.v], tx = p.x, ty = p.y - 16;
    if (this.state === 'drift') {          // wheels about in slow figures of eight, now and then flourishing upward
      const w = this.t * 0.028 + this.phase;
      this.vx = approach(this.vx, Math.cos(w) * 0.75, 0.04); this.vy = approach(this.vy, Math.sin(w * 2) * 0.55 - (Math.sin(w * 0.37) > 0.85 ? 0.5 : 0), 0.04);
      this.pf += 0.1 + Math.abs(this.vy) * 0.1;
      if (this.t % 3 === 0) bookSparkle(g, this.x, this.cy + 6, sp, 1, 7);
      if (this.castCd > 0) this.castCd--;
      const dd = dist(this.x, this.cy, tx, ty);
      if (dd < 130 && this.st > 50) { this.state = 'tell'; this.st = 0; A.sfx('page'); }
      else if (dd < 230 && dd > 90 && this.st > 80 && this.castCd === 0 && Math.random() < 0.012) { this.state = 'open'; this.st = 0; this.spell = spellOf(this.v); A.sfx('page'); }          // (from afar, a book may open and cast instead)
    } else if (this.state === 'open') {          // it stops, its cover falls open on a page of its spell, glows, casts, and closes again
      this.vx *= 0.85; this.vy = approach(this.vy, Math.sin(this.t * 0.08) * 0.15, 0.06); this.pf += 0.1; this.tilt = approach(this.tilt, 0, 0.1); this.openK = Math.min(1, this.openK + 0.07);
      const SP = this.spell || spellOf(this.v); g.fx.glow(this.x, this.cy, 14 + this.st * 0.18, SP.glow, 0.1 + Math.min(0.16, this.st * 0.005)); if (this.t % 2 === 0) bookSparkle(g, this.x, this.cy, SP.glow, 1, 12);
      if (this.st === 34) castSpell(g, this, SP);
      if (this.st > 52) { this.openK = Math.max(0, this.openK - 0.1); if (this.openK === 0) { this.state = 'drift'; this.st = 0; this.castCd = 220 + rand(120); } }
    } else if (this.state === 'tell') {          // it stops, glitters, and spins its pages up
      this.vx *= 0.8; this.vy = approach(this.vy, -0.35, 0.04); this.pf += 0.45; this.tilt = Math.sin(this.t * 0.9) * 0.18; g.fx.glow(this.x, this.cy, 26, sp, 0.55); if (this.t % 2 === 0) bookSparkle(g, this.x, this.cy, sp, 2, 14);
      if (this.st > 26) { this.state = 'swoop'; this.st = 0; this.ang = Math.atan2(ty - this.cy, tx - this.x); this.turn = this.x < tx ? 1 : -1; A.sfx('page'); }
    } else if (this.state === 'swoop') {          // a curved dive: it keeps turning toward you for a moment, then bends up and away
      const want = Math.atan2(ty - this.cy, tx - this.x); let d = want - this.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (this.st < 30) this.ang += Math.max(-0.07, Math.min(0.07, d)); else this.ang += -this.turn * 0.075 * Math.min(1, (this.st - 30) / 12);
      const spd = 2.5; this.vx = Math.cos(this.ang) * spd; this.vy = Math.sin(this.ang) * spd; this.pf += 0.8;
      bookSparkle(g, this.x - this.vx * 3, this.cy - this.vy * 3, sp, 2, 5, { vx: -this.vx * 0.15, vy: -this.vy * 0.15, gy: 0.02 }); g.fx.glow(this.x, this.cy, 20, sp, 0.4);
      if (this.st > 80 || this.hitX || this.hitCeil) { this.state = 'drift'; this.st = 0; this.vx *= 0.4; this.vy *= 0.4; }
    }
    this.tilt = approach(this.tilt, Math.max(-0.5, Math.min(0.5, this.vx * 0.22)), 0.06);
  }
  physics() { const room = this.g.room; this.hitX = 0; this.hitCeil = false; const nx = this.x + this.vx; if (room.solid(Math.floor(nx / T), Math.floor(this.cy / T))) { this.hitX = 1; this.vx = 0; } else this.x = nx; const ny = this.y + this.vy; if (room.solid(Math.floor(this.x / T), Math.floor((ny - this.h / 2) / T))) { this.hitCeil = true; this.vy = 0; } else this.y = ny; if (this.flashT > 0) this.flashT--; }
  draw(ctx, cx, cy) { if (this.state !== 'open' && this.openK > 0) this.openK = Math.max(0, this.openK - 0.1); drawBook(ctx, this.x - cx, this.cy - cy, this.pf, { v: this.v, s: 0.5, rot: this.tilt, flash: this.flashT > 0, open: this.openK, page: (this.spell || spellOf(this.v)).page }); }
}
class Grimoire extends Enemy {
  constructor(g, x, y, o) { super(g, x, y + 12, 36, 26, o); this.hp = this.maxHp = 20; this.dmg = 9; this.xp = 16; this.gravity = false; this.kbRes = 0.5; this.state = 'float'; this.st = 0; this.phase = rand(TAU); this.name = 'grimoire'; this.v = GRAND_BOOKS[Math.floor(rand(GRAND_BOOKS.length))]; this.deathFx = [[1, 0.85, 0.5], [0.5, 0.3, 0.1]]; this.cool = 70 + rand(50); this.tilt = 0; this.pf = 0; }
  ai(g) {
    const p = g.player; this.st++; this.face(); if (this.cool > 0) this.cool--;
    this.vx = approach(this.vx, Math.cos(this.t * 0.022 + this.phase) * 0.45 + (Math.abs(this.dx()) > 200 ? sign(p.x - this.x) * 0.35 : 0), 0.03); this.vy = approach(this.vy, Math.sin(this.t * 0.04 + this.phase) * 0.35, 0.03);
    g.fx.glow(this.x, this.cy, 40, [1, 0.8, 0.5], 0.1); g.fx.light(this.x, this.cy, 60, 0.4, [1, 0.8, 0.45]);
    const a = this.t * 0.05 + this.phase; if (this.t % 4 === 0) bookSparkle(g, this.x + Math.cos(a) * 26, this.cy + Math.sin(a) * 14, BOOK_SPARK[this.v], 1, 2, { gy: 0 });          // sparks circle it
    this.openK = this.state === 'cast' ? Math.min(1, (this.openK || 0) + 0.08) : Math.max(0, (this.openK || 0) - 0.05); this.pf += this.state === 'cast' ? 0.5 : 0.07; this.tilt = approach(this.tilt, Math.max(-0.3, Math.min(0.3, this.vx * 0.3)), 0.04);
    if (this.state === 'float') { if (this.cool === 0 && dist(this.x, this.cy, p.x, p.y - 16) < 230) { this.state = 'cast'; this.st = 0; A.sfx('tell'); } }
    else if (this.state === 'cast') { this.vx *= 0.5; this.vy *= 0.5; g.fx.glow(this.x, this.cy, 30 + this.st * 0.6, [1, 0.8, 0.3], 0.4 + this.st * 0.015); if (this.st % 2 === 0) bookSparkle(g, this.x, this.cy, [1, 0.85, 0.4], 2, 18);
      if (this.st === 30) { A.sfx('page'); const base = Math.atan2(p.y - 16 - this.cy, p.x - this.x); for (let i = -1; i <= 1; i++) { const a2 = base + i * 0.28; g.addProjectile(new Projectile(this.x, this.cy, Math.cos(a2) * 1.9, Math.sin(a2) * 1.9, 'page', { dmg: 8, life: 240 })); } }
      if (this.st > 44) { this.state = 'float'; this.st = 0; this.cool = 110 + rand(60); } }
  }
  physics() { Tome.prototype.physics.call(this); }
  draw(ctx, cx, cy) { drawBook(ctx, this.x - cx, this.cy - cy, this.pf, { v: this.v, s: 0.8, rot: this.tilt, flash: this.flashT > 0, open: this.openK || 0, page: spellOf(this.v).page }); }
}
// ------------------------------------------------------------------------------------------------ RIME SHADE (the Frozen Caverns)
// A cold shadow lies flat on the ice like a dark puddle; when you come close it climbs out of the floor, then stalks you with an outstretched arm.
class Shade extends Enemy {
  constructor(g, x, y, o) { super(g, x, y, 16, 34, o); this.hp = this.maxHp = 14; this.dmg = 9; this.xp = 12; this.state = 'lurk'; this.harmless = true; this.invuln = true; this.kbRes = 0.4; this.speed = 0.42 + rand(0.12); this.name = 'shade'; this.deathFx = [[0.5, 0.8, 1], [0.1, 0.2, 0.4]]; this.cool = 0; }
  ai(g) {
    const p = g.player; if (this.cool > 0) this.cool--;
    if (this.state === 'lurk') { if (Math.abs(this.dx()) < 70 && Math.abs(p.y - this.y) < 50) { this.state = 'rise'; this.t = 0; this.face(); A.sfx('freeze'); g.fx.burst(this.x, this.y - 2, 8, [[0.7, 0.9, 1], [0.2, 0.3, 0.5]], { speed: 1.2, s0: 8, s1: 2, up: 0.6 }); } return; }
    if (this.state === 'rise') { if (this.t > 60) { this.state = 'stalk'; this.harmless = false; this.invuln = false; this.st = 0; } return; }
    this.face(); this.st++;
    if (this.state === 'stalk') { if (Math.abs(this.dx()) > 6 && groundAhead(this, g.room, 6) && !wallAhead(this, g.room, 3)) this.vx = approach(this.vx, this.dir * this.speed, 0.05); else this.vx = approach(this.vx, 0, 0.1);
      if (Math.abs(this.dx()) < 34 && Math.abs(p.y - this.y) < 40 && this.cool === 0) { this.state = 'strike'; this.st = 0; this.vx = 0; A.sfx('tell'); } }
    else if (this.state === 'strike') { this.vx = 0; if (this.st === 14) { const hb = { x: this.dir > 0 ? this.x : this.x - 34, y: this.y - 34, w: 34, h: 30 }; g.fx.sparks(this.x + this.dir * 22, this.y - 18, 6, [[0.7, 0.9, 1], [0.3, 0.5, 0.9]], 2); if (overlap(hb, p.hurtbox)) p.hurt(this.dmg, this.x); } if (this.st > 30) { this.state = 'stalk'; this.cool = 50; this.st = 0; } }
  }
  draw(ctx, cx, cy) {
    if (this.state === 'lurk') { this.spr(ctx, 'shade_r1', 0, cx, cy, { alpha: 0.7 }); return; }
    if (this.state === 'rise') { const f = Math.min(7, Math.floor(this.t / 7.5)); if (f < 4) this.spr(ctx, 'shade_r1', f, cx, cy); else this.spr(ctx, 'shade_r2', f - 4, cx, cy); return; }
    if (this.state === 'strike') this.spr(ctx, 'shade_r3', this.st < 14 ? 0 : 1, cx, cy); else this.spr(ctx, 'shade_r4', Math.floor(this.t / 8) % 4, cx, cy);
  }
}
// what each kind of creature sounds like when it dies (a recorded file named like this in assets/sfx replaces the built-in sound; `kill` is the plain one, for anything not listed)
const KILL_SFX = { skeleton: 'kill_bone', wyrm: 'kill_bone', ghost: 'kill_ghost', wraith: 'kill_ghost', shade: 'kill_ghost', portrait: 'kill_ghost', zombie: 'kill_rot', ghoul: 'kill_rot', swampthing: 'kill_rot', hound: 'kill_beast', bat: 'kill_beast', swampspider: 'kill_beast',
  fireskull: 'kill_fire', emberwyrm: 'kill_fire', frostwyrm: 'kill_ice', tome: 'kill_book', grimoire: 'kill_book', wizard: 'kill_mage', archmage: 'kill_mage', sorcerer: 'kill_mage', acolyte: 'kill_mage', zealot: 'kill_mage' };
const killSfx = e => (e.o && e.o.frost && 'kill_ice') || KILL_SFX[e.typeKey] || 'kill';
export const ENEMY_TYPES = { tome: Tome, grimoire: Grimoire, shade: Shade, bat: Bat, zombie: Zombie, skeleton: Skeleton, ghost: Ghost, wraith: Wraith, fireskull: FireSkull, hound: Hound, ghoul: Ghoul, wizard: Wizard, wyrm: Wyrm, frostwyrm: FrostWyrm, emberwyrm: EmberWyrm };
