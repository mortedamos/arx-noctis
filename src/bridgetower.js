// The STONE BRIDGE TOWER, the Gothic gate that guards the Prague end of the Stone Bridge (the game calls it that because the names "Old Town Bridge Tower" and "Charles Bridge" are younger than 1541, when the game is set;
// it is the tower that now stands as Staroměstská mostecká věž): begun in 1357 under Charles IV and designed by Peter Parler, whose workshop carved the front.  Drawn in code, after a photograph of the real tower, the way
// the Orloj Tower is - and in STONE ONLY: dark, soot-brown sandstone, with the statues pale against it, as they are in life.  From the foot up: a great pointed gateway (the altar of the Stone Bridge Tower stands in it), a band of
// plain stone shields, one tall pointed arch over five statues (a saint and two patrons between two kings), a frieze of quatrefoils, a tier of four windows with two statues between them, a relief band, the corbelled gallery
// with its battlements, and a dark slate roof; slender turrets with slits stand at the corners.  The statues are the Graveyard pack's (the knight, the robed saints), recoloured to sandstone.  Drawn once on an off-screen
// canvas whose bottom edge is the ground.  Everything here is as it stood before 1541.
import { IMG } from './assets.js';

export const BT_W = 168, BT_H = 498;
let cache = null;
const hs = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// a sprite with its colours taken out: its light and dark mapped on to a ramp of sandstone (the Graveyard statues are mossy grey-green), optionally mirrored
function stoneOf(im, lo, hi, flip) {
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d');
  if (flip) { x.translate(im.width, 0); x.scale(-1, 1); } x.drawImage(im, 0, 0);
  try {
    const d = x.getImageData(0, 0, cv.width, cv.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const l = (0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]) / 255, t = Math.min(1, Math.max(0, (l - 0.08) * 1.35)); a[i] = lo[0] + (hi[0] - lo[0]) * t; a[i + 1] = lo[1] + (hi[1] - lo[1]) * t; a[i + 2] = lo[2] + (hi[2] - lo[2]) * t; }
    x.putImageData(d, 0, 0);
  } catch { /* (a picture the browser will not let us read: it is drawn as it is) */ }
  return cv;
}

