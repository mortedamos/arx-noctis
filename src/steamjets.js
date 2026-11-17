// STEAM JETS of the Clockwork Dungeon.  An iron grate in the floor breathes steam in a cycle: it leaks a thin wisp while it is QUIET, hisses and swells and glows for the better part of a second as a WARNING,
// then bursts into a tall column of scalding steam, then shuts again.  The column hurts whoever stands in it (the hero; nothing else).  They are in the Escapement, in the Hierophant's Foundry (where they are one
// more thing to dodge: they cycle faster once the boss is hurt) and in the Boiler Loft.   (def.jets: [{ x, y, h, ph, period }] - x the middle of the grate and y the floor, in pixels; made by levelgen)
// The steam itself is drawn by the three.js effects layer (fx.smoke / fx.jet); only the grate is a sprite.
import { overlap, rand } from './util.js';
import { Audio_ as A } from './audio.js';

const DMG = 12;

export class SteamJet {
  constructor(d) {
    this.x = d.x; this.y = d.y; this.h = d.h || 88; this.w = d.w || 22; this.period = d.period || 240; this.warn = 56; this.on = 62;
    this.t = Math.floor((d.ph || 0) * this.period); this.mode = 'off'; this.k = 0; this.disabled = false; this.fast = 1;
  }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  quicken() { if (this.fast === 1) { this.fast = 1.35; A.sfx('steam'); } }          // (a boss that has been hurt runs the works hotter)
  step(g) {
    if (this.disabled) { this.mode = 'off'; return; }
    this.t += this.fast; const cyc = this.period, quiet = cyc - this.warn - this.on, c = this.t % cyc, prev = this.mode;
    if (c < quiet) { this.mode = 'off'; this.k = c / quiet; } else if (c < quiet + this.warn) { this.mode = 'warn'; this.k = (c - quiet) / this.warn; } else { this.mode = 'on'; this.k = (c - quiet - this.warn) / this.on; }
    const cam = g.camera, onScreen = this.x > cam.x - 40 && this.x < cam.x + 424 && this.y > cam.y - 40 && this.y - this.h < cam.y + 260, fx = g.fx, p = g.player;
    if (this.mode !== prev && onScreen) { if (this.mode === 'warn') A.sfx('steam'); else if (this.mode === 'on') { A.sfx('steam'); g.shake(1.2, 8); } }
    if (onScreen) {
      const soft = { c0: [0.92, 0.94, 0.98], c1: [0.55, 0.58, 0.66] };
      if (this.mode === 'off') { if (g.frame % 24 === 0) fx.smoke(this.x + rand(-4, 4), this.y - 2, 1, { s0: 3, s1: 9, a: 0.22, l: 0.7, ...soft }); }
      else if (this.mode === 'warn') {                                                                       // the grate glows and hisses, and puffs of steam climb a little higher with every beat
        const k = this.k; if (g.frame % 3 === 0) fx.smoke(this.x + rand(-5, 5), this.y - 3, 1 + (k > 0.6 ? 1 : 0), { s0: 4, s1: 10 + 10 * k, a: 0.26 + 0.2 * k, l: 0.5 + 0.5 * k, ...soft });
        fx.glow(this.x, this.y - 2, 10 + 8 * k, [1, 0.55, 0.2], 0.12 + 0.3 * k);
      } else {                                                                                                // the column
        fx.jet(this.x, this.y - 2, -Math.PI / 2, [[0.96, 0.97, 1], [0.55, 0.6, 0.7]], { n: 5, speed: 5.8, spread: 0.12, size: 28 });
        fx.smoke(this.x + rand(-7, 7), this.y - 6 - rand(0, this.h * 0.85), 1, { s0: 12, s1: 28, a: 0.34, l: 0.6, ...soft });
        fx.light(this.x, this.y - 30, 56, 0.25, [0.8, 0.85, 1]);
      }
    }
    if (this.mode === 'on' && this.k * this.on > 4 && !p.dead && overlap(this.box, p.hurtbox)) p.hurt(DMG, this.x, { kb: 1.6, stun: 16 });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy); if (x < -30 || x > 420 || y < -20 || y > 260) return;
    const hot = this.mode === 'on' ? 1 : this.mode === 'warn' ? this.k : 0, w = 26;
    ctx.fillStyle = '#17120c'; ctx.fillRect(x - w / 2 - 1, y - 5, w + 2, 6);                                    // the frame, set into the floor
    ctx.fillStyle = '#4a3c22'; ctx.fillRect(x - w / 2, y - 5, w, 1); ctx.fillStyle = '#2a2114'; ctx.fillRect(x - w / 2, y - 4, w, 4);
    for (let i = 0; i < 4; i++) { const sx = x - w / 2 + 3 + i * 6; ctx.fillStyle = hot > 0 ? `rgb(${Math.round(70 + 185 * hot)},${Math.round(40 + 90 * hot)},${Math.round(20 + 20 * hot)})` : '#0c0905'; ctx.fillRect(sx, y - 4, 3, 3); }          // the slits of the grate: they glow before the burst
    ctx.fillStyle = '#7a6a3c'; ctx.fillRect(x - w / 2 - 1, y - 6, 2, 2); ctx.fillRect(x + w / 2 - 1, y - 6, 2, 2);          // two brass rivets
  }
}
