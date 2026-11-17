// The GATE OF ARX NOCTIS: the great pointed doorway that marks the moment the hero goes from the lands outside (Prague, the graveyard, the mire) into the Lord's keep.  It is drawn behind the
// crossroads' doors that lead into the keep (the Great Hall and the Moonlit Chapel): two buttress towers with narrow windows, a deep arch (the door stands in it), a carved lintel, the Lord's crest (a black sun) above it, and crimson banners down both sides.  Painted once on an off-screen canvas, KEEP_W x KEEP_H, whose bottom edge is the ground.
import { IMG } from './assets.js';

export const KEEP_W = 176, KEEP_H = 178;          // (the drawn gate's size; the sprite gate is bigger: use the canvas's own width and height)
let cache = null, tried = 0;
const hs = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// The gate built from sprites: the dark gothic castle prop of "Gothicvania Bridge Expansion Pack 1" (Luis Zuno / ansimuz, CC0): a flank of buttressed wall with a glowing slit window each side, the round-window wall
// in the middle, plain wall between, the pack's banner hung down both sides, and the game's own stone arch (dg_arch) framing the door.
function spriteGate() {
  const C = IMG.ba_castle, A = IMG.dg_arch; if (!C || !A) return null;
  const W = 288, H = 216, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const SY = 60, SH = 216, cx = W / 2;                       // (the wall pieces are 288 tall: we keep the bottom 216 above the moat, so the gate looms above the screen's top)
  const piece = (sx, sw, dx, flip) => { c.save(); if (flip) { c.translate(dx + sw, 0); c.scale(-1, 1); c.drawImage(C, sx, SY, sw, SH, 0, 0, sw, H); } else c.drawImage(C, sx, SY, sw, SH, dx, 0, sw, H); c.restore(); };
  piece(96, 64, 0, false); piece(288, 40, 64, false); piece(176, 96, cx - 48, false); piece(288, 40, cx + 48, true); piece(96, 64, W - 64, true);
  // the arch: the game's stone doorway, enlarged to frame the door
  const aw = Math.round(A.width * 1.3), ah = Math.round(A.height * 1.3); c.drawImage(A, cx - aw / 2, H - ah - 4, aw, ah);
  // banners
  const B = [388, 20, 42, 56]; for (const bx of [cx - 92, cx + 50]) c.drawImage(C, B[0], B[1], B[2], B[3], bx, 38, B[2], B[3] + 20);
  return cv;
}

