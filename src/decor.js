// Static scenery drawn with the room (tombstones, torches, banners, doors ...) + the list of flames to light them.
import { KEYS } from './itemdata.js';
import { IMG, SHEET, drawSheet } from './assets.js';
import { extra, TILE } from './world.js';
import { T } from './util.js';
import { drawFramedPortrait, FH } from './portraitart.js';
import { orlojTower, TOWER_W, TOWER_H } from './orlojtower.js';
import { keepGate, KEEP_W, KEEP_H } from './keepgate.js';
import { bridgeTower, BT_W, BT_H } from './bridgetower.js';

const BACK_KINDS = new Set(['column', 'waterfall', 'spill', 'portrait', 'cog', 'pendulum', 'animgear', 'orlojtower', 'keepgate', 'bridgetower', 'icicles', 'crystals', 'voidpit', 'vaultback', 'table', 'stool', 'cot', 'rack', 'rug', 'hearth', 'armchair', 'cat', 'shutcase', 'altarledge', 'bog']);
// Is this piece of scenery drawn over a hazard (a spike tile)?  Nothing may stand in front of a hazard: the room drops such pieces when it loads.
export function decoCoversHazard(d, spikes) {
  if (isBack(d)) return false; let x0, y0, w, h;
  if (d.t === 'img') { const im = IMG[d.img]; if (!im) return false; const sc = d.scale || 1; w = Math.round(im.width * sc); h = Math.round(im.height * sc); x0 = d.x - w / 2; y0 = d.y - h + (d.sink || 0); }
  else if (d.t === 'cdl') { const im = IMG[cdlOf(d).img]; if (!im) return false; w = im.width; h = im.height; x0 = d.x - w / 2; y0 = d.y - h + CDL_DROP; }
  else if (d.t === 'brazier') { const s = SHEET.brazier; if (!s) return false; w = s.w; h = s.h; x0 = d.x - s.ax * w; y0 = d.y - s.ay * h; }
  else return false;
  return spikes.some(([tx, ty]) => x0 < tx * T + T - 1 && x0 + w > tx * T + 1 && y0 < ty * T + T && y0 + h > ty * T + 6);
}
// The candelabras are two CC0 pictures from freegamesprites.com (a brass one and a bronze stand), their painted flames cut away (tools/pixelate-candelabra.ps1); the flames are lit by the effects layer at each candle's top
// (fl = the three wicks, [x from the picture's centre, y from its bottom]).  Which one stands where comes from the column, so a room always looks the same.
const CDL = [{ img: 'cdl_a', fl: [[-10.7, -33.5], [-0.3, -35.8], [10.9, -34.3]] }, { img: 'cdl_b', fl: [[-9.2, -38.6], [-0.3, -41.8], [9.2, -39]] }];
const CDL_DROP = 4;          // (the candelabra pictures have a little perspective painted in: they are set 4 pixels lower so the foot stands ON the ground, not above it)
const cdlOf = d => CDL[(((Math.round(d.x) * 2654435761) >>> 0) >>> 20) & 1];
const SINK = { town_well: 6, forest_tree_1: 8, forest_tree_2: 8, forest_tree_3: 8, forest_tree_4: 8 };          // (pictures with a little perspective painted into their base: they are drawn lower, so they stand ON the ground instead of hovering over it.  The four gnarled dead trees taper to a few thin roots, so the roots are sunk into the ground: 8px)
export const isBack = d => BACK_KINDS.has(d.t) || (d.back && (d.t === 'img' || d.t === 'bookcase' || d.t === 'barwin'));

// The platform tiles that a piece of front scenery (a crate, a cart, a lamp, a well ...) stands across.  The scenery is drawn after the ground, so it would hide such a platform; the room paints these tiles again
// over it (Room.drawPlatsOver), so a platform is always in front.  A piece that stands ON a platform is not counted: the bottom 7 pixels of its picture (its base, and the little perspective painted under it) are left out.
export function platesOver(room) {
  const found = new Map(), TP = 10;          // (a platform plank is about 10 pixels thick)
  for (const d of room.decos || []) {
    if (d.t !== 'img' || isBack(d) || d.fore) continue; const im = IMG[d.img]; if (!im) continue;
    const sc = d.scale || 1, w = Math.round(im.width * sc), h = Math.round(im.height * sc), x0 = Math.round(d.x - w / 2), yb = d.y + (d.sink === undefined ? (SINK[d.img] || 0) : d.sink), y0 = yb - h, y1 = yb - 7;
    for (let ty = Math.floor((y0 - TP) / T); ty <= Math.floor(y1 / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + w - 1) / T); tx++) {
      if (room.get(tx, ty) !== TILE.PLAT) continue; const py = ty * T;
      if (x0 < tx * T + T && x0 + w > tx * T && y0 < py + TP && y1 > py) found.set(tx + ',' + ty, [tx, ty]);
    }
  }
  return [...found.values()];
}

// a turning brass cogwheel (the Orloj Tower's works): a toothed rim, six spokes and a hub.  r = radius, n = teeth, spin = radians a frame (the sign is the direction), a = its opacity
function drawCog(g, x, y, r, n, ang, a) {
  const root = r * 0.86, pal = ['#8a6a2c', '#5d4519', '#33260f', '#b99444'];
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = a;
  g.fillStyle = pal[1]; g.beginPath();
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, w = Math.PI / n * 0.62; g.lineTo(Math.cos(a0 - w) * root, Math.sin(a0 - w) * root); g.lineTo(Math.cos(a0 - w * 0.7) * r, Math.sin(a0 - w * 0.7) * r); g.lineTo(Math.cos(a0 + w * 0.7) * r, Math.sin(a0 + w * 0.7) * r); g.lineTo(Math.cos(a0 + w) * root, Math.sin(a0 + w) * root); }
  g.closePath(); g.fill();
  g.fillStyle = pal[2]; g.beginPath(); g.arc(0, 0, root * 0.78, 0, Math.PI * 2); g.fill();                          // the open centre, with spokes across it
  g.strokeStyle = pal[0]; g.lineWidth = Math.max(2, r * 0.09); for (let i = 0; i < 6; i++) { const a0 = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a0) * root * 0.8, Math.sin(a0) * root * 0.8); g.stroke(); }
  g.strokeStyle = pal[0]; g.lineWidth = Math.max(1.5, r * 0.07); g.beginPath(); g.arc(0, 0, root * 0.8, 0, Math.PI * 2); g.stroke();
  g.fillStyle = pal[3]; g.beginPath(); g.arc(0, 0, Math.max(2, r * 0.16), 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,235,170,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r * 0.93, Math.PI * 1.15, Math.PI * 1.5); g.stroke();       // a glint along the rim
  g.restore();
}

