// Main game: state machine, room loading/transitions, combat resolution, boss flow, rendering.
import { W, H, T, clamp, lerp, rand, overlap, dist } from './util.js';
import { FX, COLORS } from './fx.js';
import { Input } from './input.js';
import { Touch } from './touch.js';
import { loadFonts, drawText, textWidth } from './font.js';
import { Audio_ as A } from './audio.js';
import { ZONES, KEEP } from './rooms.js';
import { buildWorld, buildWorldAsync, adoptWorld, worldReady, randomSeed, GEN_VERSION, arrivalBesideStone } from './levelgen.js';
import { Room, TILE, drawBackground, discoBeams, drawForeground, drawGateTile } from './world.js';
import { Player, SPELLS } from './player.js';
import { ENEMY_TYPES } from './enemies.js';
import { BEAST_TYPES } from './beasts.js';
import { randomItemId, ITEMS, addItem } from './itemdata.js';
import { BOSS_TYPES, Column } from './bosses.js';
import { MirrorView } from './mirror.js';
import { VillageScene, OpeningScene } from './scenes.js';
import { STORY, voiced } from './story.js';
import { Ghost } from './ghost.js';
import { Movers } from './movers.js';
import { Icicle } from './icicles.js';
import { SteamJet } from './steamjets.js';
import { Shopkeeper, ShopScreen } from './shop.js';
import { KEYS } from './itemdata.js';
import { Projectile, Shockwave, FirePatch } from './projectiles.js';
import { Skull, SKULL_COUNT, Bell, LitCandle, Statue, Barrel, Altar, Waystone, Tablet, Chest, Lever, Upgrade, Relic, Pickup, chestGift, ABILITIES, UPGRADES } from './props.js';
import { drawDeco, isBack, roomFlames, drawFlames2D, drawFireWall, decoCoversHazard, sigilOf, drawSigilCard } from './decor.js';
import { drawIce } from './enchant.js';
import { drawSheet, IMG } from './assets.js';
import { noteSeen, noteKill } from './bestiary.js';
import { HUD, drawBanner, drawPopups, drawPrompt, drawExitArrow, Dialog, TitleScreen, PauseMenu, MapScreen, IntroCrawl, GameOver, Ending } from './ui.js';
import { LetterReader, markPage, loadLetters, PAGE_COUNT } from './letters.js';
import { loadDialogue, text as dtext } from './dialogue.js';
import { focus as loaderFocus } from './loader.js';
import { keepStorage } from './pwa.js';
import { openSavePanel } from './savefile.js';

const SAVE_KEY = 'shadowkeep.save.v1';
const POOL_DEPTH = 8;          // px of water in a swamp pool (the hollow it lies in is 16 deep: the water stays below the ground's edge, whatever its waves do)
const CHASE_DELAY = 140 + 180;          // steps (60 a second) from the Bell Tower's flames igniting to their first step upward: 140 to get moving, plus 3 seconds
const DOOR_CLEAR = 200;          // px: no enemy starts within this distance of a door you have just come through (about half a screen)
const FLYERS = new Set(['bat', 'ghost', 'wraith', 'fireskull', 'wyrm', 'frostwyrm', 'emberwyrm', 'tome', 'grimoire']);
const ITEM_IDS = ['br_hp', 'g2_hp', 'g2_atk', 'h2_mp', 'h2_hp', 'c1_chest_u', 'u1_hp', 'u2_atk', 't1_mp', 'v2_atk', 'v3_mp', 'g4_mp', 'w1_hp', 'w2_mp', 'w3_atk', 'bu_vb', 'bu_wb', 'got_djump', 'got_dash', 'got_ember', 'got_thunder'];

const newSave = world => ({
  seed: world.seed, room: world.start.room, spawnX: world.start.x * 16 + 8, spawnY: world.start.gy * 16, hp: 60, maxHp: 60, mp: 40, maxMp: 40, atk: 8, level: 1, xp: 0, gold: 0,
  abilities: { djump: false, dash: false, ember: false, thunder: false }, flags: {}, visited: {}, time: 0, kills: 0, v: 1, gv: GEN_VERSION,
  items: { dagger: 6 }, sel: 'dagger', bestiary: {},                // carried disposable items (see items.js) and the hotbar selection
});

// the tint of a room's ground fog, by its look (the darkness overlay dims it further in dark rooms)
const FOG_COL = { default: [0.64, 0.7, 0.8], graveyard: [0.66, 0.72, 0.84], swamp: [0.56, 0.7, 0.56], chapel: [0.68, 0.68, 0.88], throne: [0.5, 0.4, 0.6], hall: [0.7, 0.66, 0.6] };

// Monsters get tougher the deeper you go (you keep gaining sword power as you climb): their hit points are multiplied by their zone's number, and so is what they are worth.
// Zone ids are not in story order (6 = the village, the first; 5 = the throne, the last).
const hsl2rgb = h => { const k = h / 60, i = Math.floor(k) % 6, f = k - Math.floor(k); return [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i]; };          // a full-strength colour from a hue in degrees (the disco lights)
// DIFFICULTY follows the path a player is expected to take: Prague, the Graveyard, the Mire, the Great Hall (its master gives the dash), the Cistern (entered from under Karluv Bridge: it needs the double jump AND the dash), the Chapel (its door waits for the
// Hall and the Flooded Gate; its master gives fire), the Crypts, the Frozen Caverns (beyond the Cistern, through an ice wall: fire), the Clockwork Dungeon (the Key of Tin lies in the Crypts), the Library (the Rimewyrm holds its key), the Throne.
// Both tables below climb in that order: when the order of the castle changes, change them with it (and the 'abilities' of the zone's rooms in levelgen.js).
const ZONE_HP = { 6: 1, 1: 1.15, 7: 1.4, 2: 1.95, 9: 2.15, 3: 2.35, 4: 2.9, 11: 3.2, 8: 3.4, 10: 3.5, 5: 4.2 };          // (how much tougher the ordinary monsters are in each zone: it climbs through the game)
// BOSSES have far more life than the monsters of their zone, and hit harder, and both grow the later the zone: [life factor, damage factor]
const BOSS_K = { 6: [2.0, 1.25], 1: [2.3, 1.3], 7: [2.6, 1.4], 2: [3.2, 1.55], 9: [3.4, 1.6], 3: [3.6, 1.65], 4: [4.0, 1.75], 11: [4.3, 1.85], 8: [4.5, 1.9], 10: [4.7, 1.95], 5: [5.2, 2.15] };

// the boss flags a sealed door asks for -> where that master is to be found (the door's dialogue lists the ones that still live)
const LOCK_HINTS = {
  boss_h4: 'THE PHANTOM STEED STILL RIDES THE GREAT HALL, THROUGH THE WOODEN DOOR AT THE GATE OF ARX NOCTIS.',
  boss_qb: 'THE DROWNED WARDEN STILL KEEPS THE FLOODED GATE, DEEP IN THE CISTERN UNDER KARLUV BRIDGE: DROP THROUGH THE PLANKS IN THE DECK, AND BREAK YOUR FALL WITH A DOUBLE JUMP AND A DASH.',
  boss_u3: 'THE CRIMSON COUNT STILL WAITS IN THE CRYPTS: BURN THE BARRICADE IN THE BARRICADED GALLERY.',
  boss_og: 'THE BOILER GOLEM STILL KEEPS THE FIRES, IN THE LOFT AT THE TOP OF THE ORLOJ TOWER.',
  boss_kb: 'THE BRAZEN HIEROPHANT STILL WORKS THE CLOCKWORK DUNGEON. ITS ENTRANCE IS IN PRAGUE: A LOCKED DOOR HIGH IN SMOULDERING LANE LEADS UP THE ORLOJ TOWER. YOU NEED THE KEY OF TIN.',
};
export class Game {
  async init() {
    this.noAutoPause = new URLSearchParams(location.search).has('nopause');
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d', { willReadFrequently: !new URLSearchParams(location.search).has('gpu') }); this.ctx.imageSmoothingEnabled = false; this.K = 3;          // (a CPU-backed canvas: the effects layer copies this picture into a WebGL texture every frame, and a GPU-accelerated 2D canvas can be caught half-drawn by that copy - black blocks and torn rows, esp. in Firefox.  ?gpu turns it off)
    this.topCanvas = document.getElementById('top'); this.top = this.topCanvas.getContext('2d');       // a clear layer above the effects (fog, darkness): the arrows that say 'you can use this' / 'this way out' are drawn here so nothing hides them
    // The game is drawn in 384x216 'logical' pixels onto a K-times larger canvas (so the gothic text can be smooth and crisp);
    // sprites are snapped to the logical grid so pixel art looks exactly as before.
    for (const c of [this.ctx, this.top]) { const di = c.drawImage; c.drawImage = function (img, ...a) { if (a.length === 2 || a.length === 4) { a[0] = Math.round(a[0]); a[1] = Math.round(a[1]); } else if (a.length === 8) { a[4] = Math.round(a[4]); a[5] = Math.round(a[5]); } return di.call(this, img, ...a); }; }
    this.fx = new FX(document.getElementById('fx')); this.fx.onThunder = p => A.sfx('thunder', { power: p }); this.fx.postEnabled = () => A.settings.glow !== false; this.fx.initPost(this.canvas);
    Input.init(); Touch.init(this); await A.init(); if (new URLSearchParams(location.search).get('cloak') === '0') A.settings.cloak = false; await loadFonts(); await loadDialogue(); loadLetters(); this.resize(); addEventListener('resize', () => this.resize());
    // Losing focus (clicking another window, switching tabs/apps) mutes all sound and pauses a running game; sound returns when focus does.
    // (`?nopause` in the URL turns this off - handy for automated testing in a background tab.)
    const lose = () => { if (this.noAutoPause) return; A.focusLost(); if (this.state === 'play') this.pause(); };
    const gain = () => { if (this.noAutoPause) return; A.focusGained(); };
    addEventListener('blur', lose); addEventListener('focus', gain);
    document.addEventListener('visibilitychange', () => (document.hidden ? lose() : gain()));
    if ((document.hidden || !document.hasFocus()) && !this.noAutoPause) A.focusLost();      // opened in a background window: start silent until it is focused
    this.state = 'title'; this.frame = 0; this.kills = 0; this.attackCounter = 0; this.hitstop = 0; this.shakeT = 0; this.shakeA = 0; this.slow = 0; this.save = null;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.props = []; this.popups = []; this.flames = []; this.camera = { x: 0, y: 0 };
    this.bannerObj = null; this.dialog = null; this.boss = null; this.cutscene = null; this.trans = null; this.delayed = []; this.fade = 0; this.playerFrozen = false; this.zone = 0; this.room = null;
    this.info = { ABILITIES, UPGRADES };          // (what the pause screen reads out about each thing you have found)
    this.ghost = new Ghost(this); this.player = new Player(this, 0, 0); this.toTitle(true);
  }

  // -------------------------------------------------------------------------------- sizing / loop
  resize() {
    const gut = Touch.layout();                                                            // (on a phone held sideways the game gives up some width to the on-screen controls)
    let s = Math.min((innerWidth - gut.l - gut.r) / W, gut.h / H); const fl = Math.floor(s); if (fl >= 1 && s - fl < 0.4 && !Input.touchOn) s = fl;                  // (a desktop window snaps down to a whole scale for the crispest pixels; a phone needs every pixel it can get)
    const st = document.getElementById('stage'); st.style.width = Math.floor(W * s) + 'px'; st.style.height = Math.floor(H * s) + 'px';
    const devW = Math.floor(W * s) * (window.devicePixelRatio || 1), K = clamp(Math.ceil(devW / W - 0.02), 2, Input.touchOn ? 3 : 5);                // (a phone gets at most 3x: the sharper canvas is not worth the heat)
    if (K !== this.K || this.canvas.width !== W * K) { this.K = K; this.canvas.width = W * K; this.canvas.height = H * K; }
    if (this.topCanvas.width !== W * K) { this.topCanvas.width = W * K; this.topCanvas.height = H * K; }
    this.canvas.style.imageRendering = Math.abs(devW - W * K) < 1.5 ? 'pixelated' : 'auto';
  }
  run() {
    let last = performance.now(), acc = 0; const STEP = 1000 / 60;
    const perf = { n: 0, slow: 0 }, fullfx = new URLSearchParams(location.search).has('fullfx');
    const loop = now => {
      requestAnimationFrame(loop);                                        // (first of all: whatever goes wrong in this frame, the next one still comes - a thrown error used to end the loop for good, and the game sat frozen)
      try { frame(now); } catch (e) { this.crashed(e); }
    };
    const frame = now => {
      const raw = now - last; acc += Math.min(100, raw); last = now; let n = 0;
      // a SPEED GOVERNOR: if, over three seconds of play, most frames come late (slower than about 50 per second), the dearest effect - the shadows the lights cast - is switched off for the rest of the visit
      if (!fullfx && this.state === 'play' && !document.hidden && !this.freeze && raw < 100 && this.fx.shadowK !== 0) { perf.n++; if (raw > 19.5) perf.slow++; if (perf.n >= 180) { if (perf.slow > perf.n * 0.55) { this.fx.shadowK = 0; this.fx.darkU.uShadow.value = 0; console.info('slow frames: shadows switched off (?fullfx keeps them)'); } perf.n = perf.slow = 0; } }
      if (this.freeze) acc = 0;                                           // test hook: game.freeze = true holds the current frame
      while (acc >= STEP && n < 5) { this.step(); acc -= STEP; n++; } if (n === 5) acc = 0;
      this.draw();
    };
    requestAnimationFrame(loop);
  }
  // a frame threw an error: say so (once per kind), and let go of whatever might be holding the hero - a scene or a talk that can no longer go on - so the game carries on instead of freezing
  crashed(e) {
    const key = String(e && e.message); this.errors = this.errors || new Map(); const n = (this.errors.get(key) || 0) + 1; this.errors.set(key, n);
    if (n === 1) console.error('frame error (the game carries on):', e);
    const sc = this.cutscene && this.cutscene.scene; if (sc && sc.finish) { try { sc.finish(); } catch {} }          // (a scene is ended the proper way, so it does not start over: its own finish() sets the flag that says it has been played)
    if (this.cutscene) { this.cutscene = null; this.playerFrozen = false; if (this.player) this.player.invT = Math.max(this.player.invT || 0, 60); }
    if (this.dialog && n > 3) this.dialog = null;
  }