export function keepGate() {
  if (cache) return cache;
  const sg = spriteGate(); if (sg) return (cache = sg);
  if (tried++ > 3 && cache === false) return null;
  const cv = document.createElement('canvas'); cv.width = KEEP_W; cv.height = KEEP_H; const c = cv.getContext('2d');
  const Y = h => KEEP_H - h;                                                          // the y of a height (px) above the ground
  const P = { L: '#6a6678', S: '#4c4858', D: '#34303f', DD: '#1b1824', H: '#8a859a', G: '#d8a84a', GD: '#8a6a2a', R: '#8a1f2a', RD: '#4a0f18', N: '#0c0a12', W: '#ffcf80' };
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const wall = (x0, x1, h0, h1, seed) => {                                             // courses of dark stone, a little different from one another
    rect(x0, Y(h1), x1 - x0, h1 - h0, P.DD);
    for (let y = Y(h1), r = 0; y < Y(h0); y += 8, r++) for (let x = x0 - (r % 2 ? 8 : 0); x < x1; x += 16) {
      const bx = Math.max(x, x0), bw = Math.min(x + 16, x1) - bx, k = hs(x * 3.1 + seed, r), tone = k > 0.9 ? P.L : k > 0.5 ? P.S : P.D;
      if (bw > 1) { rect(bx, y, bw - 1, 7, tone); rect(bx, y, bw - 1, 1, 'rgba(220,215,240,0.14)'); rect(bx, y + 6, bw - 1, 1, 'rgba(0,0,0,0.25)'); }
    }
  };
  // ---- the two towers, with crenellations, a narrow window and a plinth each
  for (const [x0, x1] of [[0, 44], [KEEP_W - 44, KEEP_W]]) {
    wall(x0, x1, 0, 150, x0); rect(x0, Y(150), x1 - x0, 5, P.L); rect(x0, Y(150) - 7, x1 - x0, 7, P.DD);
    for (let x = x0 + 2; x < x1 - 6; x += 12) { rect(x, Y(150) - 9, 8, 9, P.S); rect(x, Y(150) - 9, 8, 1, P.H); }       // merlons
    rect(x0, Y(14), x1 - x0, 14, P.D); rect(x0, Y(14), x1 - x0, 2, P.L);
    const wx = (x0 + x1) / 2 - 3; c.fillStyle = P.N; c.beginPath(); c.moveTo(wx, Y(100)); c.lineTo(wx, Y(78)); c.lineTo(wx + 6, Y(78)); c.lineTo(wx + 6, Y(100)); c.quadraticCurveTo(wx + 3, Y(108), wx, Y(100)); c.fill(); rect(wx + 2, Y(94), 2, 12, P.GD);   // the arrow-slit, with a faint gleam inside
  }
  // ---- the wall between them, and the deep pointed arch
  wall(40, KEEP_W - 40, 0, 118, 77); rect(40, Y(118), KEEP_W - 80, 5, P.L); rect(40, Y(118) - 6, KEEP_W - 80, 6, P.DD);
  for (let x = 44; x < KEEP_W - 48; x += 16) { rect(x, Y(118) - 8, 10, 8, P.S); rect(x, Y(118) - 8, 10, 1, P.H); }
  const cx = KEEP_W / 2;
  const arch = (hw, top, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx - hw, Y(0)); c.lineTo(cx - hw, Y(top - 28)); c.quadraticCurveTo(cx - hw, Y(top - 6), cx, Y(top)); c.quadraticCurveTo(cx + hw, Y(top - 6), cx + hw, Y(top - 28)); c.lineTo(cx + hw, Y(0)); c.closePath(); c.fill(); };
  arch(40, 112, P.DD); arch(37, 109, P.L); arch(33, 106, P.D); arch(30, 103, P.N);                // moulding after moulding, down into the dark
  const glow = c.createLinearGradient(0, Y(0), 0, Y(96)); glow.addColorStop(0, 'rgba(255,170,70,0.55)'); glow.addColorStop(0.5, 'rgba(160,70,30,0.25)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(cx - 28, Y(96), 56, 96);   // firelight from within
  for (let k = -3; k <= 3; k++) rect(cx + k * 8 - 1, Y(96), 2, 70, 'rgba(18,14,24,0.9)');         // a portcullis, raised: only its spikes show above the opening
  for (let k = -3; k <= 3; k++) { c.fillStyle = '#2a2634'; c.beginPath(); c.moveTo(cx + k * 8 - 2, Y(96) + 70); c.lineTo(cx + k * 8, Y(96) + 78); c.lineTo(cx + k * 8 + 2, Y(96) + 70); c.fill(); }
  // ---- the lintel: a carved band that names the keep
  rect(44, Y(142), KEEP_W - 88, 22, P.DD); rect(45, Y(141), KEEP_W - 90, 20, P.S); rect(45, Y(141), KEEP_W - 90, 2, P.L); rect(45, Y(123), KEEP_W - 90, 2, P.D);
  for (const x of [48, KEEP_W - 52]) { rect(x, Y(137), 4, 4, P.G); rect(x + 1, Y(136), 2, 2, P.GD); }
  // ---- the Lord's crest above it: a black sun ringed with cold light, on a shield of stone
  rect(cx - 14, Y(172), 28, 26, P.DD); rect(cx - 13, Y(171), 26, 24, P.D);
  c.fillStyle = '#7c7690'; c.beginPath(); c.arc(cx, Y(159), 9, 0, 6.3); c.fill(); c.fillStyle = P.N; c.beginPath(); c.arc(cx, Y(159), 7, 0, 6.3); c.fill();
  for (let a = 0; a < 12; a++) { const an = a * Math.PI / 6; c.fillStyle = '#9a94b0'; c.fillRect(Math.round(cx + Math.cos(an) * 11) - 1, Math.round(Y(159) + Math.sin(an) * 11) - 1, 2, 2); }
  // ---- crimson banners down the front of both towers
  for (const bx of [10, KEEP_W - 22]) {
    rect(bx - 3, Y(128), 18, 3, P.GD);
    rect(bx, Y(125), 12, 52, P.R); rect(bx, Y(125), 3, 52, P.RD); rect(bx + 9, Y(125), 3, 52, P.RD);
    c.fillStyle = P.R; c.beginPath(); c.moveTo(bx, Y(73)); c.lineTo(bx + 6, Y(66)); c.lineTo(bx + 12, Y(73)); c.fill();
    c.fillStyle = P.N; c.beginPath(); c.arc(bx + 6, Y(100), 4, 0, 6.3); c.fill(); c.fillStyle = P.GD; for (let a = 0; a < 8; a++) { const an = a * Math.PI / 4; c.fillRect(Math.round(bx + 6 + Math.cos(an) * 6), Math.round(Y(100) + Math.sin(an) * 6), 1, 1); }
  }
  // ---- steps up to the door
  rect(cx - 44, Y(4), 88, 4, P.S); rect(cx - 44, Y(4), 88, 1, P.H); rect(cx - 52, Y(2), 104, 2, P.D);
  cache = cv; return cv;
}