export function bridgeTower() {
  if (cache) return cache;
  if (!IMG.gy_st1 || !IMG.gy_st3 || !IMG.gy_st6) return null;          // (the statues are not loaded yet: nothing is drawn, and it is tried again next frame)
  const cv = document.createElement('canvas'); cv.width = BT_W; cv.height = BT_H; const c = cv.getContext('2d');
  const Y = h => BT_H - h;                                                          // the y of a height (in px) above the ground
  const P = { L: '#8a7a66', S: '#6b5d4c', D: '#4a3f34', DD: '#221c17', N: '#0d0b0a', W: '#9c8c74', IRON: '#2a2520', LIT: 'rgba(255,240,210,0.16)',
    RF: '#46464e', RL: '#6a6a74', RD: '#26262c' };
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // masonry: courses of stone, a little different from one another, laid in the gaps of a dark mortar
  const wall = (x0, x1, h0, h1, seed) => {
    rect(x0, Y(h1), x1 - x0, h1 - h0, P.DD);
    for (let y = Y(h1), r = 0; y < Y(h0); y += 8, r++) for (let x = x0 - (r % 2 ? 8 : 0); x < x1; x += 16) {
      const bx = Math.max(x, x0), bw = Math.min(x + 16, x1) - bx, k = hs(x * 3.1 + seed, r), tone = k > 0.62 ? P.L : k > 0.2 ? P.S : P.D;
      if (bw > 1) { rect(bx, y, bw - 1, 7, tone); rect(bx, y, bw - 1, 1, P.LIT); rect(bx, y + 6, bw - 1, 1, 'rgba(0,0,0,0.2)'); }
    }
  };
  // a pointed arch: straight up to the spring height, then two curves meeting at the apex.  (cx, the foot h0, half-width hw, spring height hsp, apex height ha)
  const pointed = (cx, h0, hw, hsp, ha, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx - hw, Y(h0)); c.lineTo(cx - hw, Y(hsp)); c.quadraticCurveTo(cx - hw, Y(ha - 6), cx, Y(ha)); c.quadraticCurveTo(cx + hw, Y(ha - 6), cx + hw, Y(hsp)); c.lineTo(cx + hw, Y(h0)); c.closePath(); c.fill(); };
  const outline = (cx, h0, hw, hsp, ha, col, w = 1) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(cx - hw, Y(hsp)); c.quadraticCurveTo(cx - hw, Y(ha - 6), cx, Y(ha)); c.quadraticCurveTo(cx + hw, Y(ha - 6), cx + hw, Y(hsp)); c.stroke(); };
  // a slim pointed window or slit, dark, with a stone frame and a mullion
  const win = (cx, h0, w, h1, glow) => { pointed(cx, h0, w / 2 + 2, h1 - w, h1 + 2, P.W); pointed(cx, h0 + 1, w / 2, h1 - w, h1, glow ? '#1d1812' : P.N); rect(cx, Y(h1 - 2), 1, h1 - h0 - 2, P.D); if (glow) { rect(cx - w / 2 + 1, Y(h0 + 8), w - 2, 6, '#2c2216'); } };
  // a little gable over a statue, with a crocket at each side and a finial
  const gablet = (cx, h, hw, ht) => { c.fillStyle = P.W; c.beginPath(); c.moveTo(cx - hw, Y(h)); c.lineTo(cx, Y(h + ht)); c.lineTo(cx + hw, Y(h)); c.closePath(); c.fill(); c.fillStyle = P.D; c.beginPath(); c.moveTo(cx - hw + 2, Y(h)); c.lineTo(cx, Y(h + ht - 3)); c.lineTo(cx + hw - 2, Y(h)); c.closePath(); c.fill(); rect(cx - 1, Y(h + ht + 4), 2, 5, P.W); };
  // a plain stone shield with a little relief
  const shield = (cx, h, k) => {
    c.fillStyle = P.DD; c.beginPath(); c.moveTo(cx - 6, Y(h + 16)); c.lineTo(cx + 6, Y(h + 16)); c.lineTo(cx + 6, Y(h + 8)); c.lineTo(cx, Y(h)); c.lineTo(cx - 6, Y(h + 8)); c.closePath(); c.fill();
    c.fillStyle = P.W; c.beginPath(); c.moveTo(cx - 5, Y(h + 15)); c.lineTo(cx + 5, Y(h + 15)); c.lineTo(cx + 5, Y(h + 8)); c.lineTo(cx, Y(h + 2)); c.lineTo(cx - 5, Y(h + 8)); c.closePath(); c.fill();
    c.fillStyle = P.S; if (k % 3 === 0) { rect(cx - 1, Y(h + 13), 2, 10, P.S); rect(cx - 3, Y(h + 10), 6, 2, P.S); } else if (k % 3 === 1) { rect(cx - 4, Y(h + 13), 8, 2, P.S); rect(cx - 4, Y(h + 9), 8, 2, P.S); } else { c.beginPath(); c.moveTo(cx - 3, Y(h + 12)); c.lineTo(cx, Y(h + 8)); c.lineTo(cx + 3, Y(h + 12)); c.lineTo(cx + 3, Y(h + 10)); c.lineTo(cx, Y(h + 6)); c.lineTo(cx - 3, Y(h + 10)); c.closePath(); c.fill(); }
    rect(cx - 5, Y(h + 15), 10, 1, P.LIT); };
  const roof = (x0, x1, hb, ha, xa) => {
    c.fillStyle = P.RF; c.beginPath(); c.moveTo(x0, Y(hb)); c.lineTo(x1, Y(hb)); c.lineTo(xa, Y(ha)); c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,120,132,0.35)'; c.beginPath(); c.moveTo(x0, Y(hb)); c.lineTo(xa, Y(hb)); c.lineTo(xa, Y(ha)); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.moveTo(xa + 3, Y(hb)); c.lineTo(x1, Y(hb)); c.lineTo(xa, Y(ha)); c.closePath(); c.fill();
    c.strokeStyle = P.RD; c.lineWidth = 1; for (let h = hb + 4; h < ha - 2; h += 4) { const half = (x1 - x0) / 2 * (1 - (h - hb) / (ha - hb)); c.beginPath(); c.moveTo(xa - half, Y(h) + 0.5); c.lineTo(xa + half, Y(h) + 0.5); c.stroke(); } };

  // ---------------------------------------------------------------- the body: the walls, quoins and plinth
  wall(8, 160, 14, 426, 3);
  for (const x0 of [8, 152]) for (let y = Y(426), r = 0; y < Y(14); y += 12, r++) { rect(x0, y, 8, 11, P.L); rect(x0, y, 8, 1, P.LIT); rect(x0 + (x0 < 80 ? 7 : 0), y, 1, 11, P.D); }
  rect(0, Y(14), 168, 14, P.D); rect(0, Y(14), 168, 3, P.L); for (let x = 0; x < 168; x += 14) rect(x, Y(11), 1, 11, P.DD);
  // ---------------------------------------------------------------- the slender corner turrets, with their slits and slate caps
  for (const [bx, dir] of [[0, 1], [150, -1]]) {
    rect(bx, Y(452), 18, 438, P.S); rect(bx + (dir > 0 ? 0 : 17), Y(452), 1, 438, P.DD); rect(bx + (dir > 0 ? 1 : 0), Y(452), 3, 438, P.L); rect(bx + (dir > 0 ? 13 : 4), Y(452), 4, 438, P.D);
    for (let h = 40; h < 452; h += 38) { rect(bx - 1, Y(h + 2), 20, 3, P.W); rect(bx - 1, Y(h - 1), 20, 1, P.DD); }
    for (const h0 of [250, 330, 390]) { rect(bx + 7, Y(h0 + 22), 4, 22, P.N); rect(bx + 6, Y(h0 + 24), 6, 2, P.W); }
    rect(bx - 2, Y(458), 22, 8, P.D); rect(bx - 2, Y(458), 22, 2, P.L);
    roof(bx - 2, bx + 20, 458, 494, bx + 9); rect(bx + 8, Y(498), 2, 6, P.D); }
  // ---------------------------------------------------------------- the gateway: a great pointed arch, its dark passage and the iron of a raised portcullis
  pointed(84, 14, 38, 76, 150, P.W); pointed(84, 14, 34, 76, 144, P.D); pointed(84, 14, 30, 76, 138, P.N); pointed(84, 14, 24, 76, 128, '#080706');
  for (let x = 62; x <= 106; x += 6) rect(x, Y(118), 1, 30, P.IRON); rect(60, Y(110), 49, 2, P.IRON); rect(60, Y(96), 49, 1, P.IRON);
  for (let k = 0; k < 15; k++) { const a = Math.PI * (1 + k / 14), vx = 84 + Math.cos(a) * 38, vy = Y(76) + Math.sin(a) * 74 * 0.98; rect(vx - 2, vy - 2, 4, 4, k % 2 ? P.S : P.W); }          // (the voussoirs)
  // ---------------------------------------------------------------- a string-course, then the band of plain stone shields
  rect(8, Y(160), 152, 7, P.D); rect(8, Y(160), 152, 2, P.W); rect(8, Y(154), 152, 1, P.DD);
  for (let i = 0; i < 7; i++) shield(30 + i * 18, 164, i);
  rect(8, Y(186), 152, 6, P.D); rect(8, Y(186), 152, 2, P.W);
  // ---------------------------------------------------------------- the great tier: one tall pointed arch over five statues (the two kings at the ends, the patron saints, and Saint Vitus in the middle)
  pointed(84, 190, 77, 244, 322, P.W); pointed(84, 190, 73, 244, 317, P.D); pointed(84, 190, 70, 244, 313, '#241b14');
  outline(84, 190, 66, 244, 306, P.S, 1);
  for (let k = 0; k < 9; k++) { const t = k / 8, ang = Math.PI * (1 + t), ax = 84 + Math.cos(ang) * 76, ay = Y(244) + Math.sin(ang) * 60; rect(ax - 1, ay - 3, 3, 3, P.W); }          // (the crockets along the arch)
  for (const [px] of [[11], [157]]) { rect(px - 2, Y(266), 5, 76, P.W); c.fillStyle = P.W; c.beginPath(); c.moveTo(px - 3, Y(266)); c.lineTo(px, Y(282)); c.lineTo(px + 3, Y(266)); c.closePath(); c.fill(); }          // (the pinnacles at its feet)
  // tracery in the head of the arch: three small arches over the statues and a round window above them
  for (const tx of [60, 84, 108]) { win(tx, 262, 14, 292, false); }
  c.strokeStyle = P.W; c.lineWidth = 2; c.beginPath(); c.arc(84, Y(300), 6, 0, Math.PI * 2); c.stroke(); rect(83, Y(306), 2, 12, P.W); rect(78, Y(301), 12, 2, P.W);
  rect(14, Y(200), 140, 10, P.D); rect(14, Y(200), 140, 2, P.W); rect(14, Y(191), 140, 1, P.DD);          // (the ledge the statues stand on)
  // the statues: the Graveyard pack's knight for each king, its robed saints, recoloured to sandstone
  const LO = [84, 70, 54], HI = [238, 224, 190], late = [];          // (the statues are put on after the weather below, so they stay pale against the dark wall)
  const king = stoneOf(IMG.gy_st3, LO, HI, false), kingR = stoneOf(IMG.gy_st3, LO, HI, true), saint = stoneOf(IMG.gy_st1, LO, HI, false), saintR = stoneOf(IMG.gy_st1, LO, HI, true), vitus = stoneOf(IMG.gy_st6, LO, HI, false);
  const put = (im, cx, h) => late.push([im, Math.round(cx - im.width / 2), Y(h) - im.height]);
  put(king, 30, 200); put(saint, 57, 200); put(vitus, 84, 200); put(saintR, 111, 200); put(kingR, 138, 200);
  for (const cx of [30, 57, 84, 111, 138]) { rect(cx - 8, Y(203), 16, 3, P.W); rect(cx - 8, Y(203), 16, 1, P.LIT); gablet(cx, 256 + (cx === 84 ? 6 : 0), cx === 84 ? 10 : 8, 8); }
  // ---------------------------------------------------------------- a frieze of quatrefoils, and the tier of windows with two statues between
  rect(8, Y(342), 152, 16, P.D); rect(8, Y(342), 152, 2, P.W); rect(8, Y(328), 152, 1, P.DD);
  for (let x = 16; x < 160; x += 12) { c.strokeStyle = P.S; c.lineWidth = 2; c.beginPath(); c.arc(x, Y(335), 4, 0, Math.PI * 2); c.stroke(); rect(x - 1, Y(338), 2, 6, P.S); rect(x - 3, Y(336), 6, 2, P.S); }
  rect(8, Y(346), 152, 6, P.DD);
  for (const wx of [46, 62, 108, 124]) { win(wx, 352, 12, 392, true); gablet(wx, 394, 8, 9); }
  rect(8, Y(352), 152, 2, P.W); const sTone = [stoneOf(IMG.gy_st1, LO, HI, false), stoneOf(IMG.gy_st1, LO, HI, true)];
  put(sTone[0], 77, 352); put(sTone[1], 93, 352); rect(69, Y(355), 18, 3, P.W); rect(85, Y(355), 18, 3, P.W);
  for (const cx of [77, 93]) gablet(cx, 396, 9, 9);
  // ---------------------------------------------------------------- a relief band, the corbelled gallery and its battlements
  rect(8, Y(414), 152, 18, P.DD); rect(8, Y(414), 152, 2, P.W); for (let x = 12; x < 160; x += 24) { rect(x, Y(410), 20, 12, P.D); rect(x, Y(410), 20, 1, P.LIT); rect(x + 4, Y(406), 12, 6, P.S); }
  rect(2, Y(430), 164, 12, P.D); rect(2, Y(430), 164, 2, P.W); rect(2, Y(420), 164, 1, P.DD);
  for (let x = 10; x < 160; x += 8) { rect(x, Y(418), 6, 5, P.S); rect(x + 1, Y(413), 4, 4, P.D); }          // (the corbels)
  rect(2, Y(440), 164, 10, P.S); for (let x = 2; x < 166; x += 14) { rect(x, Y(450), 8, 10, P.W); rect(x, Y(450), 8, 1, P.LIT); rect(x + 7, Y(450), 1, 10, P.D); }          // (the battlements)
  // ---------------------------------------------------------------- the dark slate roof behind the battlements
  roof(20, 148, 440, 480, 84); rect(83, Y(493), 2, 14, P.D); rect(81, Y(487), 6, 2, P.D);
  // ---------------------------------------------------------------- the weather of centuries: soot above all, darker toward the far side, and heavier at the foot
  c.globalCompositeOperation = 'source-atop';
  const gr = c.createLinearGradient(0, 0, BT_W, 0); gr.addColorStop(0, 'rgba(0,0,0,0.04)'); gr.addColorStop(1, 'rgba(8,4,14,0.34)'); c.fillStyle = gr; c.fillRect(0, 0, BT_W, BT_H);
  const gv = c.createLinearGradient(0, 0, 0, BT_H); gv.addColorStop(0, 'rgba(10,6,16,0.26)'); gv.addColorStop(0.55, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(8,4,0,0.34)'); c.fillStyle = gv; c.fillRect(0, 0, BT_W, BT_H);
  for (let i = 0; i < 40; i++) { const sx = 10 + Math.round(hs(i, 3) * 148), sh = 14 + Math.round(hs(i, 7) * 60), sy = Y(60 + Math.round(hs(i, 5) * 360)); rect(sx, sy, 1, sh, 'rgba(0,0,0,0.11)'); }          // (rain-streaks of soot under the ledges)
  c.globalCompositeOperation = 'source-over';
  for (const [im, x, y] of late) c.drawImage(im, x, y);          // (the statues, pale, in front of all of it)
  return (cache = cv);
}