  // -------------------------------------------------------------------------------- helpers used by entities
  popup(x, y, text, color = '#fff') { this.popups.push({ x, y, text, color, life: 55 }); }
  banner(title, sub = '', dur = 190, o = {}) { this.bannerObj = { title, sub, t: 0, dur, ...o }; }
  shake(a, frames) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, frames); }
  addProjectile(p) { const b = this.boss; if (b && b.active && b.dmgK && p.owner === 'enemy' && !p.kScaled && typeof p.dmg === 'number') { p.dmg = Math.max(1, Math.round(p.dmg * b.dmgK)); p.kScaled = true; } this.projectiles.push(p); return p; }          // (a boss's shots hurt as much more as the boss does)
  after(frames, fn) { this.delayed.push({ t: frames, fn }); }
  // the name of the area a door or an open edge leads to: the zone's name when it is another zone (THE GREAT HALL), else the room's own (WEAVER'S COTTAGE)
  areaName(id) { const t = this.world.rooms[id]; if (!t) return ''; if (t.areaLabel) return t.areaLabel.toUpperCase(); if (KEEP.has(t.zone) && !KEEP.has(this.room.zone)) return 'ARX NOCTIS'; return (t.zone !== this.room.zone ? ZONES[t.zone].name : t.name).toUpperCase(); }
  areaLabel(top, name, x, y, align = 'center', color = '#ffe9a0', alpha = 1) {
    if (!name) return; const w = textWidth(name, 0.9, { outline: true }), lx = align === 'center' ? clamp(x, w / 2 + 4, W - w / 2 - 4) : x;
    drawText(top, name, Math.round(lx), Math.round(y), { align, color, outline: '#000', scale: 0.9, alpha });
  }
  // the room's streams and waterfalls, for the water shader (fx.setWater)
  waterList() {
    const r = this.room, out = [];
    for (const c of r.currents || []) out.push({ type: 0, x0: c.x0, y0: c.y - 15, x1: c.x1, y1: c.y + 1, v: c.vx * 60 });
    for (const c of r.rivers || []) out.push({ type: 0, x0: c.x0, y0: c.y, x1: c.x1, y1: r.ph, v: c.vx * 60 });
    for (const d of r.decos) if (d.t === 'waterfall') out.push({ type: 1, x0: d.x - d.w / 2, y0: d.top, x1: d.x + d.w / 2, y1: d.y, v: 95 });
    for (const p of r.pools || []) out.push({ type: 0, x0: p.x0, y0: p.yb - POOL_DEPTH, x1: p.x1, y1: p.yb, v: 0 });          // (a pool: a still sheet of shallow water lying on the bottom of a one-tile hollow of the ground: its surface is well below the lip, not level with it)
    return out;
  }
  // the flow of the room's water has changed (a boss heaves the tide): hand the new speeds to the water shader
  syncFlow() { this.fx.setFlows(this.waterList().map(o => o.v)); }
  // the six hidden skulls: how many are broken, and what the sixth does
  skullsBroken() { let n = 0; for (let i = 1; i <= SKULL_COUNT; i++) if (this.save.flags['skull' + i]) n++; return n; }
  skullsDone() { this.save.flags.skulls_done = true; this.after(50, () => { A.sfx('boom'); this.shake(5, 40); this.fx.flash([0.7, 0.6, 0.9], 0.3); this.banner('THE SIXTH SKULL', 'FAR AWAY, STONE GRINDS ON STONE', 220, { y: 52, color: '#cfc2a0' }); }); }
  // a page of the story has been found: kept in the save and in the browser's own storage.  It is NOT opened: the player reads it when they like, from LETTERS in the pause menu (or the book on the title screen)
  foundPage(n) { this.save.flags['page' + n] = true; markPage(n); }
  openLetter(n, done) { this.reader = new LetterReader(n, done); this.state = 'letter'; A.sfx('page'); }
  showDialog(text, o) { this.dialog = new Dialog(text, o); this.state = 'dialog'; }
  // a short exchange of words: lines = [[speaker, text], ...], each in a box of its own; done() runs when the last box is closed
  talk(lines, done) {
    const next = i => { if (i >= lines.length) { if (done) done(); return; } const [who, text, font] = lines[i]; this.showDialog(text, { name: who, font, onClose: () => next(i + 1) }); };
    next(0);
  }
  itemPercent() { const f = this.save.flags; return Math.round(ITEM_IDS.filter(k => f[k]).length / ITEM_IDS.length * 100); }
  spawnEnemy(type, tx, gy, o = {}) {
    const C = ENEMY_TYPES[type] || BEAST_TYPES[type] || BOSS_TYPES[type]; if (!C) { console.warn('unknown enemy', type); return null; }
    const x = tx * 16 + 8, y = FLYERS.has(type) || type === 'boss_angel' || type === 'boss_shadow' || type === 'boss_bramble' || type === 'boss_librarian' || type === 'boss_rimewyrm' ? gy * 16 + 8 : gy * 16;
    const e = new C(this, x, y, o); e.typeKey = type;          // (what kind it is: the sound it dies with depends on it)
    const m = !e.isBoss && !e.talk && !e.calm ? ZONE_HP[this.room && this.room.zone] || 1 : 1; if (m !== 1) { e.hp = e.maxHp = Math.round(e.maxHp * m); e.xp = Math.max(1, Math.round(e.xp * Math.sqrt(m))); }
    if (e.isBoss) { const [hk, dk] = BOSS_K[this.room && this.room.zone] || [2.5, 1.5]; e.hp = e.maxHp = Math.round(e.maxHp * hk); e.dmg = Math.round(e.dmg * dk); e.dmgK = dk; }
    this.enemies.push(e); return e;
  }

  // -------------------------------------------------------------------------------- save / load
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); keepStorage(); return true; } catch (e) { console.warn('save failed', e); return false; } }          // (keepStorage: asked at the first key or click of a visit, so a no-op here unless a save came first - see pwa.js)
  loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return s; } catch {} return null; }
  // a save brought back from a save file (savefile.js has checked it is one) becomes the game saved in this browser; loadSlot() then plays it.  Throws if the browser will not store it.
  restoreSave(s) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s)); keepStorage();
    for (let n = 1; n <= PAGE_COUNT; n++) if (s.flags['page' + n]) markPage(n);
    this.prebuild();          // (its castle is made while the title is up, as for any saved game)
  }
  // QUICK SAVE (pause menu) saves wherever the hero stands, into the same slot the altars use - so after a death the hero wakes where the quick save was made.  It is refused (returns why, in a few
  // words) where waking up again could not be trusted: in a boss fight (the doors are shut and the master alive), in the air, or riding a moving platform.
  quickSaveBlock() {
    const p = this.player; if (!p || p.dead || !this.room) return 'NOT NOW';
    if (this.boss) return 'NOT DURING A BOSS FIGHT'; if (this.cutscene) return 'NOT NOW';
    if (!p.onGround || p.ride) return 'STAND ON SOLID GROUND FIRST';
    return null;
  }
  quickSave() {
    const why = this.quickSaveBlock(); if (why) return why;
    const S = this.save, p = this.player; S.room = this.room.id; S.spawnX = Math.round(p.x); S.spawnY = Math.round(p.y);
    return this.saveGame() ? null : 'THE BROWSER WOULD NOT STORE IT';
  }
  // the game as a save object, for a save file: the hero's life, powers and finds as they are now, standing where a quick save would put them (or, where that is refused, at the last save point)
  snapshot() {
    const s = JSON.parse(JSON.stringify(this.save)); if (!this.quickSaveBlock()) { s.room = this.room.id; s.spawnX = Math.round(this.player.x); s.spawnY = Math.round(this.player.y); } return s;
  }
  // After an altar has saved the game: a moment later (the altar's banner and light first) a YES / NO question - a save file as well?  The cursor starts on NO, and ESC says no, so an altar visited often
  // is no trouble.  YES opens the SAVE GAME panel (savefile.js) over the frozen castle (state 'file').  `saved` is false if the browser would not keep the save: the file is then the only copy.
  offerFile(saved) {
    const room = this.room && this.room.id, id = this.offerId = (this.offerId || 0) + 1;
    this.after(80, () => {
      if (id !== this.offerId || this.state !== 'play' || this.cutscene || !this.room || this.room.id !== room || this.player.dead) return;          // (the hero has gone on to something else: the question is dropped)
      this.showDialog(saved ? 'SAVE A COPY TO A FILE AS WELL?' : 'SAVE TO A FILE INSTEAD?', { choices: ['YES', 'NO'], sel: 1, onClose: ch => {
        if (ch !== 0) return; this.state = 'file'; openSavePanel(this, this.loadSave() || this.snapshot(), () => { if (this.state === 'file') this.state = 'play'; });
      } });
    });
  }
  // QUICK LOAD, and a game brought back from a file: take up the game stored in this browser - from the title, or at once from the pause menu
  loadSlot() {
    const s = this.loadSave(); if (!s) return false;
    if (this.state === 'title') { this.continueGame(); return true; }
    if (!worldReady(s.seed || 0)) { this.toTitle(); this.continueGame(); return true; }          // (a different castle: it is made behind the title's 'gathering the dead' bar)
    this.useSave(s); this.player = new Player(this, 0, 0); this.boss = null; this.cutscene = null; this.playerFrozen = false; this.trans = null; this.dialog = null; this.slow = 0; this.beginPlay(true); return true;
  }

  // -------------------------------------------------------------------------------- state changes
  toTitle(first = false) {
    this.state = 'title'; this.save = null; this.boss = null; this.cutscene = null; this.playerFrozen = false; this.trans = null; this.room = null; this.title = new TitleScreen(this);
    A.setIndoor(false, true); this.fx.reset(); this.fx.setAmbient(0.0, [0, 0, 0], 0.5); this.fx.setAmbientFx('rain'); this.fx.setStorm(true, 0.004); this.fx.setCamera(0, 0); this.fx.setShake(0, 0); A.play('title', { fade: 1.5 });
    this.loadingWorld = null; this.prebuild(); this.fx.rainCount = 0.26;          // (half as much rain behind the title)
  }
  // Making the castle takes a few seconds, so it is done while the title screen is up: first the castle of the saved game (if there is one), then the one a NEW GAME will use.  Choosing either before it is ready
  // shows a short "gathering the dead" bar instead of freezing.
  worldJobs = {};
  // the castle is made on a worker thread (src/worldworker.js) so nothing stutters; if the browser cannot do that, it is made in small slices between frames instead
  buildInWorker(seed) {
    return new Promise((resolve, reject) => {
      let w; try { w = new Worker(new URL('./worldworker.js', import.meta.url), { type: 'module' }); } catch (e) { reject(e); return; }
      const sizes = {}; for (const [k, im] of Object.entries(IMG)) if (im && im.width) sizes[k] = [im.width, im.height];
      const t0 = performance.now(), tick = setInterval(() => { this.worldFrac = Math.min(0.94, (performance.now() - t0) / 9000); }, 150), done = () => { clearInterval(tick); w.terminate(); };
      w.onmessage = e => { done(); if (e.data.error) reject(new Error(e.data.error)); else { adoptWorld(seed, e.data.world); this.worldFrac = 1; resolve(e.data.world); } };
      w.onerror = e => { done(); reject(new Error('the castle worker failed')); };
      w.postMessage({ seed, sizes });
    });
  }
  ensureWorld(seed) {
    seed |= 0; if (worldReady(seed)) return Promise.resolve(buildWorld(seed));
    return this.worldJobs[seed] ||= this.buildInWorker(seed).catch(e => { console.warn('castle worker unavailable, building in slices:', e.message); return buildWorldAsync(seed, f => { this.worldFrac = f; }); }).finally(() => { delete this.worldJobs[seed]; });
  }
  prebuild() {
    const s = this.loadSave(); const q = new URLSearchParams(location.search).get('seed'); if (this.nextSeed === undefined || this.nextSeed === null) this.nextSeed = q !== null && /^\d{1,9}$/.test(q) ? +q : randomSeed();
    (s ? this.ensureWorld(s.seed || 0) : Promise.resolve()).catch(() => {}).then(() => this.ensureWorld(this.nextSeed)).catch(() => {});
  }
  whenWorld(seed, fn) {
    if (worldReady(seed)) { fn(); return; } if (this.loadingWorld) return; this.loadingWorld = { seed }; this.worldFrac = 0;
    this.ensureWorld(seed).then(() => { this.loadingWorld = null; if (this.state === 'title') fn(); }).catch(e => { this.loadingWorld = null; console.error(e); });
  }
  // SECRET CODES, typed on the seed screen (the one NEW GAME opens) instead of a seed: the castle is a random one, and ...
  //   02151979  everything is yours from the start: every power, every relic, every page, every key, a full satchel, every waystone attuned, the whole map charted, and your life, mana and sword as strong as if every upgrade lying in the castle had been taken
  //             (the bosses are all still there to be fought, and what they leave behind is still theirs to give)
  codeFor(text) { return { '02151979': 'all' }[text] || null; }
  applyCode(code) {
    if (code !== 'all') return; const S = this.save;
    for (const k of Object.keys(S.abilities)) S.abilities[k] = true;
    for (const f of ['got_mantle', 'got_lantern', 'got_shard', 'got_spring', 'got_tide', 'got_astrolabe', 'got_ouroboros', 'got_shoes', 'got_athanor']) S.flags[f] = true;
    for (let n = 1; n <= PAGE_COUNT; n++) { S.flags['page' + n] = true; markPage(n); }
    for (const id of Object.keys(ITEMS)) addItem(S, id, ITEMS[id].max);
    for (const id of this.world.stones || []) S.flags['tp_' + id] = true;
    for (const K of KEYS) S.flags['has_' + K.id] = true;          // (every key is in the pocket: the doors still have to be opened, and the keys that lie in the castle are marked as taken, below)
    for (const id of this.world.order) S.visited[id] = true;          // (the whole map: every room is charted)
    const got = { hpup: 0, mpup: 0, atkup: 0, key: 0 }, take = (kind, ...flags) => { if (!(kind in got)) return; got[kind]++; for (const f of flags) S.flags[f] = true; };          // every upgrade lying about the castle - in the open, in a sealed cell or in a chest - as if it had been taken (a boss's own gift is not counted: the boss is still there)
    for (const id of this.world.order) for (const sp of this.world.rooms[id].spawns) { const o = sp.o || {}; if (sp.type === 'upgrade') take(o.kind, o.id); else if (sp.type === 'chest') take(o.contents, o.id, o.id + '_u'); }
    S.maxHp += 20 * got.hpup; S.maxMp += 10 * got.mpup; S.atk += 2 * got.atkup;          // (what each one gives: see Upgrade.collect)
    S.hp = S.maxHp; S.mp = S.maxMp; A.sfx('ability');
  }
  newGame(seed, code) {
    if (seed === undefined) { if (this.nextSeed === undefined || this.nextSeed === null) this.prebuild(); seed = this.nextSeed; }
    this.whenWorld(seed, () => { this.nextSeed = null; this.world = buildWorld(seed); this.save = newSave(this.world); if (code) this.applyCode(code); this.kills = 0; this.player = new Player(this, 0, 0); this.fx.setStorm(false); this.beginPlay(false); }); }          // (a new game begins on the hill above Prague: see checkOpening)
  continueGame() {
    const s = this.loadSave(); if (!s) return; this.whenWorld(s.seed || 0, () => { this.useSave(s); this.kills = 0; this.player = new Player(this, 0, 0); this.beginPlay(true); });
  }
  beginPlay(cont = false) {
    const S = this.save; this.state = 'play'; this.slow = 0; this.cutscene = null;
    this.loadRoom(S.room, { x: S.spawnX, y: S.spawnY }, 1); S.hp = cont ? S.hp : S.hp; this.fade = 1; this.fadeDir = -1;
  }
  respawn() { // after death: back to the last save
    const s = this.loadSave(); if (s) this.useSave(s); else { this.save = newSave(this.world); this.save.flags.opening_seen = true; } this.player = new Player(this, 0, 0); this.boss = null; this.slow = 0; this.save.hp = this.save.maxHp; this.save.mp = this.save.maxMp; this.beginPlay(true);
  }
  useSave(s) { s.items ||= {}; s.bestiary ||= {}; delete s.items.caltrops; delete s.items.axe; if (s.sel === 'caltrops' || s.sel === 'axe') s.sel = 'dagger'; this.save = s; this.world = buildWorld(s.seed || 0);
    if (s.gv !== GEN_VERSION || !this.world.rooms[s.room]) { s.gv = GEN_VERSION; s.room = this.world.start.room; s.spawnX = this.world.start.x * 16 + 8; s.spawnY = this.world.start.gy * 16; s.visited = {}; s.flags.opening_seen = true; }          // (a save made before the castle's layout last changed: the rooms are not where they were, so the hero wakes at the start with everything they carry; the maps fill in again)
  }                       // (caltrops were removed from the game)
  openShop(keeper) { this.state = 'shop'; this.shop = new ShopScreen(this, keeper); A.sfx('select'); }
  pause() { this.state = 'pause'; this.pauseMenu = new PauseMenu(this); A.sfx('select'); }
  resume() { if (this.state === 'pause' || this.state === 'map') { this.state = 'play'; A.sfx('back'); } }
  openMap(o = {}) { this.state = 'map'; this.mapScreen = new MapScreen(this, o); A.sfx('select'); }
  // waystone travel: appear beside the destination's stone (the room you wake in is NOT a save point - altars still are)
  teleportTo(id) {
    const def = this.world.rooms[id], w = def && def.spawns.find(s => s.type === 'waystone'); if (!w) return;
    this.state = 'play'; A.sfx('ability'); this.fx.flash([0.45, 0.85, 1], 0.5); this.fx.burst(this.player.x, this.player.y - 16, 18, COLORS.blue, { speed: 2 });
    this.changeRoom({ room: id, x: arrivalBesideStone(def, w), y: w.y * 16 }, -1);          // (beside the stone but on solid floor: never out over a pit)
  }
  onPlayerDeath() { A.stop(0.8); A.sting('sting_gameover'); this.slow = 90; this.boss && (this.boss.harmless = true); this.after(95, () => { this.state = 'dead'; this.gameOver = new GameOver(this); this.slow = 0; }); }

  // -------------------------------------------------------------------------------- rooms
  loadRoom(id, pos, dir = 1) {
    const def = this.world.rooms[id], S = this.save, tiles = Uint8Array.from(def.tiles);
    for (let ty = 0; ty < def.h; ty++) for (let tx = 0; tx < def.w; tx++) { const v = tiles[ty * def.w + tx]; if ((v === 4 || v === 5 || v === 6 || v === 8) && S.flags[`b_${id}_${tx}_${ty}`]) tiles[ty * def.w + tx] = 0; }
    for (const lv of def.levers || []) if (S.flags[lv.id]) for (const [gx, gy] of lv.gate) tiles[gy * def.w + gx] = 0;          // (a gate whose lever has been thrown stays raised)
    if (id === 'ib' && S.flags.boss_ib) for (let ty = def.h - 2; ty < def.h; ty++) for (let tx = 5; tx <= def.w - 6; tx++) tiles[ty * def.w + tx] = 0;          // (the Rimewyrm's floor stays shattered: a way down into the Frozen Well)
    const prevZone = this.zone; this.room = new Room({ ...def, tiles, ...(def.currents ? { currents: def.currents.map(c => ({ ...c })) } : {}) }); /* (the room gets its OWN copy of the currents: a boss may change their speed, and the castle's blueprint must not remember it) */ this.room.flags = S.flags; this.room.ignited = new Set(); this.room.fireOut = def.zone === 6 && !!S.flags.boss_vb; if (S.flags.boss_vb) S.flags.village_fire = true; S.visited[id] = true; this.zone = def.zone;          // (the room can see the save's flags: scenery such as the sigils over a locked door reads them)
    { const spk = []; for (let ty = 0; ty < def.h; ty++) for (let tx = 0; tx < def.w; tx++) if (tiles[ty * def.w + tx] === TILE.SPIKE) spk.push([tx, ty]); if (spk.length) this.room.decos = def.decos.filter(d => !decoCoversHazard(d, spk)); }          // nothing may stand in front of a hazard
    if (this.gaze) { this.gaze = null; this.playerFrozen = false; } this.gateAnims = []; this.hatchAnim = null; for (const d of this.room.decos) if (d.t === 'hatch') d.p = S.flags[d.lever] ? 1 : 0;          // (a hatch whose lever has been thrown stays drawn back: p = how far it has slid, 0..1)
    this.blackout = null; this.well = null; this.enemies = []; this.projectiles = []; this.pickups = []; this.props = []; this.popups = []; this.boss = null; this.delayed = []; this.fx.reset(); this.fx.setWisps(def.wisps || 0); this.flames = roomFlames(this.room); this.smokeSpots = this.room.fireOut ? this.room.decos.filter(d => d.t === 'blaze' && !d.small).map(d => ({ x: d.x, y: d.y })) : []; this.falls = this.room.decos.filter(d => d.t === 'waterfall'); this.fx.setWater(this.waterList()); this.mirrorView = def.mirror ? new MirrorView(def.mirror, !!S.flags['boss_' + id]) : null;          // (the Mirror Room: a great mirror - whole until you walk up to it)
    const dusk = def.zone === 6 && !S.flags.village_fire && !def.keepLook;          // Prague before the Cinder Warden's torches: a calm violet dusk, with golden dust in the air - the monsters are loose, but nothing burns yet
    A.hush = 1; this.fx.setShadowMask(this.room); this.fx.setAmbient(dusk ? Math.max(def.ambient, 0.42) : def.ambient, dusk ? [0.05, 0.03, 0.12] : this.room.fireOut ? [0.09, 0.05, 0.06] : def.tint, def.vig); if (def.dark) this.fx.setDark(); this.fx.setAmbientFx(dusk ? 'dust' : this.room.fireOut ? 'mist' : def.weather); A.setIndoor(def.indoor); this.fx.setStorm(def.storm, 0.0035);
    this.fx.setFog(def.theme === 'graveyard' && def.weather === 'rain' ? 0 : def.fog * (def.theme === 'swamp' ? 0.8 * 0.9 : 1),          // (no ground fog in the rain of the Graveyard)
       def.horizon + 4, FOG_COL[def.theme] || FOG_COL.default, def.fogH);          // rolling ground fog in the damp, dead places
    this.room.pitFade = def.pitFade ? { ...def.pitFade, on: true, m: 0, d: 0, base: this.fx.ambBase } : null;          // (a room whose music and light fade as you cross it)
    this.room.movers = def.movers ? new Movers(def.movers) : null; this.icicles = (def.icicleTraps || []).map(d => new Icicle(d)); this.jets = def.jets && !(def.jetsBoss && this.save && this.save.flags['boss_' + id]) ? def.jets.map(d => new SteamJet(d)) : [];          // (steam jets: in a boss's room they are only there while the boss lives)
    this.player.ride = null; this.graves = this.room.decos.filter(d => d.t === 'grave'); this.ghost.snap();
    if (def.disco) { this.room.discoState = { mode: S.flags.disco_done ? 'gone' : 'party', t0: 0 }; A.preload('record_scratch'); }
    const bossDone = !!S.flags['boss_' + id];
    for (let si = 0; si < def.spawns.length; si++) {
      const s = def.spawns[si], o = s.o || {}, x = s.x * 16 + 8, y = s.y * 16;
      if (s.type === 'statue') this.props.push(new Statue(x, y, o));
      else if (s.type === 'altar') this.props.push(new Altar(x, y));
      else if (s.type === 'shopkeeper') this.props.push(new Shopkeeper(x, y, o));
      else if (s.type === 'barrel') this.props.push(new Barrel(x, y, o));
      else if (s.type === 'waystone') this.props.push(new Waystone(x, y, { id: 'tp_' + id }));
      else if (s.type === 'itemspawn') { if (!S.flags[o.id]) { const pk = new Pickup('it_' + o.item, x, y - 6, 0, 0); pk.qty = o.qty || pk.qty; pk.flagId = o.id; pk.life = 1e9; this.pickups.push(pk); } }
      else if (s.type === 'tablet') this.props.push(new Tablet(x, y, o));
      else if (s.type === 'bell') this.props.push(new Bell(x, y, o));
      else if (s.type === 'litcandle') this.props.push(new LitCandle(x, y, { ...o, open: !!S.flags[o.id] }));
      else if (s.type === 'skull') { if (!S.flags[o.id]) this.props.push(new Skull(x, y, o)); }
      else if (s.type === 'lever') this.props.push(new Lever(x, y, { ...o, open: !!S.flags[o.id] }));
      else if (s.type === 'chest') { const c = new Chest(x, y, o); if (S.flags[o.id]) { c.open = true; if (!S.flags[o.id + '_u']) chestGift(this, x, y - 22, o.contents, o.id + '_u'); } this.props.push(c); }
      else if (s.type === 'upgrade') { if (!S.flags[o.id] && (o.kind !== 'silberzahn' || !S.flags.opening_seen || S.flags.sword_lost)) this.props.push(new Upgrade(x, y - 12 + 0, o)); }
      else if (s.type.startsWith('boss_')) {
        if (bossDone) { if (o.page && !S.flags['page' + o.page]) this.props.push(new Upgrade(this.roomCenterX(def) + 44, this.groundBelow(this.roomCenterX(def) + 44, 6 * 16) - 12, { kind: 'page', n: o.page, id: 'page' + o.page, secret: true })); if (UPGRADES[o.reward]) { if (!S.flags['bu_' + id]) this.props.push(new Upgrade(this.roomCenterX(def), this.groundBelow(this.roomCenterX(def), 6 * 16) - 12, { kind: o.reward, id: 'bu_' + id })); }
          else if (o.reward && o.reward !== 'dawn' && o.reward !== 'well' && !S.abilities[this.rewardKey(o.reward)]) this.props.push(new Relic(this.roomCenterX(def), this.groundBelow(this.roomCenterX(def), 6 * 16), o.reward === 'djump' ? 'djump' : o.reward)); }
        else { const b = this.spawnEnemy(s.type, s.x, s.y, o); b.reward = o.reward; this.pendingBoss = b; }
      } else {
        const e = this.spawnEnemy(s.type, s.x, s.y, s.type === 'villager' ? { ...o, uid: id + '#' + si } : o);
        if (e && pos.door && s.type !== 'villager' && Math.hypot(e.x - pos.x, e.y - pos.y) < DOOR_CLEAR) this.enemies.splice(this.enemies.indexOf(e), 1);          // coming out of a door: nothing waits for you on the other side (measured from where it really stands)
      }
    }
    // player
    const dirp = pos.dir || dir; this.player.place(pos.x, pos.y, dirp); this.player.invT = Math.max(this.player.invT, 40);
    this.snapCamera();
    // music + banners
    this.chase = def.chase && pos && pos.y > def.h * 8 ? this.beginChase(def) : null;          // (the Bell Tower: entered from the street, it is already burning)
    const nearZones = new Set(); for (const e of [...(def.exits || []), ...(def.doors || [])]) { const rz = this.world.rooms[e.room]; if (rz && rz.zone !== undefined && rz.zone !== def.zone) nearZones.add(rz.zone); }
    loaderFocus(def.zone, [...nearZones]);          // (the background loader fetches this zone's music and sounds first, then those of the zones this room's doors and edges lead to, then the rest of the castle)
    const zm = ZONES[def.zone].music, mus = def.boss ? zm : def.music;
    if (def.disco && S.flags.disco_done) A.stop(0.4); else A.play(mus, { fade: 1.2 });          // (the empty disco is silent)
    const inKeep = KEEP.has(def.zone);
    if (inKeep && prevZone !== undefined && !KEEP.has(prevZone) && !def.save) {          // crossing the threshold: the hero enters ARX NOCTIS (the long card, with a boom, the first time)
      const first = !S.flags.entered_keep; S.flags.entered_keep = true;
      this.banner('ARX NOCTIS', first ? "THE LORD'S KEEP. THE SUN DOES NOT COME HERE." : ZONES[def.zone].name.toUpperCase(), first ? 330 : 230, { y: 52, color: '#ff9a7a' });
      if (first) this.after(36, () => { if (this.state === 'play') { A.sfx('boom'); this.shake(6, 26); this.fx.flash([0.35, 0.2, 0.4], 0.5); } });
    } else if (def.zone !== prevZone && !def.save) this.banner(ZONES[def.zone].name.toUpperCase(), (inKeep ? 'ARX NOCTIS - ' : '') + def.name.toUpperCase(), 200, { y: 52 });
    else this.banner(def.name.toUpperCase(), '', 130, { y: 52, color: '#cfc2a0' });
    if (bossDone && def.seals.length) { /* arena stays open */ }
  }
  rewardKey(r) { return r; }
  roomCenterX(def) { return def.w * 8; }
  groundBelow(x, y0) { const r = this.room; let ty = Math.floor(y0 / T); while (ty < r.h && !r.solid(Math.floor(x / T), ty)) ty++; return ty * T; }

  changeRoom(target, dir) {
    if (this.trans) return; this.trans = { phase: 'out', t: 0, target, dir };
  }
  updateTrans() {
    const tr = this.trans; if (!tr) return; tr.t++;
    if (tr.phase === 'out') { this.fade = Math.min(1, tr.t / 14); if (tr.t >= 16) { const tg = tr.target; this.loadRoom(tg.room, { x: tg.x, y: tg.y, door: tg.door }, tr.dir); tr.phase = 'in'; tr.t = 0; } }
    else { this.fade = Math.max(0, 1 - tr.t / 16); if (tr.t >= 16) { this.trans = null; this.fade = 0; } }
  }
  checkExits() {
    const p = this.player, r = this.room; if (this.trans || p.dead) return;
    const row = Math.floor((p.y - 12) / T);
    if (p.x < 3) { const e = r.exitRows.L[row]; if (e && p.vx <= 0) this.changeRoom({ room: e.room, x: e.tx * 16 + 8, y: e.gy * 16 }, -1); }
    else if (p.x > r.pw - 3) { const e = r.exitRows.R[row]; if (e && p.vx >= 0) this.changeRoom({ room: e.room, x: e.tx * 16 + 8, y: e.gy * 16 }, 1); }
    if (r.id === 'ib' && this.save.flags.boss_ib && p.y > r.ph - 4 && !p.dead && !this.well) { this.enterWell(); return; }          // (the broken arena: a drop into the Frozen Well)
    if (r.id === 'pd' && p.y > r.ph - 4 && !p.dead && !this.trans) { this.enterAbyss(); return; }          // (the Pit of Despair has no bottom, until you reach it)
    if (r.dropTo && p.y > r.ph - 4 && !p.dead && !this.trans) { this.dropInto(r.dropTo); return; }          // (a floor with a way through: the loose planks of the Cooper's House drop into the cellar)
    if (p.y > r.ph + 48 && !p.dead) { p.hurt(10, p.x, { kb: 0 }); this.respawnAtSafe(p); }
  }
  respawnAtSafe(p) { this.after(0, () => { p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.vx = p.vy = 0; p.invT = 90; this.fx.flash([0.6, 0.4, 1], 0.3); this.fx.burst(p.x, p.y - 16, 10, COLORS.purple, { speed: 1.5 }); }); }

  // -------------------------------------------------------------------------------- interaction
  nearInteractable() {
    const p = this.player, pb = { x: p.x - 14, y: p.y - 40, w: 28, h: 44 };
    for (const o of this.props) if (o.interact && !o.dead && overlap(pb, o.box) && !(o.open === true)) return { kind: 'prop', o, x: o.x, y: o.y - (o.box.h + 8) };
    if (!(this.boss && this.boss.active && !this.boss.dying)) for (const d of this.room.doors) if (Math.abs(p.x - (d.x * 16 + 8)) < 14 && Math.abs(p.y - d.gy * 16) < 10) return { kind: 'door', d, x: d.x * 16 + 8, y: d.gy * 16 - 54 };
    for (const e of this.enemies) if (e.talk && !e.dead && Math.abs(p.x - e.x) < 26 && Math.abs(p.y - e.y) < 24) return { kind: 'npc', e, x: e.x, y: e.y - 58 };            // people you can talk to
    return null;
  }
  interact() {
    const n = this.nearInteractable(); if (!n) return false;
    if (n.kind === 'prop') return n.o.interact(this);
    if (n.kind === 'npc') { n.e.talk(this); return true; }
    if (n.d.key && !this.save.flags['unlocked_' + n.d.key]) {          // a locked door: it opens (for good) if you carry its key
      const K = KEYS.find(k => k.id === n.d.key);
      if (!this.save.flags['has_' + n.d.key]) { A.sfx('back'); this.showDialog((dtext('door locked') || 'THE DOOR IS LOCKED. IT NEEDS THE {KEY}.').replace('{KEY}', K ? K.name : 'KEY')); return true; }
      this.save.flags['unlocked_' + n.d.key] = true; A.sfx('door'); this.fx.burst(n.d.x * 16 + 8, n.d.gy * 16 - 22, 12, K ? [K.rgb.map(v => v / 255), [1, 1, 0.9]] : COLORS.gold, { speed: 1.6 }); this.banner('UNLOCKED', K ? K.name + ' USED' : '', 110, { y: 52, color: '#ffe9a0' });
    }
    if (n.d.lock) {                                          // a door sealed until bosses fall: one sigil for each
      const left = n.d.lock.filter(f => !this.save.flags[f]);
      if (left.length && left[0] === 'skulls_done') { A.sfx('back'); return true; }          // (the door of the Reliquary says nothing: the skulls are a secret)
      if (left.length) { A.sfx('back'); this.showDialog((dtext('door sigils') || 'THE DOOR WILL NOT OPEN. {LIT} OF {TOTAL} SIGILS BURN. {HINTS}').replace('{LIT}', n.d.lock.length - left.length).replace('{TOTAL}', n.d.lock.length).replace('{HINTS}', left.map(f => dtext('lockhint ' + f) || LOCK_HINTS[f]).filter(Boolean).join(' ') || n.d.lockText || '')); return true; }          // (and it says where each master that still lives is to be found)
    }
    A.sfx('door'); this.changeRoom({ room: n.d.room, x: n.d.tx * 16 + 8, y: n.d.tgy * 16, door: true }, 1); return true;
  }

  // -------------------------------------------------------------------------------- combat resolution
  // the Tide Blade: a dash cuts through whatever it passes through (each foe once per dash)
  dashHit(p) {
    const box = { x: p.x - 16, y: p.y - 38, w: 32, h: 38 }; let hit = false;
    for (const e of this.enemies) {
      if (e.dead || e.calm || e.talk || !e.hitBy(box)) continue;
      if (e.hurt(Math.round(p.swordDamage() * 0.9) + 2, p.dir, { id: p.dashAtkId, kb: 1.5 })) { hit = true; this.fx.sparks(e.x, e.cy, 6, [[0.55, 0.88, 1], [0.2, 0.5, 1]], 3, {}); this.fx.ring(e.x, e.cy, 26, [0.5, 0.85, 1], 12, 0.2); }
    }
    if (hit && !p.dashHitDone) { p.dashHitDone = true; this.hitstop = 2; A.sfx('hit'); }
    if (p.t % 2 === 0) this.fx.burst(p.x - p.dir * 8, p.y - 14, 2, [[0.6, 0.88, 1], [0.3, 0.55, 1]], { speed: 0.8, s0: 8, s1: 2, l0: 10, l1: 18 });
  }
  // the Mirror Shard: an enemy's arrow, bone, orb or thrown item is sent back (at the nearest foe in front, else straight back), faster, and now it hurts them
  reflectable(pr) { return pr.owner === 'enemy' && !pr.reflected && typeof pr.vx === 'number' && typeof pr.vy === 'number' && !(pr instanceof Column) && !(pr instanceof Shockwave) && !(pr instanceof FirePatch) && pr.kind !== 'wisp'; }
  reflect(pr, p) {
    const sp = Math.max(2.6, Math.hypot(pr.vx, pr.vy) * 1.25); const ang = Math.atan2(-pr.vy, -pr.vx);          // (a reflected shot is only turned aside: it flies back the way it came and hurts nothing)
    pr.owner = 'player'; pr.reflected = true; pr.vx = Math.cos(ang) * sp; pr.vy = Math.sin(ang) * sp; pr.grav = 0; pr.pierce = false; pr.life = Math.max(pr.life || 0, 140); pr.dmg = 0;
    A.sfx('block'); this.fx.ring(pr.x, pr.y, 22, [0.8, 0.9, 1], 12, 0.25); this.fx.sparks(pr.x, pr.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 3, {}); this.popup(pr.x, pr.y - 12, 'REFLECTED', '#cfe2ff');
  }
  swordHit(p) {
    const box = p.attackBox(), dir = p.dir; let hit = false;
    for (const e of this.enemies) {
      if (e.dead || !e.hitBy(box)) continue;
      if (e.hurt(p.swordDamage(), dir, { id: p.atkId, kb: p.seq.kb })) {
        hit = true; p.gainMp(1.2); this.fx.sparks(e.x, e.cy, 4, COLORS.white, 3, { dir: dir > 0 ? 0 : Math.PI, spread: 0.6 });
        if (!e.dead) p.onSwordHit(e);                          // enchantment procs: freeze
      }
    }
    for (const o of this.props) if (o.hit && !o.dead && overlap(box, o.box)) { if (o.hit(this, p.swordDamage(), dir)) { hit = true; p.gainMp(2); } }
    // breakable walls
    const tx0 = Math.floor(box.x / T), tx1 = Math.floor((box.x + box.w) / T), ty0 = Math.floor(box.y / T), ty1 = Math.floor((box.y + box.h) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.room.get(tx, ty) === TILE.CRACK) { if (this.hitBookTile(tx, ty, p.atkId)) hit = true; else { this.breakTile(tx, ty); hit = true; } }
    for (const pr of this.projectiles) {
      if (pr.dead || pr.reflected || !overlap(box, pr.box)) continue;          // (a reflected one is already on its way: the rest of the swing must not cut it down)
      if (this.save.flags.got_shard && this.reflectable(pr)) { this.reflect(pr, p); hit = true; continue; }          // the Mirror Shard: it goes back where it came from
      if (pr.k && (pr.kind === 'bone' || pr.kind === 'ember' || pr.destructible)) { pr.explode(this); hit = true; }
    }
    if (hit && p.hitsThisSwing++ === 0) { this.hitstop = 3; this.shake(1.5, 5); }
  }
  // A LEVER is thrown: its flag is kept, and the camera glides over to the gate it works (when that is out of sight), which rises; then the camera comes back.  (The hero stands still, and cannot be hurt, for the few seconds it takes.)
  pullLever(lv) {
    const r = this.room, p = this.player, def = (r.levers || []).find(q => q.id === lv.id); this.save.flags[lv.id] = true; A.sfx('door'); A.sfx('click'); this.shake(2, 8);
    this.fx.sparks(lv.x, lv.y - 16, 10, [[1, 0.9, 0.6], [0.8, 0.8, 1]], 2.5, { gy: 0.1 }); this.fx.ring(lv.x, lv.y - 14, 26, [1, 0.8, 0.5], 14, 0.2);
    if (!def) return;
    const gx = def.gate.reduce((a, q) => a + q[0], 0) / def.gate.length * 16 + 8, gy = (Math.min(...def.gate.map(q => q[1])) + Math.max(...def.gate.map(q => q[1]))) / 2 * 16 + 8, seen = gx > this.camera.x + 70 && gx < this.camera.x + W - 70;
    this.gaze = { x: gx, y: gy, def, t: 0, pan: seen ? 0 : 34, opened: false }; this.playerFrozen = true; p.vx = 0; p.invT = Math.max(p.invT, 220);
  }
  stepGaze() {
    const gz = this.gaze; gz.t++;
    if (!gz.opened && gz.t >= gz.pan + 10) { gz.opened = true; if (gz.def.kind === 'hatch') this.openHatch(gz.def); else this.openGate(gz.def.gate); }
    if (gz.t >= gz.pan + 10 + 72) { this.gaze = null; this.playerFrozen = false; this.player.invT = Math.max(this.player.invT, 30); }
  }
  // the gate rises: its bars slide up out of sight (drawn by drawGates), and once there is room to walk under, the tiles are cleared
  openGate(tiles) {
    const r = this.room; r.gateRising = r.gateRising || new Set(); for (const [tx, ty] of tiles) r.gateRising.add(tx + ',' + ty); r.dirty = true;
    const cols = new Map(); for (const [tx, ty] of tiles) { const c = cols.get(tx) || []; c.push(ty); cols.set(tx, c); }
    for (const [tx, ys] of cols) { const y0 = Math.min(...ys), y1 = Math.max(...ys) + 1; this.gateAnims.push({ tx, y0, y1, t: 0, dur: 72 }); const x = tx * 16 + 8; this.fx.burst(x, y1 * 16 - 4, 8, [[0.5, 0.45, 0.4], [0.3, 0.28, 0.26]], { speed: 1.4, s0: 9, gy: 0.02 }); }
    A.sfx('seal'); A.sfx('gear'); this.shake(3, 40);
    this.after(30, () => { const rr = this.room; if (rr !== r) return; for (const [tx, ty] of tiles) if (rr.get(tx, ty) === TILE.GATE) rr.set(tx, ty, TILE.EMPTY); });
  }
  // A HATCH in the floor draws back: its leaf slides under the floor beside it, and each column of floor under it is cleared as the leaf's edge passes (a hole into the room below: see def.dropTo)
  openHatch(def) {
    const d = this.room.decos.find(q => q.t === 'hatch' && q.lever === def.id); if (!d) { for (const [tx, ty] of def.gate) this.room.set(tx, ty, TILE.EMPTY); this.room.dirty = true; return; }
    this.hatchAnim = { d, def, t: 0, dur: 54 }; A.sfx('door'); A.sfx('gear'); this.shake(2, 30);
  }
  stepHatch() {
    const a = this.hatchAnim, r = this.room, w = a.d.w || 48; a.t++;
    const p = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - p, 2); a.d.p = e;
    for (const [tx, ty] of a.def.gate) if (r.get(tx, ty) !== TILE.EMPTY && e * w >= w - 16 * (tx - a.def.hx)) { r.set(tx, ty, TILE.EMPTY); r.dirty = true; if (ty === 12) this.fx.burst(tx * 16 + 8, ty * 16 + 6, 6, [[0.5, 0.4, 0.3], [0.3, 0.25, 0.2]], { speed: 1.2, s0: 8, gy: 0.03 }); }
    if (a.t % 8 === 0 && p < 1) A.sfx('gear');
    if (p >= 1) { A.sfx('click'); this.hatchAnim = null; }
  }
  // walking up to a gate that is still down: a few words, now and then, so it is clear what it is
  gateHint() {
    const p = this.player, S = this.save; if (p.dead || this.gaze || this.frame < (this.gateHintT || 0)) return;
    for (const lv of this.room.levers) {
      if (S.flags[lv.id] || lv.kind === 'hatch') continue; const x0 = lv.gate[0][0] * 16, ys = lv.gate.map(q => q[1]), y0 = Math.min(...ys) * 16, y1 = (Math.max(...ys) + 1) * 16;
      if (p.x > x0 - 24 && p.x < x0 + 56 && p.y > y0 && p.y < y1 + 8) { this.popup(p.x, p.y - 48, 'BARRED - A LEVER MUST RAISE IT', '#e8dcc0'); this.gateHintT = this.frame + 300; A.sfx('back'); return; }
    }
  }
  gateLift(a) { return (1 - Math.pow(1 - Math.min(1, a.t / a.dur), 2)) * (a.y1 - a.y0 + 0.5) * 16; }          // how far (px) a rising gate's bars have gone up
  stepGates() {
    for (let i = this.gateAnims.length - 1; i >= 0; i--) {
      const a = this.gateAnims[i]; a.t++;
      if (a.t % 5 === 0 && a.t < a.dur) { A.sfx('gear'); this.fx.emit({ x: a.tx * 16 + 8 + rand(-7, 7), y: a.y1 * 16 - this.gateLift(a) + 2, vx: rand(-0.2, 0.2), vy: rand(0.2, 0.7), life: 22, s0: 4, s1: 1, c0: [0.7, 0.62, 0.5], a0: 0.8, a1: 0, kind: 6, gy: 0.03 }); }
      if (a.t >= a.dur) this.gateAnims.splice(i, 1);
    }
    if (!this.gateAnims.length && this.room.gateRising && this.room.gateRising.size) this.room.gateRising.clear();
  }
  drawGates(ctx, cx, cy) {
    for (const a of this.gateAnims) {
      const up = this.gateLift(a), X = a.tx * 16 - cx, Y0 = a.y0 * 16 - cy, H0 = (a.y1 - a.y0) * 16;
      ctx.save(); ctx.beginPath(); ctx.rect(X - 1, Y0, 18, H0); ctx.clip();
      for (let ty = a.y0; ty < a.y1; ty++) drawGateTile(ctx, X, ty * 16 - cy - up, this.room.theme, ty === a.y0, ty);
      ctx.restore();
    }
  }
  // a block of the Librarian's wall of books: it takes three blows (one a swing), shaking and shedding pages, before it breaks.  Returns true if it was one of those.
  hitBookTile(tx, ty, id) {
    const w = this.room.bookWall, b = w && w.get(tx + ',' + ty); if (!b) return false;
    if (b.hit === id) return true; b.hit = id; const x = tx * 16 + 8, y = ty * 16 + 8;
    if (--b.hp <= 0) { this.breakTile(tx, ty); return true; }
    A.sfx('hit'); this.fx.burst(x, y, 4, [[0.95, 0.85, 0.6], [0.5, 0.3, 0.12]], { speed: 1.4, s0: 8, gy: 0.05 }); this.fx.sparks(x, y, 3, [[1, 0.9, 0.6]], 2, { gy: 0.1 }); return true;
  }
  breakTile(tx, ty) {
    const r = this.room, v = r.get(tx, ty); if (v !== TILE.CRACK && v !== TILE.BARRICADE && v !== TILE.CRYSTAL && v !== TILE.ICE) return;
    if (v === TILE.CRACK && r.isHollow(tx, ty)) { A.sfx('block'); this.fx.ring(tx * 16 + 8, ty * 16 + 8, 22, [0.8, 0.85, 1], 14, 0.2); }          // (a hollow wall rings under the blow)
    const bk = r.bookWall && r.bookWall.has(tx + ',' + ty); r.set(tx, ty, TILE.EMPTY); if (bk) r.bookWall.delete(tx + ',' + ty); else this.save.flags[`b_${r.id}_${tx}_${ty}`] = true; const x = tx * 16 + 8, y = ty * 16 + 8;
    if (bk) { this.fx.burst(x, y, 10, [[0.95, 0.85, 0.6], [0.5, 0.3, 0.12]], { speed: 2, s0: 11, up: 0.4, gy: 0.05 }); this.fx.sparks(x, y, 7, [[1, 0.9, 0.6], [1, 0.7, 0.3]], 2.5, { gy: 0.1 }); A.sfx('break'); this.shake(1.5, 6); return; }
    if (v === TILE.CRACK) { this.fx.burst(x, y, 10, [[0.7, 0.65, 0.8], [0.3, 0.28, 0.4]], { speed: 2, s0: 12, up: -0.5, gy: 0.05 }); this.fx.sparks(x, y, 8, [[0.8, 0.8, 0.9], [0.4, 0.4, 0.5]], 2.5, { gy: 0.2 }); }
    else if (v === TILE.BARRICADE) { this.fx.burst(x, y, 14, COLORS.fire, { speed: 2, s0: 16 }); this.fx.sparks(x, y, 10, COLORS.fire, 3, { gy: 0.15 }); this.fx.glow(x, y, 50, [1, 0.5, 0.2], 0.8, 14); }
    else if (v === TILE.ICE) { this.fx.burst(x, y, 12, COLORS.ice, { speed: 2.2, s0: 12 }); this.fx.sparks(x, y, 10, COLORS.white, 3, { gy: 0.15 }); this.fx.smoke(x, y, 3, { c0: [0.85, 0.92, 1], c1: [0.6, 0.7, 0.85], s0: 6, s1: 22, l: 0.7 }); this.fx.glow(x, y, 44, [1, 0.6, 0.3], 0.6, 12); }
    else { this.fx.burst(x, y, 12, COLORS.ice, { speed: 2.5, s0: 14 }); this.fx.sparks(x, y, 14, COLORS.white, 4, { gy: 0.2 }); this.fx.flash([0.6, 0.8, 1], 0.25); }
    A.sfx(v === TILE.ICE ? 'shatter' : 'break'); this.shake(2, 8);
  }
  meltIce(tx, ty) { const q = [[tx, ty]], seen = new Set(); while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || this.room.get(x, y) !== TILE.ICE) continue; seen.add(k); this.breakTile(x, y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } }          // (fire melts a whole barrier of ice, block by block)
  burnBarricade(tx, ty) { const q = [[tx, ty]], seen = new Set(); while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || this.room.get(x, y) !== TILE.BARRICADE) continue; seen.add(k); this.breakTile(x, y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } }
  castThunder(p) {
    const S = this.save, dmg = 20 + Math.round(p.atkPower * 1.3), cam = this.camera;
    const targets = this.enemies.filter(e => !e.dead && !e.invuln && e.x > cam.x - 20 && e.x < cam.x + W + 20 && e.cy > cam.y - 10 && e.cy < cam.y + H + 10).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, 4);
    A.sfx('crack'); A.sfx('thunder', { power: 0.6 }); this.fx.flash([0.7, 0.85, 1], 0.55); this.shake(4, 14);
    const id = -(++this.attackCounter);
    targets.forEach((e, i) => this.after(i * 5, () => { if (e.dead) return; this.fx.bolt(e.x + rand(-5, 5), cam.y - 20, e.x, e.cy, { width: 18, life: 24 }); e.hurt(dmg, p.dir, { id: id - i * 1000, color: '#9cf', kb: 1 }); }));
    if (!targets.length) this.fx.bolt(p.x + p.dir * 90, cam.y - 20, p.x + p.dir * 90, p.y - 2, { width: 18, life: 24 });
    // crystals within reach
    const r = this.room, px = Math.floor(p.x / T), py = Math.floor((p.y - 16) / T);
    for (let ty = py - 5; ty <= py + 5; ty++) for (let tx = px - 11; tx <= px + 11; tx++) if (r.get(tx, ty) === TILE.CRYSTAL) { this.fx.bolt(tx * 16 + 8, cam.y - 20, tx * 16 + 8, ty * 16 + 8, { width: 16, life: 20, impact: false }); this.after(6, () => this.breakTile(tx, ty)); }
  }
  // the barrier that shuts you in with a boss: a wall of spectral blue flame (its tiles are solid; the flames are the effects layer's)
  sealFlames() {
    const r = this.room, cam = this.camera, fx = this.fx; if (!r || !r.anim || !r.anim.length) return;
    for (const [tx, ty, v] of r.anim) {
      if (v !== TILE.SEAL) continue; const x = tx * T + 8; if (x < cam.x - 24 || x > cam.x + W + 24) continue; const y = ty * T + 16;
      fx.fire(x, y, { scale: 1.3, color: 'blue', n: 2 }); fx.glow(x, y - 8, 30, [0.35, 0.6, 1], 0.3); fx.light(x, y - 8, 58, 0.55, [0.4, 0.6, 1]);
      if (this.frame % 4 === 0) fx.emit({ x: x + rand(-4, 4), y: y - 12, vx: rand(-0.25, 0.25), vy: -rand(0.6, 1.2), life: rand(26, 46), s0: 9, s1: 2, c0: [0.7, 0.88, 1], c1: [0.2, 0.35, 1], a0: 0.9, a1: 0, kind: 2 });
    }
  }
  updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.update(this); if (pr.dead) continue;
      if (pr instanceof Column) continue;
      const box = pr.box;
      if (pr.owner === 'player') {
        if (!pr.reflected) for (const e of this.enemies) if (!e.dead && e.hitBy(box)) { if (e.hurt(pr.dmg, pr.vx >= 0 ? 1 : -1, { id: -(this.attackCounter + 5000 + Math.floor(Math.random() * 1e6)), color: '#ffb060', kb: 1.4, fire: !!pr.fireTiles })) { pr.explode(this); break; } }
        for (const o of this.props) if (o.hit && !o.dead && overlap(box, o.box)) { o.hit(this, pr.dmg, 1); pr.explode(this); break; }
      } else if (!p.dead && overlap(box, p.hurtbox)) {
        if (p.hurt(pr.dmg, pr.x, { kb: pr instanceof FirePatch ? 1 : 2 })) { if (!(pr instanceof Shockwave) && !(pr instanceof FirePatch) && !pr.pierce) pr.explode ? pr.explode(this) : (pr.dead = true); }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  // -------------------------------------------------------------------------------- bosses
  startBoss(b) {
    const def = this.room, S = this.save; this.boss = b; HUD.lagBoss = 1;
    for (const s of def.seals) for (let y = s.y0; y <= s.y1; y++) if (def.get(s.x, y) === TILE.EMPTY) def.set(s.x, y, TILE.SEAL);
    A.sfx('seal'); this.fx.flash([0.6, 0.4, 1], 0.3); this.shake(3, 20);
    A.play(def.id === 't2' ? 'boss_final' : 'boss', { fade: 0.4 }); this.banner(b.bossName, b.sub, 210, { y: 60, color: '#ff9a7a' });
    const tk = STORY.talk[b.bossName]; if (tk && !S.flags["talk_" + b.bossName]) { S.flags["talk_" + b.bossName] = true; this.talk(tk.before); }          // a few words before the fight (once)
  }
  noteKill(e) { if (this.save) noteKill(this, e); }          // (the bestiary counts every creature you defeat)
  bossDying(b) {
    noteKill(this, b);
    this.slow = 150; A.stop(1.5); this.player.invT = 999; this.fx.flash([1, 1, 1], 0.5);
    for (const pr of this.projectiles) pr.dead = true; for (const e of this.enemies) if (!e.isBoss && !e.dead) e.die();
  }
  bossDefeated(b) {
    const S = this.save, r = this.room; S.flags['boss_' + r.id] = true; for (const j of this.jets || []) j.disabled = true; this.slow = 0; this.player.invT = 90; this.boss = null;
    for (let ty = 0; ty < r.h; ty++) for (let tx = 0; tx < r.w; tx++) if (r.get(tx, ty) === TILE.SEAL) r.set(tx, ty, TILE.EMPTY);
    A.sfx('unseal'); this.shake(5, 30);
    const sg = sigilOf('boss_' + r.id);          // a boss whose death lights a sigil on a sealed door: the sigil is shown first, before anything else (his dying words, the reward, the ending)
    if (sg) { const p = this.player; p.invT = 99999; p.vx = 0; this.playerFrozen = true; this.sigilCard = { name: sg, t: 0, dur: 240 }; A.sfx('item'); this.fx.flash([1, 0.8, 0.45], 0.25); this.after(240, () => { this.sigilCard = null; this.playerFrozen = false; p.invT = 90; this.bossAftermath(b); }); return; }
    this.bossAftermath(b);
  }
  bossAftermath(b) {
    const S = this.save, r = this.room;
    if (b.reward === 'dawn') { const toEnding = () => { this.state = 'ending'; this.ending = new Ending(this); A.play('ending', { fade: 2 }); this.fx.setAmbient(0, [0, 0, 0], 0); this.fx.setStorm(false); this.fx.setAmbientFx('dust'); S.kills = (S.kills || 0) + this.kills; }; const tk = STORY.talk[b.bossName]; this.after(120, () => { if (tk && tk.after) this.talk(tk.after, toEnding); else toEnding(); }); return; }          // (his dying words, then the sun)
    if (b.reward === 'well') { this.startWell(); return; }          // (the Rimewyrm drops nothing: the ice of the floor gives way, and its treasure waits below)
    const gy = this.groundBelow(b.x, b.y - 8);
    if (UPGRADES[b.reward]) this.props.push(new Upgrade(b.x, gy - 12, { kind: b.reward, id: 'bu_' + r.id })); else this.props.push(new Relic(b.x, gy, b.reward));
    if (b.o && b.o.page && !S.flags['page' + b.o.page]) this.props.push(new Upgrade(b.x + 44, gy - 12, { kind: 'page', n: b.o.page, id: 'page' + b.o.page, secret: true }));          // (Baelphegaz harvests misery: a letter he was carrying falls from him)
    for (const [kind, dx] of [['it_bandage', -26], ['it_' + randomItemId(), 26], ['it_dagger', 38]]) this.pickups.push(new Pickup(kind, b.x + dx, b.cy - 20));       // a boss leaves supplies behind
    { const tk = STORY.talk[b.bossName]; if (tk && tk.after) this.after(110, () => { if (this.state === "play") this.talk(tk.after); }); }          // and a few more as it dies
    this.after(420, () => { if (this.state === 'play' && !this.boss) A.play(ZONES[r.zone].music, { fade: 2 }); });
  }
  // THE WELL.  The hero stands on the ice; cracks run out across the floor; then it all shatters and he falls (into the Frozen Well, a room of its own).  Falling out of the broken arena again later
  // brings him back to the well, so the chests can always be reached.
  startWell() { const p = this.player; this.well = { t: 0, phase: 'crack' }; this.playerFrozen = true; p.vx = 0; p.invT = 99999; this.fx.flash([0.8, 0.95, 1], 0.4); }
  stepWell() {
    const w = this.well, r = this.room, p = this.player, base = r.h - 2; w.t++;
    if (w.phase === 'crack') {
      const reach = Math.floor(w.t / 7);                                                                                // the cracks spread out from under the hero's feet
      for (let tx = Math.floor(p.x / 16) - reach; tx <= Math.floor(p.x / 16) + reach; tx++) if (r.get(tx, base) === TILE.SOLID) { r.set(tx, base, TILE.CRACK); this.fx.sparks(tx * 16 + 8, base * 16, 3, COLORS.white, 2, { gy: 0.1 }); }
      if (w.t % 9 === 1) { A.sfx('crack'); this.shake(2, 10); }
      if (w.t === 118) {                                                                                                // ...and the floor goes
        for (let tx = 5; tx <= r.w - 6; tx++) for (let ty = base; ty < r.h; ty++) { if (r.get(tx, ty) !== TILE.EMPTY) r.set(tx, ty, TILE.EMPTY); if (tx % 2 === 0 && ty === base) { this.fx.burst(tx * 16 + 8, ty * 16 + 8, 8, COLORS.ice, { speed: 2.4, s0: 12 }); this.fx.sparks(tx * 16 + 8, ty * 16, 6, COLORS.white, 3, { gy: 0.2 }); } }
        A.sfx('shatter'); A.sfx('boom'); this.shake(10, 44); this.fx.flash([0.8, 0.95, 1], 0.5); this.playerFrozen = false; p.vx = 0; w.phase = 'fall';
      }
    } else if (w.phase === 'fall' && p.y > r.ph - 4) { this.well = null; this.enterWell(); }
  }
  dropInto(d) { if (this.trans) return; const p = this.player; p.invT = Math.max(p.invT, 120); p.vx = 0; A.sfx('land'); this.changeRoom({ room: d.room, x: d.tx * 16 + 8, y: d.gy * 16 }, 1); }          // (a fall out of the bottom of a room into the one below it: the hero arrives at the top of that room and drops to its floor)
  enterAbyss() { if (this.trans) return; const p = this.player; p.invT = Math.max(p.invT, 600); p.vx = 0; this.changeRoom({ room: 'ls', x: 17 * 16 + 8, y: 3 * 16 }, 1); }          // (a long fall into Letosnik Abyss)
  // the wisp is taken up: she steps out of it, once, and tells him she can go with him now
  lanternScene() {
    const go = () => {
      if (this.state !== 'play') { this.after(30, go); return; }
      const gh = this.ghost, p = this.player; this.bannerObj = null; gh.snapped = false; gh.scene = 900; gh.reveal(900); A.sfx('ghost'); this.fx.ring(p.x - p.dir * 22, p.y - 22, 60, [0.55, 0.78, 1], 40, 0.1); this.fx.flash([0.5, 0.75, 1], 0.25);
      this.after(70, () => this.talk(STORY.lantern.map(voiced), () => {
        gh.scene = 40; A.sfx('item'); this.fx.ring(p.x, p.y - 30, 50, [0.55, 0.78, 1], 30, 0.1); this.fx.sparks(gh.x, gh.y - 22, 22, [[0.7, 0.85, 1], [1, 1, 1]], 3);
        this.banner('SHE TRAVELS WITH YOU', 'THE WISP IS HER LIGHT', 200, { y: 52, color: '#bcd8ff' });
      }));
    };
    this.after(90, go);
  }
  enterWell() { if (this.trans) return; this.player.invT = Math.max(this.player.invT, 600); this.player.vx = 0; this.changeRoom({ room: 'ic', x: 15 * 16 + 8, y: 3 * 16 }, 1); }
  gainAbility(kind, x, y) {
    const S = this.save, a = ABILITIES[kind]; S.abilities[kind] = true; S.flags['got_' + kind] = true; this.cutscene = { t: 0, kind, x, y }; this.playerFrozen = true; this.player.invT = 999;
    A.sfx('ability'); A.play(ZONES[this.room.zone].music, { fade: 0.2 });
    this.fx.flash(a.color, 0.9); this.fx.ring(x, y, 150, a.color, 60, 0.1); this.fx.quad({ kind: 'rays', x, y, w: 300, h: 300, color: a.color, life: 150, spin: 0.02, p: [0, 10], a0: 0.8, a1: 0 }); this.fx.sparks(x, y, 40, [[1, 1, 0.9], a.color], 5, { gy: -0.02 });
    this.banner(a.name, Input.hint(a.desc), 330, { y: 70, color: '#ffe9a0' });
    if (kind === 'ember' || kind === 'thunder') { this.player.spell = kind; }
  }
  // the disco: while the party lasts, coloured pools of light sweep the floor; when the hero reaches the middle of the room the music dies
  discoStep() {
    const r = this.room, st = r && r.discoState; if (!st || st.mode === 'gone') return;
    const p = this.player, t = this.frame;
    for (const b of discoBeams(r, t)) { const rgb = b.white ? [1, 1, 1] : hsl2rgb(b.hue); this.fx.light(b.tx, r.horizon - 6, 70, b.white ? 0.9 : 0.75, rgb); }
    if (st.mode === 'party' && !p.dead && p.x > r.pw / 2) this.discoStop();
  }
  discoStop() {
    const r = this.room, st = r.discoState; st.mode = 'stopped'; st.t0 = this.frame; this.save.flags.disco_done = true;
    A.stop(0.02); A.sample('record_scratch'); this.fx.flash([1, 1, 1], 0.2); this.shake(2, 8); this.saveGame();
  }
  // the story begins on a hill above Prague: the Stranger kneels at a grave and watches the city catch fire (scenes.js OpeningScene).  Played once.
  checkOpening() {
    const r = this.room, S = this.save; if (this.cutscene || this.trans || this.state !== 'play' || !r || r.id !== 'v0' || S.flags.opening_seen) return;
    this.cutscene = { scene: new OpeningScene(this) };
  }
  // the Cinder Warden sets Prague alight: once, as you start up Smouldering Lane (the first street beyond the Waystone Square)
  checkVillageScene() {
    const r = this.room, p = this.player, S = this.save;
    if (this.cutscene || this.trans || this.state !== 'play' || !r || r.id !== 'v2' || S.flags.village_fire || S.flags.boss_vb || p.dead || !p.onGround || this.fade > 0.1) return;
    if (p.x > 9 * T) this.cutscene = { scene: new VillageScene(this) };
  }
  updateCutscene() {
    const c = this.cutscene; if (c.scene) { c.scene.update(); return; } c.t++; this.fx.glow(c.x, c.y, 70 + Math.sin(c.t * 0.2) * 8, ABILITIES[c.kind].color, 0.6); this.fx.light(this.player.x, this.player.y - 20, 120, 1);
    if (c.t % 4 === 0) this.fx.souls(this.player.x, this.player.y - 16, 1, COLORS.gold);
    if (c.t > 260) { this.cutscene = null; this.playerFrozen = false; this.player.invT = 60; this.saveGame(); }
  }

  // -------------------------------------------------------------------------------- logic step
  step() {
    this.frame++; Input.poll(); Touch.sync(this); A.update(1);
    if (Input.pressed.mute) A.toggleMute();
    if (this.blackout) { const b = this.blackout; b.a += clamp(b.aT - b.a, -0.03, 0.03); b.r += clamp(b.rT - b.r, -2, 1.4); }
    for (let i = this.delayed.length - 1; i >= 0; i--) { const d = this.delayed[i]; if (--d.t <= 0) { this.delayed.splice(i, 1); d.fn(); } }
    if (this.well) this.stepWell();
    switch (this.state) {
      case 'title': if (!this.loadingWorld) this.title.update(); this.titleFx(); this.fx.update(1); break;
      case 'intro': this.intro.update(); this.fx.update(1); break;
      case 'play': this.stepPlay(); break;
      case 'dialog': this.dialog.update(); if (this.dialog.closed) { const dlg = this.dialog, cb = dlg.onClose; this.state = 'play'; this.dialog = null; if (cb) cb(dlg.choice); } this.fx.update(0.0); break;
      case 'letter': this.reader.update(); if (this.reader.closed) { const cb = this.reader.onClose; this.reader = null; this.state = 'play'; if (cb) cb(); } this.fx.update(0.0); break;
      case 'pause': this.pauseMenu.update(); break;
      case 'file': this.fx.update(0.0); break;          // (a save file panel is up over the frozen castle: it has the keys and the taps)
      case 'shop': this.shop.update(); this.fx.update(0.0); break;
      case 'map': this.mapScreen.update(); break;
      case 'dead': this.gameOver.update(); this.fx.update(1); break;
      case 'ending': this.ending.update(); this.fx.update(1); break;
    }
    this.updateTrans(); if (this.fadeDir && !this.trans) { this.fade = clamp(this.fade + this.fadeDir * 0.04, 0, 1); if (this.fade <= 0 || this.fade >= 1) this.fadeDir = 0; }
  }
  titleFx() {
    this.fx.setCamera(0, 0);          // (no flames in the corners any more: only the rain)
  }
  stepPlay() {
    const S = this.save, p = this.player, fx = this.fx;
    if (this.hitstop > 0) { this.hitstop--; fx.update(0.5); return; }
    if (this.slow && (this.frame & 1)) { fx.update(0.5); return; }
    if (this.trans && this.trans.phase === 'out') { fx.update(1); return; }
    if (Input.pressed.pause && !this.cutscene && !p.dead) { this.pause(); return; }
    if (Input.pressed.map && !this.cutscene && !p.dead) { this.openMap(); return; }
    if (this.room.pitFade && this.room.pitFade.on) this.stepPitFade();          // (the Last Dark: the music and the light go out as the hero crosses the pit)
    S.time += 1 / 60; if (S.flags.got_athanor && S.mp < S.maxMp) { S.mpAcc = (S.mpAcc || 0) + 1.75 / 540; if (S.mpAcc >= 1) { S.mpAcc -= 1; p.gainMp(1); } }          // (the Athanor: one point of mana every 5.1 seconds, for ever - 75% quicker than its first nine)
    fx.clearLights(); if (this.room && this.room.maskDirty) { this.room.maskDirty = false; fx.setShadowMask(this.room); }
    this.checkVillageScene(); this.checkOpening(); this.discoStep(); this.stepChase();
    if (this.room.movers) { this.room.movers.step(false, this); for (const m of this.room.movers.list) fx.light(m.x, m.y + 6, 70, 0.5, [1, 0.8, 0.45]); }          // the brass platforms glide, and glow a little
    if (this.icicles && this.icicles.length > 14) this.icicles = this.icicles.filter(i => !i.dead); for (const ic of this.icicles || []) ic.step(this); for (const j of this.jets || []) j.step(this);                          // loose icicles: shiver when the hero comes close, then drop
    if (this.smokeSpots && this.smokeSpots.length && this.frame % 5 === 0) for (const sp of this.smokeSpots) if (sp.x > this.camera.x - 40 && sp.x < this.camera.x + W + 40 && sp.y > this.camera.y - 60 && sp.y < this.camera.y + H + 40 && Math.random() < 0.3) fx.smoke(sp.x + rand(-6, 6), sp.y, 1, { c0: [0.5, 0.47, 0.46], c1: [0.28, 0.26, 0.27], s0: 7, s1: 26, l: 1.5, a: 0.4 });          // (the burnt city smoulders: the fires are out - no flames - but smoke still rises from the ruins)
    if (this.cutscene) this.updateCutscene();
    if (this.gaze) this.stepGaze(); if (this.gateAnims.length) this.stepGates(); if (this.hatchAnim) this.stepHatch(); if (this.room.levers && this.frame % 10 === 0) this.gateHint();
    p.update();
    const cam = this.camera, ccx = cam.x + W / 2, ccy = cam.y + H / 2;
    const still = !!(this.cutscene && this.cutscene.scene);          // (during a scripted scene the monsters neither move nor attack)
    if (!still) for (const e of this.enemies) { if (e.dead) continue; if (e.isBoss || (Math.abs(e.x - ccx) < 380 && Math.abs(e.cy - ccy) < 240)) e.update(); }
    if (this.frame % 12 === 0) for (const e of this.enemies) if (!e.dead && Math.abs(e.x - ccx) < W / 2 + 16 && Math.abs(e.cy - ccy) < H / 2) noteSeen(this, e);          // (the bestiary notes what you can see)
    this.enemies = this.enemies.filter(e => !e.dead || (e.isBoss && false));
    if (!still) this.updateProjectiles();
    for (const o of this.pickups) o.update(this); this.pickups = this.pickups.filter(o => !o.dead);
    for (const o of this.props) o.update(this); this.props = this.props.filter(o => !o.dead);
    if (this.frame % 6 === 0 && this.room) {          // breakable ground gives off sparks too: cracked walls lilac, barricades like embers, crystal icy (real particles, no painted glow)
      const cx0 = this.camera.x - 16, cx1 = this.camera.x + W + 16, cy0 = this.camera.y - 16, cy1 = this.camera.y + H + 16;
      for (const [tx, ty, v] of [...(this.room.brk || []), ...(this.room.anim || []).filter(a => a[2] === TILE.CRYSTAL)]) {
        const x = tx * T, y = ty * T; if (x < cx0 || x > cx1 || y < cy0 || y > cy1 || Math.random() > 0.12) continue;
        const k = v === TILE.CRACK ? [0.8, 0.76, 1] : v === TILE.BARRICADE ? [1, 0.6, 0.27] : [0.5, 0.86, 1];
        this.fx.emit({ x: x + rand(1, 15), y: y + rand(2, 15), vx: rand(-0.1, 0.1), vy: -rand(0.12, 0.38), life: rand(55, 100), s0: rand(6.5, 10), s1: 2, c0: k, c1: [1, 1, 0.92], a0: 1, a1: 0, kind: 6 });
      }
    }
    if (this.frame % 40 === 0 && this.room && this.room.hollow) { const p = this.player; for (const k of this.room.hollow) { const [tx, ty] = k.split(',').map(Number); if (this.room.get(tx, ty) !== TILE.CRACK || Math.abs(p.x - tx * 16) > 120 || Math.abs(p.y - ty * 16) > 90) continue; this.fx.emit({ x: tx * 16 + rand(3, 13), y: ty * 16 + rand(0, 4), vx: rand(-0.04, 0.04), vy: rand(0.2, 0.5), life: rand(24, 40), s0: 1.6, s1: 0.6, c0: [0.75, 0.72, 0.68], c1: [0.4, 0.38, 0.36], a0: 0.6, a1: 0, kind: 1 }); } }          // (a thread of dust now and then, from a hollow wall)
    if (this.mirrorView) this.mirrorView.update(this);
    this.sealFlames();
    for (const o of this.popups) o.life--; this.popups = this.popups.filter(o => o.life > 0);
    // lights & flames (only near the camera).  A gust of air (the swish of the sword, a dash) bends a flame away from it, and it springs back, wobbling
    for (const f of this.flames) {
      if (f.x < cam.x - 60 || f.x > cam.x + W + 60) continue; let force = 0;
      for (const gu of fx.gusts) { const d = Math.hypot(f.x - gu.x, f.y - gu.y), R = gu.r * 1.3; if (d < R) { const q = 1 - d / R; force += gu.vx * q * q * gu.k; } }
      f.vdx = ((f.vdx || 0) + force * 0.4) * 0.82 - (f.dx || 0) * 0.12; f.dx = Math.max(-9, Math.min(9, (f.dx || 0) + f.vdx));
    }
    for (const f of this.flames) { if (f.x < cam.x - 60 || f.x > cam.x + W + 60) continue; if (f.lightOnly) { fx.light(f.x, f.y, f.light, 0.75); continue; } if (f.behind) { if (f.smoke) { const fs = f.fs || 1, ph = f.ph || 0; if (f.small) { if ((p.t + ph) % 9 === 0) fx.smoke(f.x + rand(-1, 1), f.y - 7 * fs, 1, { s0: 3 + 4 * fs, s1: 14 + 16 * fs, c0: [0.5, 0.3, 0.2], c1: [0.12, 0.1, 0.11], a: 0.85, l: 1.9, drift: 0.1 }); } else if ((p.t + ph) % 6 === 0) fx.smoke(f.x, f.y - 12 * fs, 1, { s0: 6 + 3 * fs, s1: 22 + 10 * fs, c0: [0.45, 0.27, 0.17], c1: [0.1, 0.085, 0.09], a: 0.9, drift: 0.08 }); } if (f.big && Math.random() < (f.small ? 0.03 : 0.1)) fx.emit({ x: f.x + rand(-4, 4), y: f.y - 8, vx: rand(-0.3, 0.3), vy: -rand(0.5, 1.2), life: rand(30, 60), s0: 2, s1: 0.5, c0: [1, 0.7, 0.3], c1: [1, 0.4, 0.1], a0: 1, a1: 0, kind: 1 }); } else if (f.big) { fx.fire(f.x, f.y + 6, { scale: f.fs || 1.0, n: 2 }); if (f.smoke && p.t % 7 === 0) fx.smoke(f.x, f.y - 8, 1, { s0: 8, s1: 30, c0: [0.28, 0.22, 0.22], c1: [0.1, 0.08, 0.08], a: 0.5 }); } else fx.flame(f.x + (f.dx || 0) * 0.5, f.y, { scale: f.scale, seed: f.seed }); if (f.light) fx.light(f.x, f.y, f.light, 0.75); }
    for (let i = 0; i < (this.falls ? this.falls.length : 0); i++) {                                       // the spray where a waterfall lands (only the ones near the camera)
      const f = this.falls[i]; if (f.x < cam.x - 60 || f.x > cam.x + W + 60 || f.y < cam.y - 20 || f.y > cam.y + H + 40) continue;
      if ((this.frame + i * 5) % 3 === 0) fx.emit({ layer: 'alpha', x: f.x + rand(-f.w / 2, f.w / 2), y: f.y - 3, vx: rand(-0.35, 0.35), vy: -rand(0.15, 0.6), life: rand(36, 70), s0: 10, s1: 30, c0: [0.82, 0.93, 0.97], c1: [0.7, 0.85, 0.92], a0: 0.34, a1: 0, kind: 5, drag: 0.99 });
      if ((this.frame + i * 3) % 4 === 0) fx.emit({ x: f.x + rand(-f.w / 2, f.w / 2), y: f.y - 4, vx: rand(-0.9, 0.9), vy: -rand(0.8, 2.0), gy: 0.1, life: rand(16, 28), s0: 2, s1: 1, c0: [0.85, 0.96, 1], a0: 0.85, a1: 0, kind: 1 });
    }
    if (this.room.dark) fx.light(p.x, p.y - 20, 16, 0.25); else fx.light(p.x, p.y - 20, 54, 0.5);          // (in a dark room he carries almost no light of his own)
    fx.focus = { x: p.x, y: p.y - 20 };
    this.ghost.update(); for (const d of this.graves || []) fx.light(d.x + 12, d.y - 12, 100, 1.2, [0.4, 0.62, 1]);          // (her grave's candle: the blue light in which she can be seen)
    this.checkExits();
    // camera
    this.updateCamera();
    if (this.bannerObj && ++this.bannerObj.t > this.bannerObj.dur) this.bannerObj = null;
    if (this.sigilCard) this.sigilCard.t++;
    if (this.shakeT > 0) { this.shakeT--; if (this.shakeT === 0) this.shakeA = 0; }
    fx.update(1);
  }
  // THE BELL TOWER ON FIRE: she appears and warns him, then flames begin to climb the tower from the bottom.  Touching them hurts badly (and throws him up out of them); falling below their edge is death.  They stop
  // climbing just under the top landing, so the way out is safe.  (Entering the tower from the top - the way back - starts nothing.)
  beginChase(def) {
    const c = { y: def.h * 16 + 6, cap: (def.chaseTop || 8) * 16 + 46, on: false, t: 0 }, S = this.save;
    const start = () => { if (this.chase !== c) return; c.on = true; A.sfx('fire'); this.shake(2, 20); };
    const go = () => {
      if (this.chase !== c) return; if (this.state !== 'play' || this.cutscene) { this.after(20, go); return; }
      const gh = this.ghost; gh.snapped = false; gh.scene = 240; gh.reveal(240); A.sfx('ghost'); this.fx.ring(this.player.x - this.player.dir * 22, this.player.y - 22, 50, [0.55, 0.78, 1], 30, 0.1);
      if (!S.flags.bell_warned) { S.flags.bell_warned = true; this.after(30, () => { if (this.chase === c) this.talk([voiced(STORY.chase)], start); }); }
      else { this.popup(this.player.x, this.player.y - 58, 'THE FLAMES ARE RIGHT BEHIND YOU!', '#bcd8ff'); this.after(70, start); }
    };
    this.after(40, go); return c;
  }
  // THE LAST DARK: the further across the pit the hero is, the quieter the music (silent a third of the way over) and the darker the room (black by the middle: only the wisp shows anything).  It follows the hero both ways.
  stepPitFade() {
    const f = this.room.pitFade, p = this.player, fx = this.fx, S = this.save, sm = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
    f.m += (sm((p.x - f.x0) / (f.xm - f.x0)) - f.m) * 0.05; f.d += (sm((p.x - f.x0) / (f.xd - f.x0)) - f.d) * 0.05; A.hush = 1 - f.m;
    const lamp = !!S.flags.got_lantern, lvl = lamp ? 1.1 : 0.8; fx.ambBase = f.base + (lvl - f.base) * f.d; fx.darkU.uAmbient.value = fx.ambBase; fx.darkU.uMax.value = 0.86 + (lamp ? 0.115 : 0.04) * f.d;
  }
  stepChase() {
    const c = this.chase, p = this.player, fx = this.fx, r = this.room; if (!c || !c.on || !r) return; c.t++;
    if (c.t > CHASE_DELAY && c.y > c.cap) c.y -= 0.38;          // (a moment to get moving - 140 steps, and 3 seconds more (180) since the user asked for it - then slowly up; the fire burns at the foot of the tower all that time)
    const cam = this.camera;
    if (this.frame % 3 === 0 && c.y < cam.y + H + 30) for (let x = Math.max(6, Math.floor((cam.x - 20) / 34) * 34); x < Math.min(r.pw, cam.x + W + 20); x += 34) fx.fire(x + rand(-8, 8), c.y + rand(4, 16), { scale: 0.7 + rand(0, 0.6), n: 1 });          // (a few real flames and glows over the hero, from the effects layer)
    if (this.frame % 2 === 0 && c.y < cam.y + H + 30) { const ex = cam.x + rand(0, W); fx.emit({ x: ex, y: c.y - rand(0, 24), vx: rand(-0.35, 0.35), vy: -rand(0.9, 2.2), drag: 0.992, life: rand(34, 80), s0: 2.4, s1: 0.5, c0: [1, 0.78, 0.3], c1: [1, 0.3, 0.06], a0: 1, a1: 0, kind: 1 }); }          // sparks climb out of it
    if (this.frame % 7 === 0 && c.y < cam.y + H + 30) fx.smoke(cam.x + rand(0, W), c.y - rand(18, 40), 1, { s0: 10, s1: 30, c0: [0.3, 0.24, 0.22], c1: [0.12, 0.1, 0.1], a: 0.4, l: 1.5 });          // and smoke rolls up
    fx.light(Math.max(0, Math.min(r.pw, p.x)), c.y - 24, 190, 0.9, [1, 0.5, 0.2]);
    if (this.frame % 45 === 0 && c.y < cam.y + H + 40) A.sfx('fire');
    if (p.dead || this.cutscene) return;
    if (p.y > c.y + 30) { this.save.hp = 0; this.fx.flash([1, 0.5, 0.2], 0.5); p.die(); return; }          // (below the flames: that is the end)
    if (p.y > c.y + 4 && p.invT <= 0 && p.hurt(24, p.x + (Math.random() < 0.5 ? -1 : 1), { kb: 0, el: 'soot' })) { p.vy = -6.6; p.onGround = false; this.fx.burst(p.x, p.y - 8, 14, COLORS.fire, { speed: 2.6, s0: 14 }); }          // (touching them: badly burnt, and thrown up out of the fire)
  }
  drawChase(ctx, cx, cy, t) {
    const c = this.chase; if (!c || !c.on) return; const y = c.y - cy; if (y > H + 8) return;
    drawFireWall(ctx, cx, y, t, W);          // (rank on rank of the same blazes that burn the houses of Prague, on a bed of coals: see decor.js)
  }
  // SMOKE HAZE: while Prague burns, a pall of smoke hangs in the air at the top of the screen (a dark band that thins out downwards, with slow banks of smoke drifting through it)
  drawHaze(ctx, cx, t) {
    const r = this.room; if (!r || r.zone !== 6 || r.indoor || r.house || !r.flags || !r.flags.village_fire || r.fireOut) return;
    ctx.save(); const base = ctx.createLinearGradient(0, 0, 0, H * 0.62); base.addColorStop(0, 'rgba(62,48,46,0.8)'); base.addColorStop(0.45, 'rgba(84,66,62,0.4)'); base.addColorStop(1, 'rgba(96,76,70,0)'); ctx.fillStyle = base; ctx.fillRect(0, 0, W, H * 0.62);
    for (let i = 0; i < 7; i++) {
      const sp = 0.12 + (i % 3) * 0.05, wx = ((i * 131 + t * sp - cx * (0.18 + (i % 2) * 0.08)) % (W + 240) + (W + 240)) % (W + 240) - 120, y = 6 + (i % 4) * 11 + Math.sin(t * 0.012 + i * 1.7) * 6, rad = 95 + (i % 3) * 28;
      const gr = ctx.createRadialGradient(wx, y, 4, wx, y, rad); gr.addColorStop(0, 'rgba(120,98,90,0.42)'); gr.addColorStop(1, 'rgba(120,98,90,0)'); ctx.fillStyle = gr; ctx.fillRect(wx - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }
  drawGathering(ctx) {          // the castle is still being made: a dim card and a bar
    ctx.fillStyle = 'rgba(2,1,6,0.72)'; ctx.fillRect(0, 0, W, H); drawText(ctx, 'GATHERING THE DEAD...', W / 2, H / 2 - 12, { align: 'center', color: '#e8b84a', scale: 1.4 });
    ctx.fillStyle = '#1a1020'; ctx.fillRect(W / 2 - 60, H / 2 + 6, 120, 5); ctx.fillStyle = '#e6a23a'; ctx.fillRect(W / 2 - 60, H / 2 + 6, Math.round(120 * Math.min(1, this.worldFrac || 0)), 5);
  }
  snapCamera() { const p = this.player, r = this.room; this.camera.x = this.camTargetX(p, r); this.camera.y = this.camTargetY(p, r); }
  camTargetX(p, r) { return r.pw <= W ? (r.pw - W) / 2 : clamp(p.x + p.dir * 18 - W / 2, 0, r.pw - W); }
  camTargetY(p, r) { return r.ph <= H ? (r.ph - H) / 2 : clamp(p.y - 30 - H / 2, 0, r.ph - H); }          // (the hero stands about two thirds of the way down the picture, as everywhere: on the bridge too, where the river still shows below him)
  updateCamera() {
    const p = this.player, r = this.room, c = this.camera, gz = this.gaze;
    this.fx.rainCount = 0.52; this.fx.rainK = r && r.id === 'v0' && p ? Math.max(0, Math.min(1, 1 - (p.x - r.pw * 0.38) / (r.pw * 0.5 - 24))) : 1;          // (the rain on the hill thins out as he walks towards the way down to Prague, and is gone by the time he reaches it)
    if (gz && gz.t < gz.pan + 62) { const tx = r.pw <= W ? (r.pw - W) / 2 : clamp(gz.x - W / 2, 0, r.pw - W), ty = r.ph <= H ? (r.ph - H) / 2 : clamp(gz.y - H / 2, 0, r.ph - H); c.x += (tx - c.x) * 0.12; c.y += (ty - c.y) * 0.12; return; }          // (a lever thrown: the camera looks at the gate it opens)
    c.x += (this.camTargetX(p, r) - c.x) * 0.1; c.y += (this.camTargetY(p, r) - c.y) * 0.12;
  }

  // -------------------------------------------------------------------------------- drawing
  draw() {
    const ctx = this.ctx, t = this.frame; ctx.setTransform(this.K, 0, 0, this.K, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const top = this.top; if (this.topCanvas.width !== W * this.K) { this.topCanvas.width = W * this.K; this.topCanvas.height = H * this.K; } top.setTransform(this.K, 0, 0, this.K, 0, 0); top.imageSmoothingEnabled = false; top.globalAlpha = 1; top.clearRect(0, 0, W, H);
    const fx = this.fx;
    if (this.state === 'title') { this.title.draw(ctx); if (this.loadingWorld) this.drawGathering(ctx); fx.setCamera(0, 0); this.finishFrame(); return; }
    if (this.state === 'intro') { ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); this.intro.draw(ctx); fx.setCamera(0, 0); this.finishFrame(); return; }
    if (this.state === 'ending') { this.ending.draw(ctx); this.finishFrame(); return; }
    if (!this.room) { this.finishFrame(); return; }
    const r = this.room, p = this.player;
    let sx = 0, sy = 0; if (this.shakeT > 0) { const a = this.shakeA * Math.min(1, this.shakeT / 6); sx = (Math.random() * 2 - 1) * a; sy = (Math.random() * 2 - 1) * a; }
    const cx = Math.round(this.camera.x + sx), cy = Math.round(this.camera.y + sy);
    { const n = this.state === 'play' ? this.nearInteractable() : null; r.nearDoor = n && n.kind === 'door' ? n.d : null; r.playerX = p.x; }          // (room.nearDoor / room.playerX: scenery can react to the player)
    drawBackground(ctx, r, cx, cy, t);
    for (const d of r.decos) if (isBack(d) && d.t !== 'waterfall') drawDeco(ctx, d, cx, cy, t, r);
    for (const ic of this.icicles || []) ic.draw(ctx, cx, cy, t);
    for (const j of this.jets || []) j.draw(ctx, cx, cy);
    if (r.movers) r.movers.draw(ctx, cx, cy);                                                    // the moving brass platforms and their tracks (they carry the hero)
    if (this.falls) for (const d of this.falls) drawDeco(ctx, d, cx, cy, t, r);                    // waterfalls: in front of the far trees, behind the ground and the hero
    if (this.mirrorView) this.mirrorView.draw(ctx, cx, cy);                                          // the mirror hangs on the back wall: frame and glass, behind the ground and the hero (the reflection is the boss's, drawn over the glass)
    r.drawTiles(ctx, cx, cy, t); if (this.gateAnims && this.gateAnims.length) this.drawGates(ctx, cx, cy);
    for (const d of r.decos) if (!isBack(d) && !d.fore) drawDeco(ctx, d, cx, cy, t, r);
    this.drawChase(ctx, cx, cy, t); this.drawHaze(ctx, cx, t);
    drawFlames2D(ctx, this.flames, cx, cy, t);                       // braziers, burning windows, candelabra flames: in the scene, behind the hero
    for (const o of this.props) o.draw(ctx, cx, cy);
    for (const o of this.pickups) o.draw(ctx, cx, cy);
    for (const e of this.enemies) if (!e.isBoss) e.draw(ctx, cx, cy);
    for (const e of this.enemies) if (e.isBoss) { e.drawWarn(ctx, cx, cy); e.draw(ctx, cx, cy); }     // danger zones go under the boss
    for (const e of this.enemies) if (e.freezeT > 0) drawIce(ctx, e, cx, cy, t);                       // Frost enchant: frozen foes sit in ice
    this.ghost.draw(ctx, cx, cy);                                                                    // (she floats a little behind the hero - and is only seen in a blue light)
    if (this.cutscene && this.cutscene.scene) this.cutscene.scene.drawWorld(ctx, cx, cy);
    p.draw(ctx, cx, cy);
    drawForeground(ctx, r, cx, cy, t);                                                              // (out-of-focus shapes close to the lens, over everything but the picture's edges are kept clear)
    for (const d of r.decos) if (d.fore) drawDeco(ctx, d, cx, cy, t, r);                              // the foreground: things the hero walks BEHIND (fences)
    for (const e of this.enemies) if (e.isBoss) e.drawIntent(ctx, cx, cy);                              // attack icon + name over its head
    for (const o of this.projectiles) o.draw(ctx, cx, cy);
    if (this.state === 'play' && !this.cutscene && this.fade < 0.05 && !this.clean) {          // (this.clean: the trailer recorder hides the interface)
      const n = this.nearInteractable();
      if (n) {
        drawPrompt(top, n.x - cx, n.y - cy, t, n.kind === 'npc' ? 'TALK' : n.kind === 'door' ? 'UP' : (n.o.constructor.name === 'Altar' ? 'SAVE' : n.o.constructor.name === 'Waystone' ? 'TRAVEL' : n.o.constructor.name === 'Lever' ? 'PULL' : n.o.constructor.name === 'Bell' ? 'RING' : n.o.constructor.name === 'LitCandle' ? 'LIGHT' : 'UP'));
        if (n.kind === 'door') {
          this.areaLabel(top, this.areaName(n.d.room), n.x - cx, n.y - cy + 14);          // (outside a door: where it leads)
          const K = n.d.key && !this.save.flags['unlocked_' + n.d.key] ? KEYS.find(k => k.id === n.d.key) : null;          // (and, if it is locked, the key it needs - in the key's own colour, brighter once you carry it)
          if (K) this.areaLabel(top, K.name, n.x - cx, n.y - cy + 25, 'center', 'rgb(' + K.rgb.join(',') + ')', this.save.flags['has_' + n.d.key] ? 1 : 0.7);
        }
      }
    }
    if (this.state === 'play' && !this.cutscene && this.fade < 0.05) for (const e of r.exits) {          // (and at the edge of the room, where the way on leads)                                // an arrow where the room opens onto the next one, on the edge of the screen
      if (e.side !== 'L' && e.side !== 'R') continue;
      const L = e.side === 'L', wx = L ? 10 : r.pw - 10, sx = wx - cx, sy = (e.from + e.to + 1) / 2 * T - cy; if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      let sealed = false; for (let k = 0; k < 8 && !sealed; k++) for (let row = e.from; row <= e.to; row++) if (r.get(L ? k : r.w - 1 - k, row) === TILE.SEAL) { sealed = true; break; }
      if (!sealed && !(this.world.rooms[e.room] && this.world.rooms[e.room].hidden)) { drawExitArrow(top, sx, sy, t, L ? -1 : 1); if (Math.abs(p.x - wx) < 80) this.areaLabel(top, this.areaName(e.room), clamp(sx + (L ? 12 : -12), 0, W), sy - 4, L ? 'left' : 'right'); }
    }
    fx.setCamera(cx, cy);
    if (r.spikes && r.spikes.length) { top.globalAlpha = 0.95; for (const [tx, ty] of r.spikes) { const sx = tx * T - cx, sy = ty * T - cy; if (sx < -16 || sx > W || sy < -16 || sy > H) continue; drawSheet(top, 'spikes', 0, sx, sy, { ax: 0, ay: 0 }); } top.globalAlpha = 1; }          // hazards are drawn again above the fog and the dark: they must always be seen
    // everything the player READS - messages, the HUD, banners, dialogue, the pause and game-over screens - is drawn on the clear layer above the effects (fog, darkness), never under them
    drawPopups(top, this.popups, cx, cy);
    if (this.cutscene && this.cutscene.scene) this.cutscene.scene.drawTop(top); else if (!this.clean) HUD.draw(top, this);
    if (!(this.cutscene && this.cutscene.scene)) drawBanner(top, this.bannerObj);
    if (this.sigilCard) {          // the sigil that has just been lit: in the middle of the screen, with the news under it
      const c = this.sigilCard, a = c.t < 25 ? c.t / 25 : c.t > c.dur - 30 ? Math.max(0, (c.dur - c.t) / 30) : 1, msg = dtext('sigil unlocked') || 'A SIGIL HAS BEEN UNLOCKED UPON A SEALED DOOR.';
      top.save(); top.globalAlpha = a * 0.45; top.fillStyle = '#000'; top.fillRect(0, 0, W, H); top.restore();
      drawSigilCard(top, c.name, W / 2, H / 2 - 4, c.t, a); top.save(); top.globalAlpha = a; drawText(top, msg, W / 2, H / 2 + 44, { align: 'center', color: '#e9d8a6', outline: '#000', scale: 1.1, font: 'body' }); top.restore();
    }
    if (this.blackout && (this.blackout.a > 0.004 || this.blackout.wisp)) {               // (the Shadow Lord's second life: the screen goes black; the Lady's wisp opens a pool of light round the hero)
      const b = this.blackout, p = this.player, hx = p.x - cx, hy = p.y - 22 - cy; top.save(); top.fillStyle = `rgba(0,0,0,${b.a.toFixed(3)})`; top.fillRect(0, 0, W, H);
      if (b.r > 2) { top.globalCompositeOperation = 'destination-out'; const gr = top.createRadialGradient(hx, hy, 2, hx, hy, b.r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); top.fillStyle = gr; top.fillRect(0, 0, W, H); top.globalCompositeOperation = 'source-over';
        top.fillStyle = 'rgba(150,200,255,0.5)'; top.beginPath(); top.arc(hx + Math.sin(this.frame * 0.1) * 6, hy - 18 + Math.cos(this.frame * 0.13) * 4, 2.2, 0, Math.PI * 2); top.fill(); }
      top.restore();
      if (b.wisp) { const i = this.fx.lights.indexOf(this._wl); if (i >= 0) this.fx.lights.splice(i, 1); this._wl = [p.x, p.y - 22, Math.max(8, b.r * 1.4), 1, [0.55, 0.78, 1]]; this.fx.lights.push(this._wl); }
    }
    if (this.state === 'dialog') this.dialog.draw(top);
    if (this.state === 'letter') this.reader.draw(top);
    if (this.state === 'dead') this.gameOver.draw(top);
    if (this.state === 'pause') this.pauseMenu.draw(top);
    if (this.state === 'shop') this.shop.draw(top);
    if (this.state === 'map') this.mapScreen.draw(ctx);                // (the map is a full sheet of its own: it hides the effects layer and this one)
    this.finishFrame();
  }
  finishFrame() {
    const cl = this.fx.cloak, pl = this.player; if (cl) cl.setVisible(A.settings.cloak && !!pl && !!this.room && (this.state === 'play' || this.state === 'dialog' || this.state === 'file' || this.state === 'dead' || this.state === 'gameover'));
    for (const c of [this.ctx, this.top]) if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${this.fade})`; c.fillRect(0, 0, W, H); }          // the fade to black covers the interface too
    if (this.state === 'title' || this.state === 'intro' || this.state === 'ending') this.fx.setShake(0, 0);
    this.fx.canvas.style.opacity = this.topCanvas.style.opacity = this.state === 'map' ? '0' : '1';       // the map is a full-screen sheet: hide the effects layer (it sits above the 2D canvas)
    this.fx.render();
  }
}

export async function start() {
  const g = new Game(); window.game = g; await g.init(); g.run();
  // debug helpers (handy for testing from the console)
  g.debug = {
    seed: n => { g.world = buildWorld(n); g.save = newSave(g.world); g.save.flags.opening_seen = true; g.player = new Player(g, 0, 0); g.state = 'play'; g.fade = 0; g.loadRoom(g.world.start.room, { x: g.world.start.x * 16 + 8, y: g.world.start.gy * 16 }, 1); return g.world.report; },
    tp: (room, tx, gy) => { if (!g.save) { g.world = g.world || buildWorld(1); g.save = newSave(g.world); g.save.flags.opening_seen = true; g.player = new Player(g, 0, 0); } g.state = 'play'; g.fade = 0; g.loadRoom(room, { x: tx * 16 + 8, y: gy * 16 }, 1); },
    give: k => { g.save.abilities[k] = true; }, giveAll: () => { for (const k of Object.keys(g.save.abilities)) g.save.abilities[k] = true; },
    defeat: () => { const p = g.player; g.bossDefeated({ reward: 'thunder', bossName: '', x: p.x, y: p.y, cy: p.y - 20 }); },          // (as if the room's boss had just died)
    state: () => ({ card: g.sigilCard && g.sigilCard.t, frozen: g.playerFrozen, flag: g.save && g.save.flags['boss_' + g.room.id], pickups: g.pickups.length }),
    raw: () => g,          // (the whole game, for poking at in tests)
    foe: () => g.enemies.find(e => e.isBoss && !e.dead),          // (the room's boss, to poke at)
    spawn: (type, tx, gy) => { const e = g.spawnEnemy(type, tx, gy, { reward: 'hpup' }); return !!e; },          // (a foe, wherever you stand)
    god: () => { g.player.invT = 1e9; }, heal: () => { g.save.hp = g.save.maxHp; g.save.mp = g.save.maxMp; },
    // run n logic steps synchronously (the preview pane throttles requestAnimationFrame), then draw once
    stepN: (n = 1) => { for (let i = 0; i < n; i++) g.step(); g.draw(); },
    // hold keys (codes) down for n steps, then release: await-free helper for scripted tests
    press: (codes, n = 1, after = 0) => { const k = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })); codes.forEach(c => k(c, true)); for (let i = 0; i < n; i++) g.step(); codes.forEach(c => k(c, false)); for (let i = 0; i < after; i++) g.step(); g.draw(); },
  };
  g.noAutoPause = new URLSearchParams(location.search).has('nopause');
}
