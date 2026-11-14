// The moving platforms of the castle: plain, clearly drawn slabs that glide to and fro along a visible track (sideways or up and down), easing to a near stop at each end so there is a
// moment to hop on or off.  A slab is a one-way platform you can always stand on: whoever stands on it is carried with it.  The Clockwork Dungeon's are brass; elsewhere they are stone,
// weathered wood (the mire) or green-grey stone (the cistern).
// Two kinds are dangerous.  A CRUMBLING slab (def.crumble) shakes for two thirds of a second after you land on it, then drops away and comes back a few seconds later.  A STEAM-VENT slab (def.vent) has a grille in
// the middle: it hisses first, then blasts a column of scalding steam over its middle for half a second (the ends of the slab are safe).
// (Player.update carries a rider with the platform before it moves, and calls land() after its normal movement.)
import { gearSprite } from './world.js';
import { Audio_ as A } from './audio.js';

const TAU = Math.PI * 2, SLAB_H = 9;

// colours: plate, bright standing edge, highlight, plate underside, truss body, truss gaps, rivet dark/light, rail and its glint, sleepers, cog style (see gearSprite)
const PAL = {
  brass: { plate: '#7a5a22', edge: '#e8c66a', hl: '#fff0b0', low: '#4a3310', body: '#2a1c0a', dark: '#12090a', rivD: '#2a1c0a', rivL: '#d8b050', rail: '#1c1409', railHi: '#4a3516', tie: '#6a4c1c', link: ['#6a4c1c', '#2a1c0a'], cog: 0 },
  stone: { plate: '#5b5d6c', edge: '#b4b8cc', hl: '#e6e8f6', low: '#33343e', body: '#22222c', dark: '#0e0e14', rivD: '#1c1c24', rivL: '#9a9eb4', rail: '#16161c', railHi: '#3a3a48', tie: '#50505e', link: ['#6a6a7c', '#22222c'], cog: 1 },
  wood: { plate: '#6a4524', edge: '#c08a50', hl: '#e8bf86', low: '#3e2814', body: '#2a1a0c', dark: '#120a05', rivD: '#2a1a0c', rivL: '#8a8a8a', rail: '#1a1208', railHi: '#3a2a14', tie: '#5a3c1c', link: ['#8a6a3a', '#3a2610'], cog: 2 },
  teal: { plate: '#3c5a60', edge: '#8fc0c4', hl: '#d0f0f0', low: '#22363a', body: '#142226', dark: '#08100f', rivD: '#10201f', rivL: '#78a8aa', rail: '#0e1a1c', railHi: '#2a4448', tie: '#34545a', link: ['#5a8a90', '#142226'], cog: 1 },
};

// where a platform's top-centre is, `s` (0..1) of the way along its track
export const moverAt = (d, s) => [d.x0 + (d.x1 - d.x0) * s, d.y0 + (d.y1 - d.y0) * s];
// the share of the track covered at frame t (a smooth to-and-fro: slowest at the ends)
const share = (d, t) => 0.5 - 0.5 * Math.cos(TAU * (t / d.period + d.ph));