// ALCHEMICAL SYMBOLS for the sigils on a sealed door (each boss that must fall has its own): sulphur, water, salt, air, earth, and for the Reliquary the skull.  Strokes only, about 12 px tall, centred on (x, y).
// NEVER draw the signs traditionally used for male and female (Mars, a circle with an arrow, which is also iron; Venus, a circle on a cross, which is also copper) or anything that reads like them: the user asked for them
// to be avoided.  The Clockwork Lord's sigil was Mars's sign and the Mire Mother's was Mercury's (a circle on a cross, which reads as Venus's), so they are now AIR (a triangle with a bar) and WATER (a triangle
// pointing down).  The names of the metals stay in the game's TEXT (the Keys of Iron, Copper and Mercury); only the pictures are avoided.
const SIGIL_OF = { boss_h4: 'sulphur', boss_ib: 'water', boss_u3: 'salt', boss_kb: 'air', skulls_done: 'skull', boss_og: 'earth' };
const SIGILS_BY_ORDER = ['sulphur', 'water', 'salt', 'air'];
function glyph(g, name, x, y) {
  g.beginPath();
  if (name === 'sulphur') { g.moveTo(x, y - 6); g.lineTo(x + 4.6, y + 1); g.lineTo(x - 4.6, y + 1); g.closePath(); g.moveTo(x, y + 1); g.lineTo(x, y + 6.5); g.moveTo(x - 2.6, y + 3); g.lineTo(x + 2.6, y + 3); g.moveTo(x - 2.6, y + 5.4); g.lineTo(x + 2.6, y + 5.4); }          // a triangle on a double cross
  else if (name === 'water') { g.moveTo(x - 5.2, y - 4.4); g.lineTo(x + 5.2, y - 4.4); g.lineTo(x, y + 5.4); g.closePath(); }          // a triangle pointing down: water (the Mire Mother's swamp)
  else if (name === 'salt') { g.arc(x, y, 4.6, 0, Math.PI * 2); g.moveTo(x - 6, y); g.lineTo(x + 6, y); }          // a circle cut by a bar
  else if (name === 'air') { g.moveTo(x, y - 5.6); g.lineTo(x + 5.2, y + 4.4); g.lineTo(x - 5.2, y + 4.4); g.closePath(); g.moveTo(x - 3.4, y + 0.8); g.lineTo(x + 3.4, y + 0.8); }          // a triangle pointing up with a bar across it: air (the Clockwork Lord)
  else if (name === 'earth') { g.moveTo(x - 5.2, y - 4.4); g.lineTo(x + 5.2, y - 4.4); g.lineTo(x, y + 5.4); g.closePath(); g.moveTo(x - 3, y - 0.6); g.lineTo(x + 3, y - 0.6); }          // a triangle pointing down with a bar across it: earth (the golem)
  else if (name === 'skull') { g.arc(x, y - 1, 4.4, Math.PI * 0.82, Math.PI * 0.18, false); g.lineTo(x + 2.2, y + 4.8); g.lineTo(x - 2.2, y + 4.8); g.closePath(); g.moveTo(x - 2, y - 1); g.lineTo(x - 0.8, y - 1); g.moveTo(x + 0.8, y - 1); g.lineTo(x + 2, y - 1); g.moveTo(x - 1, y + 4.8); g.lineTo(x - 1, y + 3); g.moveTo(x + 1, y + 4.8); g.lineTo(x + 1, y + 3); }          // the death's-head, for the door the six skulls open
  else { g.arc(x, y, 4.2, 0, Math.PI * 2); g.moveTo(x, y); g.lineTo(x + 0.01, y); }
  g.stroke();
}