export class Movers {
  // defs: [{ x0, y0, x1, y1, w, period, ph, style }] - top-centre of the slab at the two ends of its track (pixels), its width, frames per round trip, where in the round trip it starts (0..1), and its look
  constructor(defs) {
    this.defs = defs; this.t = 0; this.list = defs.map(d => ({ d, x: 0, y: 0, dx: 0, dy: 0, w: d.w, active: true, s: 0, fuse: 0, gone: 0, fall: 0, fvy: 0, back: 0, vent: 0 }));
    this.step(true);
  }
  step(init, g) {
    if (!init) this.t++;
    for (const m of this.list) {
      const d = m.d, s = share(d, this.t), [px, py] = moverAt(d, s);
      m.dx = init ? 0 : px - m.x; m.dy = init ? 0 : py - m.y; m.x = px; m.y = py; m.s = s;
      if (init || !g) continue;
      if (d.crumble) {
        if (m.back > 0) m.back--;
        if (m.gone > 0) { m.fvy = Math.min(m.fvy + 0.3, 6); m.fall += m.fvy; if (--m.gone === 0) { m.active = true; m.fall = 0; m.fvy = 0; m.back = 24; } }
        else if (m.fuse > 0) {
          if (this.t % 4 === 0) g.fx.burst(m.x + (Math.random() - 0.5) * m.w * 0.8, m.y + 6, 1, [[0.55, 0.5, 0.45], [0.3, 0.27, 0.25]], { speed: 0.5, s0: 5, s1: 1, up: -0.3, l0: 14, l1: 24 });
          if (--m.fuse === 0) { m.active = false; m.gone = 170; m.fall = 0; m.fvy = 0; A.sfx('crumble'); g.fx.burst(m.x, m.y + 6, 14, [[0.6, 0.55, 0.5], [0.3, 0.27, 0.25]], { speed: 1.8, s0: 8, s1: 1, up: -0.4 }); }
        }
      }
      if (d.vent) {
        const c = (this.t + Math.round((d.ph || 0) * 220)) % 220; m.vent = c < 140 ? 0 : c < 185 ? 1 : 2;
        if (m.vent === 1) { if (this.t % 4 === 0) g.fx.smoke(m.x, m.y - 2, 1, { c0: [0.75, 0.74, 0.72], c1: [0.45, 0.44, 0.42], s0: 3, s1: 9, l: 0.4 }); if (c === 140) A.sfx('steam'); }
        else if (m.vent === 2) {
          g.fx.smoke(m.x, m.y - 2, 2, { c0: [0.95, 0.94, 0.92], c1: [0.6, 0.58, 0.56], s0: 6, s1: 22, l: 0.6 });
          const p = g.player; if (!p.dead && Math.abs(p.x - m.x) < 15 && p.y > m.y - 56 && p.y - 34 < m.y + 2) p.hurt(5, m.x, { kb: 0.6 });
        }
      }
    }
  }
  // a falling (or standing) hero touches the top of a slab: stand on it, and ride it
  land(p) {
    if (p.dropThrough > 0 || p.dead) { p.ride = null; return; }
    let best = null;
    if (p.vy >= 0) for (const m of this.list) {
      if (!m.active || Math.abs(p.x - m.x) > m.w / 2 + 2) continue;
      const top = m.y, prevFeet = p.y - p.vy, prevTop = top - m.dy;
      if (p.y >= top - 1 && p.y <= top + Math.max(6, p.vy + 2 + Math.abs(m.dy)) && prevFeet <= prevTop + 3 && (!best || m.y < best.y)) best = m;
    }
    if (best) { p.y = best.y; p.vy = 0; p.onGround = true; p.ride = best; if (best.d.crumble && !best.fuse && !best.gone) best.fuse = 38; } else p.ride = null;
  }
  draw(ctx, cx, cy) {
    for (const m of this.list) {
      const d = m.d, vertical = d.x0 === d.x1, x = Math.round(m.x - cx), y = Math.round(m.y - cy), pal = PAL[d.style] || PAL.brass;
      if (Math.max(d.x0, d.x1) + d.w / 2 - cx < -40 || Math.min(d.x0, d.x1) - d.w / 2 - cx > 430 || Math.max(d.y0, d.y1) - cy < -60 || Math.min(d.y0, d.y1) - cy > 260 + 200) continue;
      this.track(ctx, d, vertical, cx, cy, m.s, pal);
      if (m.gone > 0 && m.fall > 70) continue;                                                        // (a fallen slab has dropped out of sight)
      const shake = m.fuse > 0 ? ((this.t >> 1) & 1 ? 1 : -1) : 0, drop = m.gone > 0 ? Math.round(m.fall) : 0, ghost = m.gone > 0 ? Math.max(0, 1 - m.fall / 70) : m.back > 0 && (this.t & 2) ? 0.5 : 1;
      if (ghost < 1) ctx.globalAlpha = ghost;
      this.slab(ctx, x + shake, y + drop, d.w, pal, d, m);
      ctx.globalAlpha = 1;
    }
  }
  // the rail it runs along: a groove with a small turning cog at each end (sideways), or a chain up to a cog under the ceiling (up and down)
  track(ctx, d, vertical, cx, cy, s, pal) {
    const cog = (x, y, r, dir) => { const sp = gearSprite(r, 8, pal.cog); ctx.save(); ctx.translate(Math.round(x - cx), Math.round(y - cy)); ctx.rotate(dir * (s * 5 + (d.ph || 0))); ctx.drawImage(sp, -sp.width / 2, -sp.height / 2); ctx.restore(); };
    if (vertical) {
      const x = d.x0, top = Math.min(d.y0, d.y1), bot = Math.max(d.y0, d.y1), px = Math.round(x - cx), ry = Math.round(top - cy) - 40, rh = Math.round(bot - top) + 52;
      ctx.fillStyle = pal.rail; ctx.fillRect(px - 14, ry, 3, rh); ctx.fillRect(px + 11, ry, 3, rh);                           // two guide rails
      ctx.fillStyle = pal.railHi; ctx.fillRect(px - 14, ry, 1, rh); ctx.fillRect(px + 11, ry, 1, rh);
      const my = top + (bot - top) * s;
      for (let yy = Math.round(my - cy) - 8; yy > ry - 16; yy -= 5) { ctx.fillStyle = (yy & 1) ? pal.link[0] : pal.link[1]; ctx.fillRect(px - 1, yy - 4, 3, 4); }          // the chain it hangs from
      cog(x, top - 40, 14, 1);
    } else {
      const y = d.y0, left = Math.min(d.x0, d.x1) - d.w / 2, right = Math.max(d.x0, d.x1) + d.w / 2, py = Math.round(y - cy) + 14, lx = Math.round(left - cx) - 6, rw = Math.round(right - left) + 12;
      ctx.fillStyle = pal.rail; ctx.fillRect(lx, py, rw, 4);
      ctx.fillStyle = pal.railHi; ctx.fillRect(lx, py, rw, 1);
      for (let tx = lx; tx < lx + rw; tx += 8) { ctx.fillStyle = pal.tie; ctx.fillRect(tx, py + 1, 2, 2); }          // sleepers along the rail
      cog(left - 6, y + 16, 11, 1); cog(right + 6, y + 16, 11, -1);
    }
  }
  // the slab itself: a bright edge on top so the standing surface is obvious, riveted plate, dark truss beneath
  slab(ctx, x, y, w, pal, d = {}, m = {}) {
    const l = x - (w >> 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(l + 2, y + SLAB_H, w - 4, 3);                                                // (underside shadow)
    ctx.fillStyle = pal.body; ctx.fillRect(l + 4, y + 5, w - 8, SLAB_H - 1);                                                       // truss body
    for (let tx = l + 6; tx < l + w - 8; tx += 10) { ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(tx, y + 6); ctx.lineTo(tx + 5, y + SLAB_H + 3); ctx.lineTo(tx + 10, y + 6); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = pal.plate; ctx.fillRect(l, y, w, 6);                                                                           // the plate
    ctx.fillStyle = pal.edge; ctx.fillRect(l, y, w, 2);                                                                            // bright standing edge
    ctx.fillStyle = pal.hl; ctx.fillRect(l + 1, y, w - 2, 1);
    ctx.fillStyle = pal.low; ctx.fillRect(l, y + 5, w, 1);
    for (let tx = l + 4; tx < l + w - 3; tx += 8) { ctx.fillStyle = pal.rivD; ctx.fillRect(tx, y + 3, 2, 2); ctx.fillStyle = pal.rivL; ctx.fillRect(tx, y + 3, 1, 1); }          // rivets
    ctx.fillStyle = pal.edge; ctx.fillRect(l, y, 2, 6); ctx.fillRect(l + w - 2, y, 2, 6);                                          // end caps
    if (d.crumble) {                                                                                                               // cracks across the plate, more of them once it has started to go
      ctx.fillStyle = pal.dark; const n = m.fuse > 0 ? 7 : 3;
      for (let k = 0; k < n; k++) { const cx = l + 8 + ((k * 37 + (d.ph || 0) * 50) % (w - 16)) | 0; ctx.fillRect(cx, y + 1, 1, 3); ctx.fillRect(cx + 1, y + 3, 1, 2); ctx.fillRect(cx - 1, y + 4, 1, 2); }
    }
    if (d.vent) {                                                                                                                  // a grille in the middle; it glows hot while it blasts
      const gx = x - 12;
      ctx.fillStyle = pal.dark; ctx.fillRect(gx, y - 1, 24, 4);
      ctx.fillStyle = m.vent === 2 ? '#ffe9c0' : m.vent === 1 ? '#c87a30' : '#5a3a14';
      for (let k = 0; k < 6; k++) ctx.fillRect(gx + 1 + k * 4, y, 2, 2);
    }
  }
}