// the sigil a fallen boss lights on its sealed door (null if it lights none): the name of its alchemical symbol
export const sigilOf = flag => SIGIL_OF[flag] || null;
// A BIG sigil, burning, in the middle of the screen (shown the moment its boss falls): x, y = its centre, a = opacity, size = how many times bigger than on the door
export function drawSigilCard(g, name, x, y, t, a, size = 4) {
  const fk = 0.8 + 0.2 * Math.sin(t * 0.17) + 0.08 * Math.sin(t * 0.41);
  g.save(); g.globalAlpha = a; g.translate(x, y);
  g.fillStyle = 'rgba(6,3,12,0.72)'; g.beginPath(); g.arc(0, 0, size * 9.5, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(0, 0, 2, 0, 0, size * 15); gr.addColorStop(0, 'rgba(255,170,70,' + (0.36 * fk).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(-size * 15, -size * 15, size * 30, size * 30); g.globalCompositeOperation = 'source-over';
  g.scale(size, size); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#050208'; g.lineWidth = 2.2; glyph(g, name, 0, 0);
  g.strokeStyle = 'rgba(255,214,130,' + (0.85 + 0.15 * fk).toFixed(3) + ')'; g.lineWidth = 0.95; glyph(g, name, 0, 0);
  g.restore();          // (no flame over it: the glow alone)
}

export function drawDeco(g, d, cx, cy, t, room) {
  const x = Math.round(d.x - cx), y = Math.round(d.y - cy);
  if (x < -150 || x > 540) return;
  switch (d.t) {
    case 'orlojtower': { const tw = orlojTower(); if (tw) g.drawImage(tw, x - TOWER_W / 2, y - TOWER_H); break; }          // (the tower stands on the ground: y is its foot)
    case 'vaultback': {          // the dark stone behind a hollow under the floor (the generator's floor caches): without it the sky would show through a hole in the ground.  x = its middle, y = its top, w x h in pixels
      const x0 = Math.round(x - d.w / 2), y0 = Math.round(y); g.fillStyle = '#0d0a12'; g.fillRect(x0, y0, d.w, d.h); g.fillStyle = '#17131f';
      for (let row = 0, yy = y0 + 1; yy < y0 + d.h; row++, yy += 8) for (let xx = x0 + (row % 2 ? -8 : 0); xx < x0 + d.w; xx += 16) { const a = Math.max(x0, xx + 1), z = Math.min(x0 + d.w, xx + 15); if (z > a) g.fillRect(a, yy, z - a, Math.min(6, y0 + d.h - yy)); }
      break; }
    case 'grate': {          // an iron grate in the floor, three tiles wide (the Warder's Chamber).  The lever draws it back: it slides left, under the floor beside it (d.p: 0 shut .. 1 gone - see Game.stepGrate)
      const w = d.w || 48, p = d.p || 0, x0 = Math.round(x - w / 2);
      g.fillStyle = '#4a4654'; g.fillRect(x0 - 2, y, 2, 5); g.fillRect(x0 + w, y, 2, 5); if (p >= 1) break;          // (the iron lip it runs in)
      g.save(); g.beginPath(); g.rect(x0, y, w, 16); g.clip(); g.translate(-Math.round(p * w), 0);
      g.fillStyle = '#07050a'; g.fillRect(x0, y, w, 16);          // the dark under it
      for (let bx = x0 + 3; bx < x0 + w - 2; bx += 6) { g.fillStyle = '#56525f'; g.fillRect(bx, y + 1, 2, 13); g.fillStyle = '#8d889b'; g.fillRect(bx, y + 1, 1, 13); }
      for (const by of [0, 8]) { g.fillStyle = '#5f5b69'; g.fillRect(x0, y + by, w, 3); g.fillStyle = '#a29db0'; g.fillRect(x0, y + by, w, 1); for (let bx = x0 + 3; bx < x0 + w - 2; bx += 12) { g.fillStyle = '#2b2831'; g.fillRect(bx, y + by + 1, 1, 1); } }
      g.restore(); break; }
    case 'table': {          // the Warder's table: planks on two legs, a stub of candle, a mug and an open ledger.  x = its middle, y = the floor
      g.fillStyle = '#2a1a10'; g.fillRect(x - 13, y - 13, 3, 13); g.fillRect(x + 10, y - 13, 3, 13); g.fillRect(x - 12, y - 6, 24, 2);
      g.fillStyle = '#6b4a2b'; g.fillRect(x - 16, y - 16, 32, 4); g.fillStyle = '#91683e'; g.fillRect(x - 16, y - 16, 32, 1); g.fillStyle = '#3a2615'; g.fillRect(x - 16, y - 13, 32, 1);
      g.fillStyle = '#d9cfae'; g.fillRect(x - 12, y - 18, 10, 2); g.fillStyle = '#8c806a'; g.fillRect(x - 7, y - 18, 1, 2);          // the ledger
      g.fillStyle = '#7b7f8c'; g.fillRect(x + 1, y - 21, 5, 5); g.fillRect(x + 6, y - 20, 2, 3); g.fillStyle = '#a9aebc'; g.fillRect(x + 1, y - 21, 5, 1);          // the mug
      g.fillStyle = '#e7ddc0'; g.fillRect(x + 11, y - 21, 3, 5); const f = Math.sin(t * 0.3 + d.x) > 0 ? 1 : 0; g.fillStyle = '#ffb347'; g.fillRect(x + 11, y - 25 - f, 3, 4 + f); g.fillStyle = '#fff1b0'; g.fillRect(x + 12, y - 23, 1, 2); break; }
    case 'stool': { g.fillStyle = '#2a1a10'; g.fillRect(x - 5, y - 8, 2, 8); g.fillRect(x + 3, y - 8, 2, 8); g.fillStyle = '#6b4a2b'; g.fillRect(x - 6, y - 10, 12, 3); g.fillStyle = '#91683e'; g.fillRect(x - 6, y - 10, 12, 1); break; }
    case 'cot': {          // a straw cot: a low frame, a sacking mattress, a bolster and a blanket thrown back
      g.fillStyle = '#2a1a10'; g.fillRect(x - 20, y - 14, 3, 14); g.fillRect(x + 17, y - 9, 3, 9); g.fillStyle = '#5a3d23'; g.fillRect(x - 18, y - 6, 36, 3);
      g.fillStyle = '#8f7c52'; g.fillRect(x - 17, y - 10, 34, 4); g.fillStyle = '#b29d6a'; g.fillRect(x - 17, y - 10, 34, 1); g.fillStyle = '#cdbf9a'; g.fillRect(x - 17, y - 13, 9, 3);
      g.fillStyle = '#5c2f33'; g.fillRect(x - 1, y - 12, 18, 6); g.fillStyle = '#7d4247'; g.fillRect(x - 1, y - 12, 18, 1); g.fillStyle = '#c9a227'; for (let k = 0; k < 6; k++) g.fillRect(x - 16 + k * 6, y - 5 + (k % 2), 1, 2); break; }
    case 'rack': {          // a stand of arms: two posts and a rail, a halberd and a pike leaning in it, and the ring of keys
      g.fillStyle = '#3a2615'; g.fillRect(x - 13, y - 28, 3, 28); g.fillRect(x + 10, y - 28, 3, 28); g.fillStyle = '#6b4a2b'; g.fillRect(x - 15, y - 25, 30, 3); g.fillRect(x - 15, y - 9, 30, 3);
      for (const [px, h] of [[-6, 44], [3, 48]]) { g.fillStyle = '#7a5632'; g.fillRect(x + px, y - h, 2, h); g.fillStyle = '#b9bfcc'; g.fillRect(x + px, y - h - 6, 2, 6); g.fillRect(x + px - 1, y - h - 3, 4, 1); }
      g.fillStyle = '#b9bfcc'; g.fillRect(x - 10, y - 42, 5, 6); g.fillStyle = '#8b91a0'; g.fillRect(x - 10, y - 37, 5, 1);          // the halberd's blade
      g.strokeStyle = '#c9a227'; g.lineWidth = 1; g.beginPath(); g.arc(x + 11.5, y - 18.5, 3, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#c9a227'; g.fillRect(x + 10, y - 16, 1, 6); g.fillRect(x + 13, y - 16, 1, 5); g.fillRect(x + 9, y - 11, 1, 1); break; }
    case 'bridgetower': { const bt = bridgeTower(); if (bt) g.drawImage(bt, Math.round(x - BT_W / 2), y - BT_H); break; }          // (the Stone Bridge Tower, standing on the ground behind the Bridge Gate's altar)
    case 'keepgate': { const kg = keepGate(); if (kg) g.drawImage(kg, Math.round(x - kg.width / 2), y - kg.height); break; }          // (the great gate of Arx Noctis, standing on the ground behind a door into the keep)
    case 'animgear': {          // an accent: a cluster of meshing gears from the Animated Gears pack (a strip of 128x128 frames), turning slowly among the generated ones
      const im = IMG[d.img]; if (!im) break; const n = Math.max(1, Math.round(im.width / 128)), f = (((Math.floor((d.phase || 0) + t * (d.rate || 0.4)) % n) + n) % n), s = Math.round((d.scale || 1) * 128);
      g.save(); g.globalAlpha = d.a === undefined ? 0.8 : d.a; g.drawImage(im, f * 128, 0, 128, 128, Math.round(x - s / 2), Math.round(y - s / 2), s, s); g.restore(); break; }
    case 'cog': drawCog(g, x, y, d.r, d.n, (d.phase || 0) + t * d.spin, d.a === undefined ? 0.85 : d.a); break;
    case 'pendulum': {          // a brass rod on a pivot, with a heavy bob that swings with a slow tick
      const L = d.len, ang = Math.sin(t * (d.speed || 0.035) + (d.phase || 0)) * (d.swing || 0.42), bx = x + Math.sin(ang) * L, by = y + Math.cos(ang) * L;
      g.save(); g.strokeStyle = '#7a5c26'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(bx, by); g.stroke();
      g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a07c32'; g.beginPath(); g.arc(bx, by, d.bob || 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5d4519'; g.beginPath(); g.arc(bx + 1.5, by + 1.5, (d.bob || 9) * 0.62, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,235,170,0.5)'; g.beginPath(); g.arc(bx - 2.5, by - 2.5, (d.bob || 9) * 0.25, 0, Math.PI * 2); g.fill();
      g.restore(); break; }
    case 'img': { const im = IMG[d.img], sc = d.scale || 1, w = Math.round(im.width * sc), h = Math.round(im.height * sc); g.drawImage(im, Math.round(x - w / 2), y - h + (d.sink === undefined ? (SINK[d.img] || 0) : d.sink), w, h); break; }
    case 'hang': { const im = IMG[d.img], sc = d.scale || 1, w = Math.round(im.width * sc), h = Math.round(im.height * sc); g.drawImage(im, Math.round(x - w / 2), y, w, h); break; }       // hangs from the top edge (banners, a caged skeleton)
    case 'voidpit': {          // a pit with no bottom (the Pit of Despair): the scenery fades into black below the banks, behind the planks and the hero.  x = its middle, y = the floor's row, w = its width, in pixels
      const w = d.w, top = y - 6, h = (room && room.ph ? room.ph - d.y : 128) + 40, gr = g.createLinearGradient(0, top, 0, top + Math.min(h, 90)); gr.addColorStop(0, 'rgba(2,0,6,0)'); gr.addColorStop(0.35, 'rgba(2,0,6,0.8)'); gr.addColorStop(1, 'rgba(1,0,3,1)');
      g.fillStyle = gr; g.fillRect(Math.round(x - w / 2), top, w, Math.min(h, 90)); g.fillStyle = 'rgb(1,0,3)'; if (h > 90) g.fillRect(Math.round(x - w / 2), top + 90, w, h - 90); break; }
    case 'waterfall': case 'spill': break;          // (waterfalls, spills and streams are water in the effects layer now: fx.setWater)
    case 'portrait': drawFramedPortrait(g, x, y, { ci: d.ci, a: d.emo, frame: d.frame }); break;          // a framed portrait on the wall: x = its centre, y = the bottom edge of the frame (see portraitart.js)
    case 'icicles': {          // a cluster of icicles hanging from the ceiling: x the middle, y the top
      const n = d.n || 2; for (let i = 0; i < n; i++) { const hs = k => { const q = Math.sin(d.x * 12.9898 + i * 78.233 + k * 4.1) * 43758.5453; return q - Math.floor(q); }, ox = (i - (n - 1) / 2) * 7 + (hs(1) - 0.5) * 4, len = 16 + hs(2) * 26, w = 3 + hs(3) * 3;
        g.fillStyle = 'rgba(120,190,225,0.9)'; g.beginPath(); g.moveTo(x + ox - w, y); g.lineTo(x + ox + w, y); g.lineTo(x + ox, y + len); g.closePath(); g.fill();
        g.fillStyle = 'rgba(225,246,255,0.85)'; g.beginPath(); g.moveTo(x + ox - w, y); g.lineTo(x + ox - 1, y); g.lineTo(x + ox - 1, y + len * 0.8); g.closePath(); g.fill();
        if (Math.sin(t * 0.04 + i + d.x) > 0.96) { g.fillStyle = '#fff'; g.fillRect(Math.round(x + ox), Math.round(y + len * 0.6), 1, 1); } }
      break; }
    case 'crystals': {          // blue-white crystals growing out of the floor: a cold glint that comes and goes
      const n = d.n || 3; for (let i = 0; i < n; i++) { const hs = k => { const q = Math.sin(d.x * 9.1 + i * 31.7 + k * 5.3) * 43758.5453; return q - Math.floor(q); }, ox = (i - (n - 1) / 2) * 7 + (hs(1) - 0.5) * 4, h = 12 + hs(2) * 22, w = 3 + hs(3) * 2.5, lean = (hs(4) - 0.5) * 6;
        g.fillStyle = '#4a98c0'; g.beginPath(); g.moveTo(x + ox - w, y); g.lineTo(x + ox - w * 0.6 + lean, y - h * 0.8); g.lineTo(x + ox + lean, y - h); g.lineTo(x + ox + w * 0.6 + lean, y - h * 0.8); g.lineTo(x + ox + w, y); g.closePath(); g.fill();
        g.fillStyle = '#9ad8f0'; g.beginPath(); g.moveTo(x + ox - w, y); g.lineTo(x + ox - w * 0.6 + lean, y - h * 0.8); g.lineTo(x + ox + lean, y - h); g.lineTo(x + ox + lean * 0.5, y); g.closePath(); g.fill();
        const gl = 0.5 + 0.5 * Math.sin(t * 0.05 + i * 2 + d.x); g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * gl).toFixed(2) + ')'; g.fillRect(Math.round(x + ox + lean - 1), Math.round(y - h * 0.7), 1, 3); }
      break; }
    case 'dgtorch': drawSheet(g, 'dg_torch', Math.floor(t / 6 + d.x) % 4, x, y); break;
    case 'shutcase': {         // a bookcase standing over a hidden door (levelgen's hiddenDoor): once the flag d.flag is set it stands aside, and the door is there
      const aside = room && room.flags && room.flags[d.flag]; drawDeco(g, { t: 'bookcase', x: d.x - (aside ? 34 : 0), y: d.y }, cx, cy, t, room);
      if (aside) { g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(x - 17 + k * 9, y - 2, 6, 1); } break; }          // (the scrape it left in the dust)
    case 'rug': {          // a red rug with a gold border.  x = its middle, y = the floor
      const w = d.w || 96, x0 = Math.round(x - w / 2);
      g.fillStyle = '#5c1d27'; g.fillRect(x0, y - 3, w, 3); g.fillStyle = '#84303a'; g.fillRect(x0 + 4, y - 3, w - 8, 2); g.fillStyle = '#c9a14a'; g.fillRect(x0 + 2, y - 3, 2, 3); g.fillRect(x0 + w - 4, y - 3, 2, 3);
      for (let bx = x0 + 10; bx < x0 + w - 10; bx += 12) g.fillRect(bx, y - 2, 3, 1); g.fillStyle = '#d9c9a0'; for (let k = 0; k < 3; k++) { g.fillRect(x0 - 3, y - 3 + k, 3, 1); g.fillRect(x0 + w, y - 3 + k, 3, 1); } break; }
    case 'hearth': {          // a stone fireplace: a mantel with a few things on it, a dark firebox with logs (the fire itself is lit by the effects layer: roomFlames)
      g.fillStyle = '#4a4352'; g.fillRect(x - 24, y - 40, 48, 40); g.fillStyle = '#625a6c';
      for (let row = 0; row < 5; row++) for (let bx = x - 23 + (row % 2 ? 6 : 0); bx < x + 22; bx += 12) g.fillRect(bx, y - 39 + row * 8, Math.min(10, x + 23 - bx), 6);
      g.fillStyle = '#12080a'; g.fillRect(x - 14, y - 24, 28, 24); g.beginPath(); g.arc(x, y - 24, 14, Math.PI, 0); g.fill();
      const gl = 0.5 + 0.12 * Math.sin(t * 0.21) + 0.08 * Math.sin(t * 0.47); g.fillStyle = 'rgba(255,120,40,' + (gl * 0.5).toFixed(2) + ')'; g.fillRect(x - 12, y - 12, 24, 10);
      g.fillStyle = '#3a2415'; g.fillRect(x - 11, y - 5, 22, 3); g.fillStyle = '#5a3a22'; g.fillRect(x - 8, y - 8, 16, 3); g.fillStyle = '#2a2430'; g.fillRect(x - 16, y - 2, 32, 2);
      g.fillStyle = '#4a2f18'; g.fillRect(x - 27, y - 45, 54, 5); g.fillStyle = '#7a5230'; g.fillRect(x - 27, y - 45, 54, 1); // the mantel, and the stone chimney going up to the ceiling
      g.fillStyle = '#3d3745'; g.fillRect(x - 15, y - 160, 30, 115); g.fillStyle = '#524b5c'; for (let row = 0; row < 14; row++) for (let bx = x - 14 + (row % 2 ? 5 : 0); bx < x + 13; bx += 10) g.fillRect(bx, y - 159 + row * 8, Math.min(8, x + 14 - bx), 6); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 7, y - 160, 8, 115);
      g.fillStyle = '#c9a14a'; g.fillRect(x - 22, y - 52, 3, 7); g.fillRect(x - 23, y - 46, 5, 1); g.fillStyle = '#2c4a6e'; g.fillRect(x + 12, y - 54, 4, 9); g.fillStyle = '#7a1e2a'; g.fillRect(x + 17, y - 52, 3, 7); g.fillStyle = '#3c6a40'; g.fillRect(x + 21, y - 53, 3, 8); break; }
    case 'armchair': {          // a deep armchair facing right, toward the fire
      g.fillStyle = '#2a1a10'; g.fillRect(x - 12, y - 4, 3, 4); g.fillRect(x + 8, y - 4, 3, 4);
      g.fillStyle = '#2f4a38'; g.fillRect(x - 14, y - 34, 9, 30); g.beginPath(); g.arc(x - 9.5, y - 34, 4.5, Math.PI, 0); g.fill(); g.fillRect(x - 6, y - 14, 18, 10);
      g.fillStyle = '#45664d'; g.fillRect(x - 13, y - 33, 2, 28); g.fillRect(x - 6, y - 15, 17, 3); g.fillStyle = '#24372a'; g.fillRect(x - 6, y - 20, 16, 4); g.fillRect(x + 9, y - 18, 4, 14);
      g.fillStyle = '#b9833c'; g.fillRect(x - 5, y - 23, 6, 8); g.fillStyle = '#d9a85a'; g.fillRect(x - 5, y - 23, 6, 1); break; }          // (a cushion)
    case 'cat': {          // a cat curled up asleep: it breathes, and now and then an ear twitches
      const br = Math.sin(t * 0.035 + d.x) > 0 ? 1 : 0, ear = (t + Math.round(d.x)) % 460 < 10 ? 1 : 0;
      g.fillStyle = '#b9682c'; g.beginPath(); g.ellipse(x, y - 5 - br * 0.5, 9, 4.5 + br * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d98a44'; g.fillRect(x - 5, y - 9 - br, 2, 4); g.fillRect(x - 1, y - 10 - br, 2, 4); g.fillRect(x + 3, y - 9 - br, 2, 3);
      g.fillStyle = '#c9762f'; g.beginPath(); g.arc(x + 8, y - 6, 4, 0, Math.PI * 2); g.fill(); g.fillRect(x + 5, y - 12 + ear, 2, 3); g.fillRect(x + 10, y - 11, 2, 3);
      g.fillStyle = '#4a2810'; g.fillRect(x + 7, y - 7, 2, 1); g.fillRect(x + 10, y - 7, 2, 1); g.fillStyle = '#a8561f'; g.fillRect(x - 9, y - 3, 13, 2); g.fillStyle = '#efd9b0'; g.fillRect(x + 3, y - 3, 3, 2); break; }
    case 'altarledge': {          // the wall behind the altar candles and the stone ledge they stand on.  x = its middle, y = the floor, w = its width; marks = where (from the middle) a candle's soot has blackened the wall
      const w = d.w || 184, x0 = Math.round(x - w / 2), led = y - 40, top = led - 66;
      g.fillStyle = '#3b3546'; g.fillRect(x0 + 3, top - 3, w - 6, led - top + 3); g.fillStyle = '#6a6276'; g.fillRect(x0 + 6, top, w - 12, led - top);          // a pale stone panel in a frame
      g.fillStyle = '#5b5467'; for (let row = 0; row < 5; row++) { g.fillRect(x0 + 6, top + 13 + row * 13, w - 12, 1); for (let bx = x0 + 22 + (row % 2) * 14; bx < x0 + w - 10; bx += 28) g.fillRect(bx, top + row * 13, 1, 13); }
      for (const off of d.marks || []) { const mx = Math.round(x + off), my = led - 46;          // soot: a smudge shaped like a flame, darkest low down, fading as it rises
        g.save(); g.fillStyle = '#17101a'; for (const [dy, rx, ry, a] of [[5, 8, 8, 0.34], [3, 5.5, 8, 0.42], [-4, 4, 8, 0.34], [-11, 2.4, 6, 0.28], [6, 3.5, 4, 0.4]]) { g.globalAlpha = a; g.beginPath(); g.ellipse(mx, my + dy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 0.4; for (let k = 0; k < 9; k++) g.fillRect(mx - 9 + ((k * 37) % 19), my - 14 + ((k * 23) % 27), 1, 1); g.restore(); }
      g.fillStyle = '#4a4352'; g.fillRect(x0, led, w, 6); g.fillStyle = '#8a8299'; g.fillRect(x0, led, w, 1); g.fillStyle = '#26212e'; g.fillRect(x0 + 2, led + 6, w - 4, 2);          // the ledge
      g.fillStyle = '#4a4352'; for (const bx of [x0 + 4, x0 + w - 8]) { g.fillRect(bx, led + 8, 4, 7); g.fillRect(bx + 1, led + 15, 2, 3); } break; }
    case 'bog': {          // the mire behind a causeway: dark water with scum and slow ripples, and a few reeds.  x = its middle, y = the floor, w = its width
      const w = d.w, x0 = Math.round(x - w / 2);
      g.fillStyle = '#0d1a14'; g.fillRect(x0, y - 14, w, 14); g.fillStyle = '#1b3226'; g.fillRect(x0, y - 14, w, 2);
      g.fillStyle = 'rgba(130,175,110,0.35)'; for (let k = 0; k < w / 14; k++) g.fillRect(x0 + ((k * 37 + Math.floor(t / 24)) % (w - 6)), y - 11 + ((k * 7) % 8), 4 + (k % 3) * 2, 1);
      g.fillStyle = '#35522e'; for (let k = 0; k < w / 40; k++) { const rx = x0 + 12 + ((k * 97) % (w - 24)); for (let j = 0; j < 3; j++) { const h = 12 + ((k * 13 + j * 7) % 14); g.fillRect(rx + j * 3, y - 12 - h, 1, h); } } break; }
    case 'bookcase': {         // a tall bookcase drawn in code: oak frame, three shelves of books in a dozen colours (the same books every time for the same place)
      const W = 30, H = 46, x0 = x - 15, y0 = y - H, hh = n => { const s = Math.sin(d.x * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
      const cols = ['#7a1e2a', '#2c4a6e', '#3c6a40', '#8a6a2a', '#5a2c6c', '#a8884a', '#2a2a3c', '#6a3a1a'];
      g.fillStyle = '#17100c'; g.fillRect(x0, y0, W, H);
      for (let s = 0; s < 3; s++) {
        const floor = y0 + 15 + s * 14; let bx = x0 + 2, k = 0;
        while (bx < x0 + W - 3) {
          const bw = 2 + Math.floor(hh(s * 40 + k) * 3), bh = 7 + Math.floor(hh(s * 40 + k + 100) * 5); k++;
          if (hh(s * 40 + k + 200) < 0.08) { bx += 3; continue; }                                           // a gap on the shelf
          g.fillStyle = cols[Math.floor(hh(s * 40 + k + 300) * cols.length)]; g.fillRect(bx, floor - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(bx, floor - bh, 1, bh); bx += bw;
        }
        g.fillStyle = '#5a3a22'; g.fillRect(x0 + 1, floor, W - 2, 2); g.fillStyle = '#7a5230'; g.fillRect(x0 + 1, floor, W - 2, 1);        // the shelf board
      }
      g.fillStyle = '#3a2418'; g.fillRect(x0, y0, 2, H); g.fillRect(x0 + W - 2, y0, 2, H); g.fillRect(x0 - 1, y0 - 2, W + 2, 3); g.fillStyle = '#7a5230'; g.fillRect(x0 - 1, y0 - 2, W + 2, 1);       // frame and cornice
      g.fillStyle = '#2a1a10'; g.fillRect(x0 - 1, y - 2, W + 2, 2); break;                                  // plinth
    }
    case 'barwin': {           // a barred window: dark glass with a streak of moonlight behind iron bars, in a stone arch
      const w = 20, h = 30, x0 = x - w / 2, top = y - h;
      g.fillStyle = '#4a4458'; g.beginPath(); g.moveTo(x0 - 2, y + 1); g.lineTo(x0 - 2, top + 8); g.arc(x, top + 8, w / 2 + 2, Math.PI, 0); g.lineTo(x0 + w + 2, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#10141f'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0, top + 8); g.arc(x, top + 8, w / 2, Math.PI, 0); g.lineTo(x0 + w, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,150,200,0.2)'; g.fillRect(x0 + 2, top + 5, 5, h - 7);
      g.fillStyle = '#2c2c3a'; for (let i = 0; i < 4; i++) g.fillRect(x0 + 2 + i * 5, top + 2, 2, h - 2);
      g.fillStyle = '#3a3a4c'; g.fillRect(x0, top + 14, w, 2); g.fillStyle = '#6a647a'; g.fillRect(x0 - 3, y, w + 6, 2); break;
    }
    case 'column': { const im = room.theme === 'throne' ? extra().throne_col : IMG.church_column; g.drawImage(im, Math.round(x - im.width / 2), y - im.height + 6); break; }
    case 'torch': drawSheet(g, 'torch', 0, x, y); break;
    case 'cdl': { const im = IMG[cdlOf(d).img]; if (im) g.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height) + CDL_DROP); else drawSheet(g, 'candelabra', 0, x, y); break; }
    case 'brazier': drawSheet(g, 'brazier', 0, x, y); break;
    case 'banner': {
      const len = (d.len || 5) * T, w = 20, sway = Math.sin(t * 0.03 + d.x * 0.05) * 2, top = y - 0; g.fillStyle = d.color || '#7a1e2a';
      g.fillRect(x - w / 2, top, w, len - 6); g.beginPath(); g.moveTo(x - w / 2, top + len - 6); g.lineTo(x + w / 2, top + len - 6); g.lineTo(x + w / 2 + sway, top + len + 2); g.lineTo(x + sway * 0.5, top + len - 4); g.lineTo(x - w / 2 + sway, top + len + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 2, top, w / 2 - 2, len - 6);
      g.fillStyle = '#c9a14a'; g.fillRect(x - w / 2 - 1, top, w + 2, 3); g.fillRect(x - 1, top + 12, 2, 10); g.fillRect(x - 4, top + 15, 8, 2); g.fillRect(x - 3, top + 24, 6, 1); break;
    }
    case 'door': {
      if (d.hid && !(room && room.flags && room.flags[d.hid])) break;          // (a hidden door: not there until its flag is set)
      const sprite = d.kind === 'crypt' ? IMG.dg_arch : IMG.dg_door; if (sprite) { const w = Math.round(sprite.width * 0.5), h = Math.round(sprite.height * 0.5); g.drawImage(sprite, Math.round(x - w / 2), y - h, w, h); break; }
      const wood = d.kind === 'wood', w = 30, h = 44;
      g.fillStyle = '#0a0612'; g.fillRect(x - w / 2, y - h, w, h); g.beginPath(); g.arc(x, y - h, w / 2, Math.PI, 0); g.fill();
      g.strokeStyle = wood ? '#5d5470' : '#6a6458'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w / 2 - 1, y); g.lineTo(x - w / 2 - 1, y - h); g.arc(x, y - h, w / 2 + 1, Math.PI, 0); g.lineTo(x + w / 2 + 1, y); g.stroke();
      if (wood) { g.fillStyle = '#4a2f18'; g.fillRect(x - w / 2 + 2, y - h + 4, w - 4, h - 4); g.fillStyle = '#6a4424'; for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + 3 + i * 7, y - h + 5, 1, h - 6); g.fillStyle = '#d9a93a'; g.fillRect(x + 6, y - 22, 3, 3); }
      else { g.fillStyle = '#1a1424'; g.fillRect(x - w / 2 + 3, y - h + 3, w - 6, h - 3); g.fillStyle = '#6a6458'; g.fillRect(x - 5, y - h + 8, 10, 2); g.fillRect(x - 1, y - h + 4, 2, 10); }
      break;
    }
    case 'grave': {          // HER grave: a mound of earth, a worn headstone, a few white flowers, and a candle burning with a blue flame - the one arcane light on the hill, where the ghost shows
      const flick = 0.85 + 0.15 * Math.sin(t * 0.3 + 1.7) + 0.08 * Math.sin(t * 0.8);
      g.fillStyle = '#17110e'; g.beginPath(); g.ellipse(x + 6, y - 1, 28, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#2a1f17'; g.beginPath(); g.ellipse(x + 6, y - 1, 25, 5, 0, Math.PI, 0); g.fill();
      const st = IMG.gy_stone_old || IMG.gy_stone; if (st) g.drawImage(st, Math.round(x - 13 - st.width / 2), y - 1 - st.height);          // the headstone (Graveyard pack), worn smooth
      for (const [nm, fx, up] of [['gy_lily', 1, 1], ['gy_rose', 8, 0], ['gy_daisy', 13, 0], ['gy_wreath', 5, 4]]) { const im = IMG[nm]; if (im) g.drawImage(im, Math.round(x + fx - im.width / 2 + 3), y - im.height + up - 1); }          // flowers on the mound
      g.fillStyle = '#ddd5c4'; g.fillRect(x + 17, y - 13, 3, 9); g.fillStyle = '#9a927f'; g.fillRect(x + 19, y - 13, 1, 9);
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x + 18.5, y - 18, 1, x + 18.5, y - 18, 26); gr.addColorStop(0, 'rgba(110,160,255,' + (0.5 * flick).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(110,160,255,0)'); g.fillStyle = gr; g.fillRect(x - 8, y - 44, 54, 54); g.restore();
      g.fillStyle = '#6a98ff'; g.beginPath(); g.moveTo(x + 17, y - 14); g.quadraticCurveTo(x + 15.5, y - 19, x + 18.5, y - 24 * flick + 2); g.quadraticCurveTo(x + 21.5, y - 19, x + 20, y - 14); g.closePath(); g.fill(); g.fillStyle = '#e8f2ff'; g.fillRect(x + 18, y - 18, 1, 3);
      break;
    }
    case 'padlock': {          // a padlock and crossed chains over a locked door, in the colour of its key (a faint glow); gone once the door has been opened
      const K = KEYS.find(k => k.id === d.key), F = (room && room.flags) || {}; if (F['unlocked_' + d.key]) break;
      const c = K ? K.rgb : [230, 200, 100], k = c.join(','), pulse = 0.5 + 0.5 * Math.sin(t * 0.07 + d.x), ly = y - 22;
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, ly, 1, x, ly, 20); gr.addColorStop(0, 'rgba(' + k + ',' + (0.32 + 0.14 * pulse).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + k + ',0)'); g.fillStyle = gr; g.fillRect(x - 20, ly - 20, 40, 40); g.restore();
      g.lineCap = 'butt'; for (const [col, w, off] of [['#1c1826', 3, 0], ['#8a86a2', 1, 0]]) { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(w === 1 ? [2, 2] : []); g.beginPath(); g.moveTo(x - 15, y - 38 + off); g.lineTo(x + 15, y - 7 + off); g.moveTo(x + 15, y - 38 + off); g.lineTo(x - 15, y - 7 + off); g.stroke(); } g.setLineDash([]);
      g.fillStyle = '#12101a'; g.fillRect(x - 7, ly - 6, 14, 12); g.fillStyle = 'rgb(' + k + ')'; g.fillRect(x - 6, ly - 5, 12, 10); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 6, ly - 5, 12, 2);
      g.strokeStyle = '#b9c0d0'; g.lineWidth = 2; g.beginPath(); g.arc(x, ly - 6, 4.5, Math.PI, 0); g.stroke(); g.fillStyle = '#1a1020'; g.fillRect(x - 1, ly - 2, 2, 4);
      break;
    }
    case 'sigils': {          // the sigils of a door that is locked until bosses fall: an ALCHEMICAL SYMBOL for each, dark and cold until its boss is dead, then burning with a small steady flame; the door is barred until they all burn
      const fl = d.flags || [], n = fl.length, F = (room && room.flags) || {}, lit = fl.filter(f => F[f]).length;
      if (lit < n) { g.fillStyle = 'rgba(8,4,16,0.55)'; g.fillRect(x - 15, y - 44, 30, 44); g.fillStyle = '#2c2838'; g.fillRect(x - 15, y - 36, 30, 3); g.fillRect(x - 15, y - 16, 30, 3); g.fillStyle = '#4a4458'; g.fillRect(x - 1, y - 44, 2, 44); }
      for (let i = 0; i < n; i++) {
        const sx = x + Math.round((i - (n - 1) / 2) * 17), sy = y - 56, on = !!F[fl[i]], fk = 0.8 + 0.2 * Math.sin(t * 0.17 + i * 2.3) + 0.08 * Math.sin(t * 0.41 + i);
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        if (on) {          // lit: a warm glow, the symbol in gold, and a little flame standing on it
          g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(sx, sy - 3, 1, sx, sy - 3, 15); gr.addColorStop(0, 'rgba(255,170,70,' + (0.30 * fk).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(sx - 15, sy - 18, 30, 30); g.globalCompositeOperation = 'source-over';
        } else { g.fillStyle = 'rgba(6,3,12,0.7)'; g.beginPath(); g.arc(sx, sy, 9, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = on ? '#050208' : '#050208'; g.lineWidth = 3.2; glyph(g, SIGIL_OF[fl[i]] || SIGILS_BY_ORDER[i % SIGILS_BY_ORDER.length], sx, sy);          // (a dark edge, so it reads on any wall)
        g.strokeStyle = on ? 'rgba(255,214,130,' + (0.82 + 0.18 * fk).toFixed(3) + ')' : '#5d5772'; g.lineWidth = 1.4; glyph(g, SIGIL_OF[fl[i]] || SIGILS_BY_ORDER[i % SIGILS_BY_ORDER.length], sx, sy);
        if (on) {          // the flame: small, soft, never still
          const h = 6 + 2.4 * fk + 1.2 * Math.sin(t * 0.33 + i * 1.7), fx = sx + Math.sin(t * 0.21 + i) * 0.9, fy = sy - 8;
          g.fillStyle = 'rgba(255,120,30,0.78)'; g.beginPath(); g.moveTo(fx - 2.4, fy); g.quadraticCurveTo(fx - 2.6, fy - h * 0.55, fx + Math.sin(t * 0.3 + i) * 0.8, fy - h); g.quadraticCurveTo(fx + 2.6, fy - h * 0.5, fx + 2.4, fy); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,226,140,0.9)'; g.beginPath(); g.moveTo(fx - 1.2, fy); g.quadraticCurveTo(fx - 1.3, fy - h * 0.35, fx, fy - h * 0.62); g.quadraticCurveTo(fx + 1.3, fy - h * 0.3, fx + 1.2, fy); g.closePath(); g.fill();
        }
        g.restore();
      }
      break;
    }
    case 'gate': { // closed iron gate at the start (flavour)
      g.fillStyle = '#181420'; g.fillRect(x - 8, y - 96, 56, 96);
      g.fillStyle = '#2c2838'; for (let i = 0; i < 7; i++) { g.fillRect(x - 6 + i * 8, y - 90, 3, 90); g.fillRect(x - 7 + i * 8, y - 94, 5, 5); }
      g.fillRect(x - 8, y - 60, 56, 3); g.fillRect(x - 8, y - 20, 56, 3); g.fillStyle = '#4a4458'; g.fillRect(x - 10, y - 100, 6, 100); g.fillRect(x + 44, y - 100, 6, 100); break;
    }
  }
}

const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// A building fire drawn as a real flame: a fat body with a rounded foot that fades into the wall, and a leaping top edge - several sharp licks that rise and fall at
// their own pace, drift sideways and lean downwind. Three nested layers (red outer, orange middle, yellow-white core), each licking differently, add up to the glowing look.
function flameLayer(g, x, y, W, H, t, seed, lean, stops) {
  const N = Math.max(8, Math.min(22, Math.round(W))), nl = W > 20 ? 4 : W > 11 ? 3 : 2, L = [], foot = W * 0.2;
  for (let j = 0; j < nl; j++) { const hj = hash(seed, j + 11); L.push({ c: (hj - 0.5) * 1.2 + 0.3 * Math.sin(t * (0.045 + 0.025 * j) + hj * 6.28), w: 0.3 + 0.16 * hash(seed, j + 21), a: 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.17 + 0.06 * j) + hj * 9)) }); }
  g.beginPath();
  for (let i = 0; i <= N; i++) {                                                                                // the top edge, left to right
    const u = (i / N) * 2 - 1, env = Math.max(0, 1 - Math.pow(Math.abs(u), 1.5)); let m = 0.3 * env;           // fat in the middle, tapering away at the sides
    for (const l of L) m = Math.max(m, env * l.a * Math.pow(Math.max(0, 1 - Math.abs(u - l.c) / l.w), 1.15));    // each lick is a sharp peak
    const px = x + u * W / 2 + lean * m * m, py = y - H * m; if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  for (let i = N; i >= 0; i--) { const u = (i / N) * 2 - 1; g.lineTo(x + u * W / 2, y + foot * Math.sqrt(Math.max(0, 1 - u * u))); }     // the round foot, right to left
  g.closePath();
  const lg = g.createLinearGradient(0, y + foot, 0, y - H); for (const [o, c] of stops) lg.addColorStop(o, c);
  g.fillStyle = lg; g.fill();
}
function drawBlaze(g, x, y, S, seed, t, dx = 0) {
  const bend = dx * Math.min(1, 0.35 + S * 0.4);                                                      // a gust flattens and bends it (the small fires less far)
  S *= 1 - Math.min(0.25, Math.abs(dx) / 40);
  const W = 15 * S, H = 33 * S, lean = W * (0.16 + 0.1 * Math.sin(t * 0.05 + seed)) + bend * 1.1;
  g.save(); g.translate(x, y + S); g.scale(1, 0.34);                                                            // a bed of glowing embers the flame grows out of: soft and round
  const eb = 9 * S, bg = g.createRadialGradient(0, 0, 0, 0, 0, eb); bg.addColorStop(0, 'rgba(255,200,100,0.4)'); bg.addColorStop(0.55, 'rgba(255,120,30,0.22)'); bg.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = bg; g.fillRect(-eb, -eb, eb * 2, eb * 2); g.restore();
  flameLayer(g, x, y, W, H, t, seed, lean, [[0, 'rgba(230,60,15,0)'], [0.14, 'rgba(235,75,20,0.6)'], [0.55, 'rgba(255,110,25,0.55)'], [1, 'rgba(190,35,10,0)']]);
  flameLayer(g, x, y, W * 0.68, H * 0.72, t * 1.1, seed + 5, lean * 0.7, [[0, 'rgba(255,160,40,0)'], [0.16, 'rgba(255,170,55,0.65)'], [0.6, 'rgba(255,195,80,0.55)'], [1, 'rgba(255,140,40,0)']]);
  flameLayer(g, x, y, W * 0.36, H * 0.42, t * 1.25, seed + 9, lean * 0.4, [[0, 'rgba(255,240,170,0)'], [0.2, 'rgba(255,245,190,0.75)'], [1, 'rgba(255,225,130,0)']]);
}

// THE FIRE IN THE BELL TOWER.  The very same blazes that burn the houses of Prague (see drawBlaze above - three nested flames, red, orange and a pale core, each licking at its own pace), but packed close, in four ranks
// that stand one behind the other and all swell and die back at their own pace, on a bed of dark red coals that fades to black below.  `y` is the front line of the fire on the screen, `cx` the camera's x (the blazes stand
// still in the world while the camera slides past them).
export function drawFireWall(g, cx, y, t, width = 384) {
  g.save();
  const bed = g.createLinearGradient(0, y, 0, y + 80); bed.addColorStop(0, 'rgba(120,24,6,0)'); bed.addColorStop(0.12, 'rgba(150,34,8,0.92)'); bed.addColorStop(0.5, 'rgba(78,14,6,0.97)'); bed.addColorStop(1, 'rgba(28,6,4,1)');
  g.fillStyle = bed; g.fillRect(0, y, width, 520);
  for (let i = 0; i < 18; i++) { const ex = ((i * 71 + 17 - cx * 0.9) % (width + 60) + width + 60) % (width + 60) - 30, ey = y + 10 + ((hash(i, 3) * 40) | 0), fl = 0.5 + 0.5 * Math.sin(t * 0.07 + i * 2.3); g.fillStyle = 'rgba(255,' + (110 + ((hash(i, 5) * 80) | 0)) + ',40,' + (0.12 + 0.2 * fl).toFixed(3) + ')'; g.fillRect(ex, ey, 6 + ((hash(i, 8) * 8) | 0), 2); }          // the coals glowing in the bed
  const ranks = [{ step: 15, dy: 34, S: 1.5, a: 0.8 }, { step: 12, dy: 26, S: 1.3, a: 0.9 }, { step: 10, dy: 20, S: 1.05, a: 1 }, { step: 9, dy: 16, S: 0.85, a: 1 }];          // (deepest first; each rank a little smaller, a little brighter and a little lower on the screen than the one behind it)
  ranks.forEach((rk, ri) => {
    g.globalAlpha = rk.a;
    for (let k = Math.floor((cx - 40) / rk.step); k * rk.step < cx + width + 40; k++) {
      const h1 = hash(k, ri * 7 + 3), h2 = hash(k, ri * 7 + 5), h3 = hash(k, ri * 7 + 9), h4 = hash(k, ri * 7 + 13);
      if (h4 < 0.13) continue;                                                                                // (a gap now and then, where a rank thins out and the one behind shows through)
      const wx = k * rk.step + (h1 - 0.5) * rk.step * 1.5, sx = wx - cx;                                      // (neighbours bunch together and drift apart: nothing is evenly spaced)
      const swell = Math.sin(wx * 0.035 + ri * 2.1 + t * 0.011) * 9 + Math.sin(wx * 0.011 - t * 0.006 + ri) * 7;          // (the whole front rises and sags in long slow waves, a different one in each rank)
      const S = rk.S * (0.5 + 1.0 * h2 * h2 + 0.25 * h3) * (1 + 0.24 * Math.sin(t * 0.045 + h1 * 11) + 0.1 * Math.sin(t * 0.14 + h3 * 7));          // each stands much taller or shorter than its neighbours, and swells and sinks
      drawBlaze(g, sx, y + rk.dy + swell + (h3 - 0.5) * 14, S, k * 13 + ri * 101, t, 0);
      if (h4 > 0.9) drawBlaze(g, sx + (h1 - 0.5) * 9, y + rk.dy + swell + (h2 - 0.5) * 10, S * 0.7, k * 17 + ri * 61, t * 1.07, 0);          // (and a few stand in pairs)
    }
  });
  g.restore();
}

// A flame drawn into the 2D scene (additive tongues + a soft glow), so sprites drawn after it - the hero, enemies - stand in FRONT of it.
// (The three.js layer sits on top of every sprite, so fires made there always burn over the hero.)
export function drawFlames2D(g, flames, cx, cy, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of flames) {
    if (!f.behind) continue; const x = f.x - cx, y = f.y - cy; if (x < -80 || x > 464 || y < -90 || y > 300) continue;
    const big = !!f.big, sc = big ? (f.fs || 1) : (f.scale || 1) * 0.42, seed = f.seed || 0, fl = 0.85 + 0.15 * Math.sin(t * 0.37 + seed) + 0.08 * Math.sin(t * 0.91 + seed * 2.3);
    if (f.blaze) {            // building fires swell and die back slowly, so neighbours are rarely the same size at the same moment
      const S = sc * (1 + 0.2 * Math.sin(t * 0.04 + seed * 1.9) + 0.08 * Math.sin(t * 0.13 + seed * 0.7)), R = 24 * S * fl, gy = y - 8 * S, gr = g.createRadialGradient(x, gy, 1, x, gy, R);
      gr.addColorStop(0, 'rgba(255,150,60,' + (f.small ? 0.26 : 0.32) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(x - R, gy - R, R * 2, R * 2);
      drawBlaze(g, x, y, S, seed, t, f.dx || 0); continue;
    }
    const R = (big ? 30 : 16) * sc * fl, gy = y - 9 * sc, gr = g.createRadialGradient(x, gy, 1, x, gy, R);       // soft glow
    gr.addColorStop(0, 'rgba(255,150,60,' + (big ? 0.34 : 0.3) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(x - R, gy - R, R * 2, R * 2);
    const n = big ? 4 : 1;
    for (let i = 0; i < n; i++) {                                                                                   // flame tongues
      const ph = seed * 1.7 + i * 1.9, h = (big ? 18 + 12 * Math.sin(t * 0.21 + ph) + 6 * Math.sin(t * 0.53 + ph * 1.3) + i * 3 : 10 + 3 * Math.sin(t * 0.4 + ph)) * sc * (big ? 0.95 : 1), w = (big ? 7 - i : 3.4) * sc, sway = Math.sin(t * 0.17 + ph) * (big ? 3 : 1) * sc + (f.dx || 0) * 0.6, bx = x + (big ? (i - 1.5) * 3 * sc : 0);
      const lg = g.createLinearGradient(0, y, 0, y - h); lg.addColorStop(0, 'rgba(255,235,160,0.95)'); lg.addColorStop(0.35, 'rgba(255,140,40,0.85)'); lg.addColorStop(1, 'rgba(190,40,10,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(bx - w, y); g.quadraticCurveTo(bx - w * 0.9 + sway * 0.5, y - h * 0.55, bx + sway, y - h); g.quadraticCurveTo(bx + w * 0.9 + sway * 0.5, y - h * 0.55, bx + w, y); g.closePath(); g.fill();
    }
  }
  g.restore();
}

// flowing water on the floor (the Cistern): a translucent knee-deep sheet drawn OVER the hero's legs, with streaks of foam sliding along it the way the water runs

// where the three wicks of the candelabrum standing at (d.x, d.y) are (the puzzle's candelabras light and darken them: props.js PuzzleCandle)
export const candelabraWicks = d => cdlOf(d).fl.map(([ox, oy]) => [d.x + ox, d.y + oy + CDL_DROP]);

// flames that must be lit for this room's decor
export function roomFlames(room) {
  const out = [];
  for (const d of room.decos) {
    if (d.t === 'torch') out.push({ x: d.x, y: d.y - 15, scale: 1.1, seed: d.x, light: 80 });
    else if (d.t === 'cdl') cdlOf(d).fl.forEach(([ox, oy], i) => out.push({ x: d.x + ox, y: d.y + oy + CDL_DROP, scale: i === 1 ? 1 : 0.8, seed: d.x + ox, light: i === 1 ? 60 : 0, behind: true }));
    else if (d.t === 'blaze') {      // a building fire (none once the Cinder Warden is dead: the city only smoulders - see Game.smokeSpots)
      if (room.fireOut) continue;
      if (d.burn && !(room.flags && room.flags.village_fire) && !(room.ignited && room.ignited.has(d.burn))) continue;          // (a house's fires are unlit until a torch lands on it, or the village burns) (no sprite - just fire): windows burn big, and many small fires burn all over the walls and roof. Each is a little bigger or smaller than its scale says
      const sc = d.scale || 1.5, small = !!d.small, j = 0.82 + 0.36 * hash(d.x, d.y);
      out.push({ x: d.x, y: d.y, fs: sc * 1.35 * j, seed: d.x + d.y, ph: Math.floor(hash(d.y, d.x) * 97), light: small ? 0 : Math.round(130 * (0.75 + 0.25 * j)), big: true, blaze: true, small, smoke: true, behind: true });
    }
    else if (d.t === 'dgtorch') out.push({ x: d.x, y: d.y - 44, light: 90, lightOnly: true });      // the flame is part of the sprite: it only needs to light the room
    else if (d.t === 'hearth') out.push({ x: d.x, y: d.y - 8, fs: 0.85, seed: d.x, light: 140, big: true, blaze: true, behind: true });          // (the fire in the Book Nook's fireplace)
    else if (d.t === 'brazier') out.push({ x: d.x, y: d.y - 17, fs: 0.95, seed: d.x, light: 110, big: true, blaze: true, behind: true });      // the bowl's rim is 18px above the base of its sprite: the fire sits IN the bowl (a real flame outline - no flat edge - a little smaller than it used to be)
  }
  return out;
}
