// Procedural castle.  The world seed decides every room's layout; each room is then PROVEN beatable by validate.js
// (real jump physics) before it is accepted.  If a room can't be made valid it falls back to its hand-built layout, so an
// impossible level can never reach the player.
//
//   - corridors are built from segments that respect the jump budget (steps <= 2 rows, gaps <= 3 tiles, platform bridges for
//     anything wider) with "modules" dropped in: save door, double-jump ledge, secret cell, the dash gulf, lore tablets
//   - towers zig-zag upward in 2-3 row hops;  boss arenas get randomised platforms;  sanctuaries are fixed
//   - the macro structure (zones, bosses, ability order, exits, save rooms) never changes, only the rooms' insides
import { B, ZONES, ROOMS as AUTHORED, HOUSES, DOORS, arrangeCandelabras, tidyRoom } from './rooms.js';
import { ITEMS, ITEM_ORDER } from './itemdata.js';
const offerOf = (item, o = {}) => ({ item, qty: o.qty || ITEMS[item].pack, price: o.price || ITEMS[item].price, stock: o.stock || 3 });          // what a merchant sells: one pack, for its price, three times at most
import { TILE } from './world.js';
import { moverAt } from './movers.js';
import { validateRoom, checkSpawns, roomOf, surfaces, reach, simulateChain } from './validate.js';
import { mulberry32 } from './util.js';
import { packMap, mapCells } from './maplayout.js';

export const GEN_VERSION = 17;          // (17: the Cistern is entered from under Karluv Bridge, and the Frozen Caverns lie beyond it)
const MAX_TRY = 60;

// ------------------------------------------------------------------------------------------------ seeded random helpers
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function makeRng(seed, id, attempt) {
  const f = mulberry32((Math.imul(seed | 0, 0x9e3779b1) ^ hashStr(id) ^ Math.imul(attempt + 1, 0x85ebca6b)) >>> 0);
  const r = { f, i: (a, b) => a + Math.floor(f() * (b - a + 1)), pick: a => a[Math.floor(f() * a.length)], chance: p => f() < p };
  r.shuffle = a => { const o = [...a]; for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(f() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; } return o; };
  r.wpick = table => { let t = 0; for (const [, w] of table) t += w; let x = f() * t; for (const [k, w] of table) if ((x -= w) < 0) return k; return table[0][0]; };
  return r;
}

// ------------------------------------------------------------------------------------------------ the castle's blueprint
// (ids, zones, secrets and the order of everything are fixed; sizes and layouts are randomised)
//
// The castle has seven zones, each with ONE look (so a level never mixes tilesets):
//   6 Prague  ->  1 Graveyard  ->  (the Waystone Glade, the Mire Road, the Gate of Arx Noctis, the Quiet Corner) [7 Weeping Swamp | 2 Great Hall | 3 Moonlit Chapel]  ->  (the Crossing Waystone, the Barricaded Gallery, the Archive Passage, the Throne Approach) [4 Crypts | 8 Clockwork Dungeon | 5 Shadow Throne]   (see CHAINS / PAIRS below)
//   and, under Prague's Karluv Bridge (a door in the river-side pier, reached by a fall and a dash): 9 Cistern -> (an ice wall that only fire melts) -> 11 Frozen Caverns
// Every zone opens with a WAYSTONE chamber (the teleport room), has a boss at its far end, and a sanctuary (save room) off one of its corridors.
const T1 = 'ARX NOCTIS SWALLOWED THE SUN LONG AGO. ONLY A STRANGER FOOLISH ENOUGH TO ENTER WILL SEE IT RISE AGAIN.';
// how each zone's weather / light looks (shared by all its rooms, including the waystone chamber)
const LOOK = {
  6: { weather: 'embers', ambient: 0.34, horizon: 12, tint: [0.16, 0.05, 0.0], vig: 0.55 },
  1: { weather: 'rain', storm: true, ambient: 0.12, horizon: 12 },
  7: { weather: 'wisps', wisps: 4, ambient: 0.16, horizon: 12, tint: [0.0, 0.03, 0.02] },          // (weather 'wisps' = drifting motes; wisps: 4 = four will-o'-the-wisps, see fx.js)
  2: { weather: 'dust', ambient: 0.35, horizon: 12 },
  3: { weather: 'wisps', ambient: 0.3, horizon: 12 },
  4: { weather: 'wisps', wisps: 3, ambient: 0.34, horizon: 12, tint: [0.0, 0.04, 0.06], vig: 0.6 },          // the Crypts: cold, ghost-lit
  5: { weather: 'mist', ambient: 0.58, horizon: 12, vig: 0.7, tint: [0.03, 0.0, 0.04] },
  9: { weather: 'mist', ambient: 0.3, horizon: 12, tint: [0.0, 0.04, 0.07], vig: 0.6 },          // the Cistern: cold, wet, teal
  8: { weather: 'steamworks', ambient: 0.36, horizon: 12, tint: [0.07, 0.04, 0.0], vig: 0.6 },          // the Clockwork Dungeon: brass-lit, with sparks
  10: { weather: 'pages', ambient: 0.3, horizon: 12, tint: [0.07, 0.035, 0.0], vig: 0.6 },          // the Library of Ages: lamplit, motes of paper dust
  11: { weather: 'snow', wisps: 6, ambient: 0.4, horizon: 12, tint: [0.0, 0.04, 0.09], vig: 0.55 },          // the Frozen Caverns: cold blue, snow drifting down
};
const SPEC = {
  // ======== ZONE 6 - PRAGUE (Gothicvania Town): calm at dusk until the Cinder Warden's torches (VillageScene), then it burns
  v0: { kind: 'authored', zone: 6, name: 'The Hill Above Prague' },
  vq: { kind: 'authored', zone: 6, name: 'Under the Yew', parent: 'v0', hidden: true },          // (a secret: a hollow to the left of the hill with the last page in it - no arrow, no label, not on the map)
  v1: { kind: 'authored', zone: 6, name: 'Market Street' },
  tv: { kind: 'teleport', zone: 6, name: 'Waystone Square', outdoor: true, opts: LOOK[6] },
  // The ORLOJ TOWER: a locked door high on a ledge in Smouldering Lane (it needs the Key of Tin and the double jump) leads in.  The great astronomical clock hangs in the middle of the shaft; the door to the Clockwork Dungeon is on the landing beside it.
  ot: { kind: 'tower', zone: 8, name: 'The Orloj Tower', areaLabel: 'The Orloj Tower', parent: 'v2', orloj: true, w: [30, 34], h: [40, 46], top: [11, 13], opts: { ...LOOK[8], ambient: 0.36 }, abilities: ['djump'], topItem: { kind: 'astrolabe', id: 'got_astrolabe' },
    mods: [{ t: 'tablet', id: 'tab18', text: 'THE CLOCK STILL KEEPS PRAGUE\'S HOUR. THE APOSTLES STILL WALK IN THEIR WINDOWS, AND THE SUN IS STILL ON ITS DIAL. IT IS THE ONLY SUN LEFT.' }], candles: [3, 3], barrels: [1, 1], mix: { skeleton: [1, 2], ghost: [1, 1], fireskull: [2, 2], bat: [2, 2], sorcerer: [1, 1] } },
  // THE BOILER LOFT: a loft of brass and steam above the Orloj's clock, where the Boiler Golem keeps the fires.  Its door is the one on the tower's top landing; the door on its far side (to the Clockwork Dungeon) is sealed by a sigil until the golem is dead.
  og: { kind: 'arena', zone: 8, name: 'The Boiler Loft', areaLabel: 'The Orloj Tower', parent: 'ot', loft: true, w: [44, 50], h: 14, boss: 'golem', reward: 'athanor', plats: 2, rise: 3, abilities: ['djump'], decor: 'brazier', candles: [2, 2], jets: 2, jetGap: 12,
    opts: { ...LOOK[8], ambient: 0.32, boss: 'golem', music: 'boss' } },
  v2: { kind: 'corridor', zone: 6, name: 'Smouldering Lane', tall: 26, w: [90, 104], outdoor: true, opts: LOOK[6],
    mods: [{ t: 'door', to: 'sv', kind: 'wood' }, { t: 'door', to: 'hv4', kind: 'house', tag: 'cooper' }, { t: 'djLedge', kind: 'atkup', id: 'v2_atk' }, { t: 'djLedge', kind: 'hpup', id: 'v2_hp' }, { t: 'tablet', id: 'tab9', near: 'start', text: 'THE BELLS WERE THE FIRST TO FALL SILENT. THE PRIEST BARRED THE CHAPEL DOOR AND PRAYED. IT DID NOT HELP.' }],
    candles: [3, 5], barrels: [1, 2], mix: { zombie: [2, 3], skeleton: [1, 2], hound: [1, 1], bat: [1, 2], fireskull: [1, 1], villager: [1, 2] } },
  v3: { kind: 'tower', zone: 6, name: 'The Bell Tower', bell: true, chase: true, w: [28, 32], h: [34, 38], top: [8, 10], opts: { ...LOOK[6], ambient: 0.4 },
    mods: [{ t: 'tablet', id: 'tab10', text: 'HE CALLS IT MERCY, TO BURN WHAT HE CANNOT PROTECT. THE WARDEN WAITS IN THE SQUARE BELOW THE HILL ROAD.' }], topItem: { kind: 'mpup', id: 'v3_mp' }, candles: [3, 4], mix: { bat: [2, 3], fireskull: [2, 3], zombie: [1, 2] } },
  vb: { kind: 'arena', zone: 6, name: 'The Burning Square', w: [40, 46], outdoor: true, boss: 'cinder', reward: 'mantle', plats: 2, rise: 3, seal: 'both', candles: [3, 3], decor: 'village',
    opts: { ...LOOK[6], boss: 'cinder', music: 'boss' } },
  // THE STONE BRIDGE TOWER: the Gothic gate at the foot of the bridge (the game's year is 1541: the names "Old Town Bridge Tower" and "Charles Bridge" are younger), calm, with an altar in its gateway - the first place to save after the Cinder Warden - and a scaffold up its front to a gallery with a secret
  vs: { kind: 'gatetower', zone: 6, name: 'The Stone Bridge Tower', outdoor: true, opts: LOOK[6] },
  // KARLUV BRIDGE: the old stone bridge over the Vltava, between the burning city and the road to the Graveyard.  The castle's one open-air platforming run: broken spans, rubble and
  // stepping stones over the river (a fall is the river: spikes under the water), saints on the parapet, and a cracked wall hiding a prize.  Entered by a hero with only a single jump.
  br: { kind: 'corridor', zone: 6, name: 'Karluv Bridge', areaLabel: 'Karluv Bridge', bridge: true, under: 18, w: [96, 112], outdoor: true, opts: { ...LOOK[6], weather: 'mist', fog: 0.4, ambient: 0.4 },          // (no drifting embers on the bridge: a river mist)
   
    mods: [{ t: 'cell', gate: 'crack', kind: 'hpup', id: 'br_hp' }, { t: 'tablet', id: 'tab19', near: 'start', text: 'THIRTY SAINTS STAND WATCH ON THIS BRIDGE, AND NOT ONE COULD STOP THE FIRE. THE VLTAVA TAKES WHAT FALLS. THE TOLL-KEEPERS KEPT A CELLAR UNDER THE STONES, WHERE THE OLD WATERWORKS BEGIN, AND I HAVE ALWAYS WONDERED ABOUT THE PLANKS IN THE DECK.' }],
    candles: [3, 4], mix: { zombie: [1, 2], skeleton: [2, 3], hound: [1, 1], bat: [2, 3], fireskull: [2, 2] } },
  sv: { kind: 'sanctuary', zone: 6, name: 'Chapel Cellar', parent: 'v2' },
  // the houses of the village can be entered (UP at the door): calm people inside, who give you something for listening
  hv1: { kind: 'interior', zone: 6, name: "Weaver's Cottage", parent: 'v1', look: 'cottage', npcs: [2, 2] },
  hv2: { kind: 'interior', zone: 6, name: "Smith's House", parent: 'v1', look: 'cottage', npcs: [1, 2], sellers: 1 },
  hv3: { kind: 'interior', zone: 6, name: "Baker's House", parent: 'v1', look: 'cottage', npcs: [2, 3] },
  // the Cooper's house stands EMPTY, and keeps a secret: a stretch of its floor is a hatch that a lever on the floor draws back, over the Cooper's cellar (hc), where a fifth Keeper has set up shop (shk)
  hv4: { kind: 'interior', zone: 6, name: "Cooper's House", parent: 'v2', look: 'cottage', empty: true, trapdoor: { room: 'hc', tx: 14, gy: 3, lever: 'hv4_lever' } },
  hc: { kind: 'cellar', zone: 6, name: "The Cooper's Cellar", parent: 'hv4', exitTo: 'v2', exitTag: 'cooper', shop: 'shk' },
  shk: { kind: 'shop', zone: 6, name: 'The First Bargain', parent: 'hc', tier: 0 },

  // ======== ZONE 1 - THE GRAVEYARD APPROACH (Gothicvania Cemetery)
  tg: { kind: 'teleport', zone: 1, name: 'Waystone Crossroads', outdoor: true, opts: LOOK[1] },
  g1: { kind: 'corridor', zone: 1, name: 'Iron Gate', w: [80, 92], outdoor: true, deck: true, opts: { ...LOOK[1], ambient: 0.1 },
    mods: [{ t: 'skull', id: 'skull1' }, { t: 'tablet', id: 'tab1', near: 'start', text: T1 }, { t: 'deckDoor', to: 'ga', kind: 'crypt' }, { t: 'cell', gate: 'crack', chest: true, kind: 'key', id: 'key_grave' }], candles: [3, 5], mix: { zombie: [2, 3], skeleton: [1, 1], bat: [1, 1] } },
  g2: { kind: 'corridor', zone: 1, name: 'Grave Hollow', w: [78, 92], outdoor: true, opts: { ...LOOK[1], fog: 0.85 },
    mods: [{ t: 'door', to: 's1', kind: 'crypt' }, { t: 'djLedge', kind: 'hpup', id: 'g2_hp' }, { t: 'cell', gate: 'barricade', kind: 'atkup', id: 'g2_atk' }, { t: 'tablet', id: 'tab2', text: 'THE DEAD HERE DO NOT REST. STRIKE THEM DOWN - OR BE LAID BESIDE THEM.' }],
    candles: [4, 6], mix: { skeleton: [2, 3], zombie: [2, 3], hound: [1, 2], bat: [2, 2] } },
  g4: { kind: 'corridor', zone: 1, name: 'The Mourning Fields', w: [70, 84], outdoor: true, deck: true, opts: { ...LOOK[1], fog: 0.7 },
    mods: [{ t: 'cell', gate: 'crack', kind: 'mpup', id: 'g4_mp' }, { t: 'door', to: 'vg', kind: 'crypt', key: 'key_grave' }, { t: 'tablet', id: 'tab11', text: 'THE VILLAGERS WHO FELL ARE BURIED HERE. THEY WALK AGAIN, LOOKING FOR THEIR HOMES.' }],
    candles: [3, 5], mix: { zombie: [2, 3], skeleton: [2, 2], hound: [1, 2], bat: [2, 2], wyrm: [1, 1] } },
  g3: { kind: 'arena', zone: 1, name: "Baelphegaz's Court", w: [36, 42], outdoor: true, boss: 'beast', reward: 'djump', plats: 2, rise: 3, seal: 'both', candles: [3, 3], decor: 'brazier',
    opts: { ...LOOK[1], ambient: 0.16, boss: 'beast', music: 'boss' } },
  // THE PIT OF DESPAIR: a very short room after Baelphegaz - a few bats, a few easy planks over what looks like a bottomless pit.  It IS one, in its way: falling out of the bottom drops you into the Abyss (see Game.enterAbyss)
  pd: { kind: 'despair', zone: 1, name: 'The Pit of Despair', outdoor: true, abilities: ['djump'], abyss: 'ls', opts: { ...LOOK[1], ambient: 0.1, fog: 0.25 } },
  // LETOSNIK ABYSS: a very long fall (waterfalls down the rock), a pool at the bottom, a few chests and, on a ledge, a page.  A door leads back up to the start of the Pit of Despair.
  ls: { kind: 'abyss', zone: 1, name: 'Letosnik Abyss', parent: 'pd', theme: 'cave', opts: { ...LOOK[9], tint: [0.045, 0.03, 0.012], ambient: 0.5, wisps: 8, music: 'zone9' } },          // (a natural cave: its own rock tiles and backdrop - see THEME.cave and drawCave in world.js)
  s1: { kind: 'sanctuary', zone: 1, name: "Gravekeeper's Crypt", parent: 'g2' },
  // the vaults: a locked door (its padlock is drawn over it), a key found earlier in the same zone, a chest behind it.  They are optional treasure rooms, so no castle can be locked out by one.
  sr: { kind: 'interior', zone: 1, name: 'The Reliquary', parent: 'hr', look: 'crypt', theme: 'chapel', ambient: 0.36, tint: [0.02, 0.03, 0.08], npcs: [0, 0], page: 3 },          // (behind the door the six skulls open: a page of the story)
  vg: { kind: 'interior', zone: 1, name: "The Gravekeeper's Vault", parent: 'g4', look: 'vault', theme: 'chapel', ambient: 0.42, tint: [0.02, 0.05, 0.01], npcs: [0, 0], chest: { kind: 'hpup', id: 'vg_chest' } },
  ga: { kind: 'interior', zone: 1, name: "Gravedigger's Shed", parent: 'g1', look: 'crypt', theme: 'chapel', npc: { kind: 'bearded', title: 'GRAVEDIGGER', text: 'THEY WALK AGAIN, AND I HAVE RUN OUT OF GROUND TO PUT THEM IN. THE HOLLOW BEYOND IS WORSE THAN THE GATE. TAKE THIS - IT HAS CLEARED MORE GRAVES THAN I CAN COUNT.', again: 'DIG DEEP. NEVER LOOK DOWN THE HOLE.', gifts: ['it_torch', 'it_torch'], sells: { item: 'torch', price: 40 } } },

  // ======== ZONE 7 - THE WEEPING SWAMP (Gothicvania Swamp) - you arrive with the Raven Feather
  tw: { kind: 'teleport', zone: 7, name: 'Waystone Boardwalk', outdoor: true, abilities: ['djump'], opts: LOOK[7] },
  w1: { kind: 'corridor', zone: 7, name: 'Mire Edge', w: [88, 102], outdoor: true, abilities: ['djump'], pools: [0, 3], opts: { ...LOOK[7], fog: 0.75 },
    mods: [{ t: 'skull', id: 'skull2' }, { t: 'djLedge', kind: 'hpup', id: 'w1_hp' }, { t: 'cell', gate: 'crack', chest: true, kind: 'key', id: 'key_mire' }, { t: 'tablet', id: 'tab12', near: 'start', text: 'THE MIRE TAKES WHAT THE GRAVE REFUSES. DO NOT STAND STILL.' }],
    candles: [3, 5], barrels: [2, 3], mix: { zombie: [1, 2], skeleton: [1, 2], bat: [1, 2], swampspider: [2, 3], swampthing: [1, 1] } },
  w2: { kind: 'corridor', zone: 7, name: 'Weeping Hollow', w: [80, 94], outdoor: true, abilities: ['djump'], deck: true, pools: [0, 3], opts: { ...LOOK[7], fog: 0.9 },
    mods: [{ t: 'door', to: 'sw', kind: 'wood' }, { t: 'door', to: 'vw', kind: 'crypt', key: 'key_mire' }, { t: 'cell', gate: 'crystal', kind: 'mpup', id: 'w2_mp' }],
    candles: [4, 6], barrels: [2, 3], mix: { swampspider: [2, 3], swampthing: [2, 2], hound: [1, 2], bat: [2, 2], skeleton: [1, 2] } },
  w3: { kind: 'corridor', zone: 7, name: 'Drowned Boardwalk', w: [80, 94], outdoor: true, abilities: ['djump'], deck: true, pools: [0, 3], opts: { ...LOOK[7], fog: 0.8 },
    mods: [{ t: 'cell', gate: 'crack', kind: 'atkup', id: 'w3_atk' }, { t: 'deckDoor', to: 'wa', kind: 'wood' }, { t: 'tablet', id: 'tab13', text: 'SOMETHING SINGS BENEATH THE WATER. IT KNOWS YOUR NAME.' }],
    candles: [4, 5], barrels: [2, 3], mix: { swampthing: [2, 3], swampspider: [2, 3], zombie: [1, 2], bat: [2, 2], wyrm: [1, 1] } },
  wb: { kind: 'arena', zone: 7, name: "The Mother's Hollow", w: [40, 46], outdoor: true, abilities: ['djump'], boss: 'bramble', reward: 'lantern', plats: 3, rise: 3, seal: 'left', flyRow: 6, candles: [3, 3], decor: 'swamp',
    opts: { ...LOOK[7], boss: 'bramble', music: 'boss', fog: 0.45 } },
  sw: { kind: 'sanctuary', zone: 7, name: 'Boardwalk Chapel', parent: 'w2' },
  vw: { kind: 'interior', zone: 7, name: "The Ferryman's Vault", parent: 'w2', look: 'vault', theme: 'hall', ambient: 0.42, tint: [0.0, 0.06, 0.03], npcs: [0, 0], chest: { kind: 'mpup', id: 'vw_chest' } },
  wa: { kind: 'interior', zone: 7, name: "Fisherman's Hut", parent: 'w3', look: 'hut', theme: 'hall', tint: [0.0, 0.05, 0.02], npc: { kind: 'hatman', title: 'FISHERMAN', text: 'SOMETHING SINGS BENEATH THE BOARDS AT NIGHT. I STOPPED FISHING. I START COUNTING THE NOTES INSTEAD. TAKE THIS, AND KEEP MOVING.', again: 'IT HAS NOT SUNG FOR TWO NIGHTS. I DO NOT LIKE THE QUIET.', gifts: ['it_holy', 'it_marrow'], sells: { item: 'marrow', price: 40 } } },

  // ======== ZONE 2 - THE GREAT HALL
  th: { kind: 'teleport', zone: 2, name: 'Waystone Vestibule', opts: LOOK[2] },
  h1: { kind: 'corridor', zone: 2, name: 'Entrance Hall', w: [82, 92], deck: true, opts: { ...LOOK[2], ambient: 0.34 },
    mods: [{ t: 'skull', id: 'skull3' }, { t: 'door', to: 's2', kind: 'wood' }, { t: 'deckDoor', to: 'ha', kind: 'wood' }, { t: 'deckDoor', to: 'mr', kind: 'crypt' }, { t: 'tablet', id: 'tab3', near: 'start', text: 'THE GREAT HALL ONCE RANG WITH FEASTING. NOW THE FACES ON THE WALLS WATCH - AND SOME OF THEM WATCH BACK.' }],
    candles: [4, 6], barrels: [2, 4], mix: { bat: [3, 3], ghost: [1, 1], zealot: [3, 5] } },
  h2: { kind: 'corridor', zone: 2, name: 'Portrait Gallery', w: [84, 98], levers: 1, opts: { ...LOOK[2], ambient: 0.36 },
    mods: [{ t: 'djLedge', kind: 'mpup', id: 'h2_mp' }, { t: 'cell', gate: 'crystal', kind: 'hpup', id: 'h2_hp' }, { t: 'cell', gate: 'crack', kind: 'mpup', id: 'h2_mp2' }, { t: 'door', to: 'vh', kind: 'crypt', key: 'key_hall' }],
    candles: [5, 6], barrels: [2, 4], mix: { skeleton: [1, 1], ghost: [2, 2], fireskull: [2, 2], bat: [3, 3], wyrm: [1, 1], zealot: [5, 5] } },
  h4: { kind: 'arena', zone: 2, name: 'Phantom Stable', w: [40, 46], boss: 'nightmare', reward: 'dash', plats: 2, rise: 3, seal: 'both', abilities: ['djump'], decor: 'torch',
    opts: { weather: 'embers', ambient: 0.3, horizon: 12, boss: 'nightmare', music: 'boss' } },
  h3: { kind: 'tower', zone: 2, name: 'Belfry Stairs', w: [28, 32], h: [34, 40], top: [8, 10], opts: { ...LOOK[2], ambient: 0.4 }, topItem: { kind: 'key', id: 'key_hall' },
    mods: [{ t: 'tablet', id: 'tab4', text: 'THE BELFRY STAIRS CLIMB TO THE CHAPEL. THE BELLS HAVE NOT RUNG SINCE THE LORD DESCENDED.' }], candles: [3, 4], barrels: [1, 2], mix: { bat: [3, 3], ghost: [1, 1], fireskull: [2, 2], zealot: [3, 3] } },
  s2: { kind: 'sanctuary', zone: 2, name: 'Hall Sanctuary', parent: 'h1' },
  vh: { kind: 'interior', zone: 2, name: "The Steward's Vault", parent: 'h2', look: 'vault', theme: 'hall', ambient: 0.42, tint: [0.05, 0.03, 0.0], npcs: [0, 0], chest: { kind: 'atkup', id: 'vh_chest' } },
  ha: { kind: 'interior', zone: 2, name: "Servants' Quarters", parent: 'h1', look: 'study', theme: 'hall', npc: { kind: 'woman', title: 'LAST SERVANT', text: 'THE LORD DISMISSED US ALL AT DUSK, BUT THE PICTURES WOULD NOT STOP WATCHING. I HID. I AM VERY GOOD AT HIDING. HERE - IT IS NOT MUCH, BUT IT IS HONEST.', again: 'THERE IS A MIRROR BEHIND THE OTHER DOOR UPSTAIRS. I DO NOT LOOK AT IT. NEITHER SHOULD YOU.', gifts: ['it_bandage', 'heart', 'it_dagger'], sells: { item: 'bandage', price: 70 } } },

  // another OPTIONAL boss: a second door on the upper floor of the Entrance Hall opens on a room with a great mirror on the back wall.  Walk in front of it and meet your reflection in the middle: the glass cracks and
  // your reflection crashes out, in silver and violet, and fights with a sword and the very items you carry (the fight is sealed in until it falls; it leaves a mana container)
  mr: { kind: 'arena', lair: true, mirror: true, zone: 2, name: 'The Mirror Room', parent: 'h1', w: [42, 46], boss: 'mirror', reward: 'shard', plats: 2, rise: 3, candles: [2, 2], decor: 'torch',
    opts: { ...LOOK[2], ambient: 0.26, tint: [0.02, 0, 0.08], vig: 0.62, boss: 'mirror', music: 'boss' } },

  // ======== ZONE 3 - THE MOONLIT CHAPEL
  tc: { kind: 'teleport', zone: 3, name: 'Waystone Chancel', opts: LOOK[3] },
  c1: { kind: 'corridor', zone: 3, name: 'The Nave', w: [116, 128], candleCell: 2, deck: true, opts: { ...LOOK[3], ambient: 0.32, fog: 0.45 },
    mods: [{ t: 'skull', id: 'skull4' }, { t: 'door', to: 's3', kind: 'wood' }, { t: 'deckDoor', to: 'dc', kind: 'crypt' }, { t: 'cell', gate: 'crack', chest: true, kind: 'key', id: 'key_chapel' }, { t: 'tablet', id: 'tab5', near: 'start', text: 'HERE THE FAITHFUL PRAYED. HERE THEY WERE FIRST TAKEN.' }],
    candles: [4, 5], barrels: [1, 2], mix: { ghost: [2, 2], ghoul: [2, 3], wizard: [1, 1], acolyte: [1, 1], bat: [1, 1], frostwyrm: [1, 1], zealot: [1, 1] } },
  c2: { kind: 'corridor', zone: 3, name: 'Bell Gallery', w: [96, 108], leverCell: true, abilities: ['djump', 'dash'], opts: LOOK[3],
    mods: [{ t: 'gap' }, { t: 'door', to: 'shc', kind: 'wood', label: 'THE KEEPER', hint: 'SOMETHING IN THE DARK SELLS WHAT THE DEAD NO LONGER NEED.' }, { t: 'door', to: 'vc', kind: 'crypt', key: 'key_chapel' }, { t: 'tablet', id: 'tab6', near: 'gap', text: 'THE GULF IS TOO WIDE FOR ANY LEAP. ONLY ONE WHO STEPS THROUGH SHADOW MAY CROSS.' }],
    candles: [3, 4], mix: { wraith: [2, 2], ghost: [1, 1], wizard: [1, 1], acolyte: [1, 1], archmage: [1, 1], ghoul: [1, 2], bat: [2, 2], frostwyrm: [1, 1] } },
  c3: { kind: 'arena', zone: 3, name: 'Sanctum of the Seraph', w: [40, 46], h: 16, boss: 'angel', reward: 'ember', plats: 3, rise: 4, seal: 'both', exitGate: 'barricade', abilities: ['djump'], decor: 'column', flyRow: 6,
    opts: { weather: 'wisps', ambient: 0.28, horizon: 14, boss: 'angel', music: 'boss' } },
  s3: { kind: 'sanctuary', zone: 3, name: 'Chapel Sanctuary', parent: 'c1' },
  vc: { kind: 'interior', zone: 3, name: "The Verger's Vault", parent: 'c2', look: 'vault', theme: 'chapel', ambient: 0.42, tint: [0.04, 0.02, 0.07], npcs: [0, 0], chest: { kind: 'hpup', id: 'vc_chest' } },

  // the disco: a joke room off the Nave's upper floor.  A door at one end, the Magic Shoes at the other; skeletons dance in the background until you reach the middle of the floor
  dc: { kind: 'disco', lair: true, zone: 3, name: 'The Disco', parent: 'c1', w: [42, 48] },
  // ======== ZONE 9 - THE CISTERN (the flooded waterworks under Prague, reached by a door in a pier of Karluv Bridge, where the river runs in: the water flows and carries you; the Drowned Warden keeps the gate; beyond the gate, a wall of ice
  // that only fire melts leads on to the Frozen Caverns).  It is entered with the double jump AND the dash (the fall under the bridge), so its rooms are built for a hero who has both.
  tq: { kind: 'teleport', zone: 9, name: 'Waystone Culvert', opts: LOOK[9] },
  q1: { kind: 'corridor', zone: 9, name: 'The Sluice', w: [92, 106], opts: { ...LOOK[9], fog: 0.3 }, abilities: ['djump', 'dash'], streams: [2, 3],
    mods: [{ t: 'skull', id: 'skull5' }, { t: 'door', to: 'sq', kind: 'wood' }, { t: 'djLedge', kind: 'mpup', id: 'q1_mp' }, { t: 'tablet', id: 'tab14', near: 'start', text: 'THE OLD CITY DREW ITS WATER FROM THESE VAULTS. NOW THE WATER DRAWS WHAT IT LIKES. DO NOT STAND STILL.' }],
    candles: [2, 3], barrels: [2, 3], mix: { zombie: [2, 3], swampthing: [1, 2], ghost: [1, 2], bat: [1, 2], frostwyrm: [1, 1], wraith: [1, 1] } },
  q2: { kind: 'tower', zone: 9, name: 'The Cascade Shaft', w: [28, 32], h: [36, 42], top: [9, 11], opts: { ...LOOK[9], ambient: 0.4 }, abilities: ['djump', 'dash'], falls: [2, 3],
    topItem: { kind: 'atkup', id: 'q2_atk' }, candles: [2, 3], barrels: [1, 2], mix: { zombie: [1, 2], ghost: [2, 2], wraith: [1, 1], bat: [2, 3], frostwyrm: [1, 1] } },
  q3: { kind: 'corridor', zone: 9, name: 'The Drowned Aqueduct', w: [84, 98], opts: { ...LOOK[9], fog: 0.3 }, abilities: ['djump', 'dash'], streams: [2, 3],
    mods: [{ t: 'tablet', id: 'tab15', near: 'start', text: 'BEYOND THE LAST SLUICE STANDS THE GATE THE WATER WAS MADE TO KEEP. SOMETHING OLDER THAN THE CITY KEEPS IT NOW.' }],
    candles: [2, 3], barrels: [2, 3], mix: { zombie: [2, 3], swampthing: [1, 2], ghost: [1, 2], bat: [1, 2], frostwyrm: [1, 2], swampspider: [1, 2] } },
  qb: { kind: 'arena', zone: 9, name: 'The Flooded Gate', w: [44, 50], h: 16, boss: 'drowned', reward: 'tide', plats: 2, rise: 3, seal: 'both', flyRow: 7, abilities: ['djump', 'dash'], decor: 'cistern', candles: [2, 2],
    opts: { ...LOOK[9], ambient: 0.28, boss: 'drowned', music: 'boss' } },
  tf: { kind: 'teleport', zone: 9, name: 'Waystone Floodgate', exitGate: 'ice', opts: LOOK[9] },          // (past the Flooded Gate, in front of the wall of ice that fire melts: a second waystone, so the way back to the wall - once the Chapel has given fire - is one jump)
  sq: { kind: 'sanctuary', zone: 9, name: 'Dry Sanctuary', parent: 'q1' },
  // ======== ZONE 8 - THE CLOCKWORK DUNGEON (the Brazen Hierophant's works: brass, pipes and steam, with gears behind gears)
  tk: { kind: 'teleport', zone: 8, name: 'Cogwheel Landing', areaLabel: 'The Clockwork Dungeon', opts: LOOK[8] },
  k1: { kind: 'corridor', zone: 8, name: 'The Escapement', w: [80, 94], levers: 2, jets: [4, 6], opts: { ...LOOK[8], fog: 0.12 }, abilities: ['djump', 'dash', 'ember'],
    mods: [{ t: 'door', to: 'sk', kind: 'wood' }, { t: 'door', to: 'vk', kind: 'crypt', key: 'key_gear' }, { t: 'cell', gate: 'barricade', chest: true, kind: 'key', id: 'key_gear' }, { t: 'djLedge', kind: 'atkup', id: 'k1_atk' }, { t: 'tablet', id: 'tab16', near: 'start', text: 'THE LORD\'S ENGINEER BUILT A MACHINE TO HOLD THE SUN BELOW THE HILLS. IT HAS NOT STOPPED TURNING SINCE, AND NEITHER HAS HE.' }],
    candles: [2, 3], barrels: [2, 3], mix: { skeleton: [1, 2], sorcerer: [1, 2], zealot: [1, 2], hound: [1, 1], bat: [1, 2], fireskull: [1, 2], emberwyrm: [1, 1] } },
  k2: { kind: 'tower', zone: 8, name: 'The Mainspring Shaft', w: [28, 32], h: [38, 44], top: [9, 11], opts: { ...LOOK[8], ambient: 0.4 }, abilities: ['djump', 'dash', 'ember'],
    topItem: { kind: 'mpup', id: 'k2_mp' }, candles: [2, 3], barrels: [1, 2], mix: { skeleton: [1, 2], sorcerer: [1, 1], fireskull: [3, 3], bat: [2, 2], emberwyrm: [1, 1], zealot: [1, 1] } },
  k3: { kind: 'gears', zone: 8, name: 'The Great Gear', w: [76, 80], opts: LOOK[8], abilities: ['djump', 'dash', 'ember'] },
  kb: { kind: 'arena', zone: 8, name: "The Hierophant's Foundry", w: [44, 50], h: 16, boss: 'colossus', reward: 'spring', plats: 2, rise: 3, seal: 'left', abilities: ['djump'], decor: 'brazier', candles: [2, 2], jets: 3,
    opts: { ...LOOK[8], ambient: 0.32, boss: 'colossus', music: 'boss' } },
  sk: { kind: 'sanctuary', zone: 8, name: 'Brass Sanctuary', parent: 'k1' },
  vk: { kind: 'interior', zone: 8, name: "The Engineer's Vault", parent: 'k1', look: 'vault', theme: 'hall', ambient: 0.42, tint: [0.07, 0.04, 0.0], npcs: [0, 0], chest: { kind: 'hpup', id: 'vk_chest' } },
  // ======== ZONE 10 - THE LIBRARY OF AGES (inside Arx Noctis, off the Crossing Hall behind a locked door: the Lord's archive, where haunted books fly and the Librarian keeps the KEY OF GOLD that opens the Shadow Throne)
  tl: { kind: 'teleport', zone: 10, name: 'Waystone Reading Room', opts: LOOK[10], abilities: ['djump', 'dash', 'ember'] },
  l1: { kind: 'corridor', zone: 10, name: 'The Stacks', w: [84, 98], deck: true, opts: { ...LOOK[10], ambient: 0.32 }, abilities: ['djump', 'dash', 'ember'],
    mods: [{ t: 'door', to: 'sl', kind: 'wood' }, { t: 'cell', gate: 'crack', kind: 'hpup', id: 'l1_hp' }, { t: 'tablet', id: 'tab20', near: 'start', text: 'THE LORD READ EVERY BOOK IN THE WORLD AND FOUND THE ENDING WRONG. HE HAS BEEN REWRITING IT EVER SINCE, AND THE BOOKS HAVE LEARNED TO FIGHT BACK.' }],
    candles: [4, 6], barrels: [1, 2], mix: { tome: [3, 5], grimoire: [1, 1], ghost: [1, 2], portrait: [1, 2], wizard: [1, 1] } },
  l2: { kind: 'tower', zone: 10, name: 'The Spiral Stair', w: [28, 32], h: [38, 44], top: [9, 11], opts: { ...LOOK[10], ambient: 0.4 }, abilities: ['djump', 'dash', 'ember'],
    topItem: { kind: 'mpup', id: 'l2_mp' }, candles: [2, 3], barrels: [1, 2], mix: { tome: [3, 4], grimoire: [1, 2], ghost: [1, 1], bat: [1, 2] } },
  l3: { kind: 'corridor', zone: 10, name: 'The Reading Gallery', w: [78, 90], levers: 1, opts: { ...LOOK[10], ambient: 0.32 }, abilities: ['djump', 'dash', 'ember'],
    mods: [{ t: 'door', to: 'shl', kind: 'wood', label: 'THE KEEPER', hint: 'SOMETHING IN THE DARK SELLS WHAT THE DEAD NO LONGER NEED.' }, { t: 'cell', gate: 'crystal', kind: 'atkup', id: 'l3_atk' }, { t: 'tablet', id: 'tab21', near: 'start', text: 'THE LIBRARIAN WAS ONLY EVER ASKED TO KEEP THE KEYS. HE KEPT EVERYTHING ELSE TOO, AND NOW NOTHING MAY BE BORROWED.' }],
    candles: [3, 4], barrels: [1, 2], mix: { tome: [3, 4], grimoire: [1, 2], wraith: [1, 1], ghost: [1, 1], archmage: [1, 1] } },
  lb: { kind: 'arena', zone: 10, name: "The Librarian's Study", w: [44, 50], h: 16, boss: 'librarian', reward: 'goldkey', plats: 3, rise: 3, seal: 'left', flyRow: 6, abilities: ['djump'], decor: 'column', candles: [2, 2],
    opts: { ...LOOK[10], ambient: 0.3, boss: 'librarian', music: 'boss' } },
  sl: { kind: 'sanctuary', zone: 10, name: 'Reading Nook', parent: 'l1' },
  // ======== ZONE 11 - THE FROZEN CAVERNS (beyond the Cistern, behind a wall of ice that only fire melts; the ice floors are slippery; walls of ice bar the way and hide treasure; at the far end the RIMEWYRM guards the KEY OF ANTIMONY, which opens the Library; the Glacier Road hides the OUROBOROS)
  ti: { kind: 'teleport', zone: 11, name: 'Waystone Rime Hollow', opts: LOOK[11], abilities: ['djump', 'dash', 'ember'] },
  i1: { kind: 'corridor', zone: 11, name: 'The Frozen Gallery', w: [102, 116], leverCell: true, opts: { ...LOOK[11], fog: 0.15 }, abilities: ['djump', 'dash', 'ember'],
    mods: [{ t: 'iceWall' }, { t: 'door', to: 'si', kind: 'wood' }, { t: 'cell', gate: 'ice', kind: 'hpup', id: 'i1_hp' }, { t: 'tablet', id: 'tab22', near: 'start', text: 'THE COLD CAME UP FROM THE FOUNDATIONS THE DAY THE SUN WAS TAKEN. NOTHING THAT FELL IN HAS THAWED. NOTHING THAT WALKS HERE FEELS IT.' }],
    candles: [1, 2], barrels: [1, 2], mix: { frostwyrm: [1, 2], hound: [1, 2], shade: [1, 2], bat: [2, 3], skeleton: [1, 1] } },
  i2: { kind: 'tower', zone: 11, name: 'The Icefall', w: [28, 32], h: [36, 42], top: [9, 11], opts: { ...LOOK[11], ambient: 0.45 }, abilities: ['djump', 'dash', 'ember'],
    topItem: { kind: 'mpup', id: 'i2_mp' }, candles: [1, 2], barrels: [1, 1], mix: { frostwyrm: [1, 2], ghost: [1, 2], wraith: [1, 1], bat: [2, 3] } },
  i3: { kind: 'corridor', zone: 11, name: 'The Glacier Road', w: [100, 114], opts: { ...LOOK[11], fog: 0.15, dark: true, wisps: 12 }, abilities: ['djump', 'dash', 'ember'],          // (DARK: only the hero's wisp, the ghostly blue wisps that drift here and the glare of the ice show the way - the ice throws every light back)
    mods: [{ t: 'skull', id: 'skull6' }, { t: 'iceWall' }, { t: 'iceWall' }, { t: 'cell', gate: 'ice', kind: 'ouroboros', id: 'i3_ouroboros' }, { t: 'cell', gate: 'crack', kind: 'atkup', id: 'i3_atk' }],
    candles: [3, 4], barrels: [1, 2], mix: { frostwyrm: [1, 2], hound: [2, 2], wraith: [1, 2], ghost: [1, 1], bat: [1, 2] } },
  ib: { kind: 'arena', zone: 11, name: "The Rimewyrm's Heart", w: [46, 52], h: 16, boss: 'rimewyrm', reward: 'well', plats: 3, rise: 3, seal: 'left', flyRow: 8, abilities: ['djump', 'dash', 'ember'], decor: 'ice',          // (the end of the Frozen Caverns: when the Rimewyrm falls the floor shatters and the hero drops into the FROZEN WELL, where its treasure waits in chests)
    opts: { ...LOOK[11], ambient: 0.4, wisps: 9, fog: 0.08, boss: 'rimewyrm', music: 'boss' } },
  ic: { kind: 'well', zone: 11, name: 'The Frozen Well', parent: 'ib', opts: { ...LOOK[11], ambient: 0.34, wisps: 9, fog: 0.1, music: 'zone11' } },          // (reached only by falling from the Rimewyrm's arena; a door leads out, to Karluv Bridge)
  si: { kind: 'sanctuary', zone: 11, name: 'Rime Sanctuary', parent: 'i1' },
  // ======== THE KEEPER'S STALLS: a hooded figure in a small dark room off a corridor in the later zones sells things for the gold you have gathered (see shop.js)
  shc: { kind: 'shop', zone: 3, name: 'The Hooded Stall', parent: 'c2', tier: 0 },
  shu: { kind: 'shop', zone: 4, name: 'The Quiet Bargain', parent: 'u1', tier: 1 },
  shl: { kind: 'shop', zone: 10, name: 'The Margin Market', parent: 'l3', tier: 2 },
  sht: { kind: 'shop', zone: 5, name: 'The Last Bargain', parent: 't1', tier: 3 },
  // ======== THE CROSSROADS: the way splits in two, and every door is signed.  (The doors themselves - what each needs, where it leads, what locks it - are in PAIRS below.)
  // THE THREE ROADS used to be one busy stretch with a waystone, a high door, two gates into the keep and the Reliquary's door.  Now each has a place of its own, in the order they are met:
  hw: { kind: 'teleport', zone: 1, name: 'The Waystone Glade', outdoor: true, abilities: ['djump'], opts: { ...LOOK[1], ambient: 0.14 } },          // the waystone, alone
  hub1: { kind: 'corridor', zone: 1, name: 'The Mire Road', w: [32, 38], outdoor: true, calm: true, abilities: ['djump'], opts: { ...LOOK[1], ambient: 0.14 }, mods: [], candles: [2, 3], mix: {} },          // only the high door to the Mire
  hk: { kind: 'corridor', zone: 1, name: 'The Gate of Arx Noctis', w: [46, 52], outdoor: true, calm: true, abilities: ['djump'], opts: { ...LOOK[1], ambient: 0.12 }, mods: [], candles: [2, 3], mix: {} },          // the two gates into the keep, the Great Hall and the Chapel
  hr: { kind: 'corridor', zone: 1, name: 'The Quiet Corner', w: [30, 36], outdoor: true, calm: true, closedRight: true, abilities: ['djump'], opts: { ...LOOK[1], ambient: 0.1 }, mods: [{ t: 'door', to: 'sr', kind: 'crypt', lock: ['skulls_done'] }, { t: 'tablet', id: 'tabsix', near: 'door', to: 'sr', text: 'IN THE WAR I KILLED SIX MEN.' }], candles: [1, 2], mix: {} },          // beyond the gates, out of the way: the Reliquary's door, and a gravestone
  // THE CROSSING HALL, likewise, is four short places: the waystone, the barricaded way to the Crypts (and the hidden page), the Library's door, and last the Throne's door.
  hx: { kind: 'teleport', zone: 3, name: 'The Crossing Waystone', abilities: ['djump', 'dash', 'ember'], opts: { ...LOOK[3], ambient: 0.34 } },          // the waystone, alone
  hub2: { kind: 'corridor', zone: 3, name: 'The Barricaded Gallery', w: [48, 56], calm: true, abilities: ['djump', 'dash', 'ember'], opts: { ...LOOK[3], ambient: 0.34, fog: 0.4 }, mods: [{ t: 'cell', gate: 'crack', hollow: true, kind: 'hpup', secret: true, id: 'hub2_hp' }], candles: [2, 3], mix: {} },          // only the barricaded door to the Crypts
  hl: { kind: 'corridor', zone: 3, name: 'The Archive Passage', w: [42, 50], calm: true, abilities: ['djump', 'dash', 'ember'], opts: { ...LOOK[3], ambient: 0.32, fog: 0.4 }, mods: [], candles: [2, 3], mix: {} },          // only the Library's locked door
  ht: { kind: 'corridor', zone: 3, name: 'The Throne Approach', w: [44, 52], calm: true, closedRight: true, abilities: ['djump', 'dash', 'ember'], opts: { ...LOOK[3], ambient: 0.28, fog: 0.4 }, mods: [], candles: [2, 3], mix: {} },          // the last door: the Shadow Throne

  // ======== ZONE 4 - THE CRYPTS (ruled by the Crimson Count; it was the clockwork Underworks - the rooms are the same, the dead have moved in)
  tu: { kind: 'teleport', zone: 4, name: 'Waystone Charnel', opts: LOOK[4] },
  u1: { kind: 'corridor', zone: 4, name: 'The Ossuary', w: [70, 82], levers: 1, opts: { ...LOOK[4], fog: 0.45 },
    mods: [{ t: 'door', to: 's5', kind: 'wood' }, { t: 'door', to: 'shu', kind: 'wood', label: 'THE KEEPER', hint: 'SOMETHING IN THE DARK SELLS WHAT THE DEAD NO LONGER NEED.' }, { t: 'door', to: 'vu', kind: 'crypt' }, { t: 'djLedge', kind: 'hpup', id: 'u1_hp' }, { t: 'tablet', id: 'tab7', near: 'start', text: 'HERE THE LORD LAID HIS HOUSEHOLD TO REST. THEY WERE PROMISED SLEEP. THE COUNT HAS BEEN WAKING THEM, ONE BY ONE.' }],
    candles: [3, 4], barrels: [2, 3], mix: { skeleton: [2, 2], ghost: [2, 3], wraith: [1, 2], fireskull: [1, 2], bat: [1, 2], wyrm: [1, 1] } },
  u2: { kind: 'tower', zone: 4, name: 'The Bone Stair', w: [28, 32], h: [36, 42], top: [9, 11], opts: { ...LOOK[4], ambient: 0.45, dark: true },          // (DARK: only the wisp shows the way)
    mods: [{ t: 'tablet', id: 'tab17', near: 'start', text: 'IT IS VERY DARK HERE. DO NOT BE AFRAID OF IT. I WILL GO AHEAD OF YOU.' }],
    topItem: { kind: 'key', id: 'key_crypt' }, candles: [1, 1], barrels: [1, 2], mix: { skeleton: [1, 2], ghost: [2, 2], wraith: [1, 1], fireskull: [2, 3], bat: [2, 2], wyrm: [1, 1] } },
  u3: { kind: 'arena', zone: 4, name: "The Count's Crypt", w: [44, 50], boss: 'vampire', reward: 'thunder', plats: 2, rise: 3, seal: 'left', abilities: ['djump'], candles: [2, 2], decor: 'torch',
    opts: { ...LOOK[4], ambient: 0.22, tint: [0.07, 0, 0.04], vig: 0.6, boss: 'vampire', music: 'boss' } },
  s5: { kind: 'sanctuary', zone: 4, name: 'Crypt Sanctuary', parent: 'u1' },
  vu: { kind: 'interior', zone: 4, name: "The Count's Treasury", parent: 'u1', look: 'vault', theme: 'chapel', ambient: 0.4, tint: [0.0, 0.05, 0.06], npcs: [0, 0], chest: { kind: 'atkup', id: 'vu_chest' } },

  // ======== ZONE 5 - THE SHADOW THRONE (the waystone chamber is the last thing before the Shadow Lord)
  tt: { kind: 'teleport', zone: 5, name: 'Waystone Antechamber', opts: LOOK[5] },
  t1: { kind: 'corridor', zone: 5, name: 'Hall of Shadows', w: [80, 92], deck: true, opts: { ...LOOK[5], fog: 0.55 },
    mods: [{ t: 'door', to: 's4', kind: 'wood' }, { t: 'door', to: 'sht', kind: 'wood', label: 'THE KEEPER', hint: 'SOMETHING IN THE DARK SELLS WHAT THE DEAD NO LONGER NEED.' }, { t: 'deckDoor', to: 'ta', kind: 'wood' }, { t: 'cell', gate: 'crystal', kind: 'mpup', id: 't1_mp' }, { t: 'tablet', id: 'tab8', near: 'start', text: 'HE WAITS ABOVE. THE ONE WHO TOOK THE SUN. TURN BACK, STRANGER - OR BRING THE DAWN.' }],
    candles: [3, 3], barrels: [2, 3], mix: { skeleton: [1, 1], wraith: [2, 2], archmage: [1, 1], bat: [4, 4], ghost: [2, 2], sorcerer: [1, 1], fireskull: [2, 2], wyrm: [1, 2], zealot: [4, 4] } },
  // THE LAST DARK: the room before the Shadow Lord's.  A plain platform, and a pit too wide for anything but the Ouroboros: jump, double jump, dash, jump, double jump, dash, without ever coming down.  As you cross, the music dies away and the light goes out
  // (def.pitFade: see Game.stepPlay), until only the wisp shows anything.  A door at the far side leads on into the Throne.
  tp: { kind: 'chasm', zone: 5, name: 'The Last Dark', pit: [84, 96], opts: { ...LOOK[5], ambient: 0.3, weather: null } },
  t2: { kind: 'arena', zone: 5, name: 'Throne of Shadows', w: [44, 50], h: 16, boss: 'shadow', reward: 'dawn', plats: 3, rise: 3, seal: 'left', abilities: ['djump'], decor: 'banner', flyRow: 5,
    opts: { ...LOOK[5], ambient: 0.5, weather: 'embers', vig: 0.75, boss: 'shadow', music: 'boss_final' } },
  s4: { kind: 'sanctuary', zone: 5, name: 'Last Sanctuary', parent: 't1' },
  ta: { kind: 'interior', zone: 5, name: 'The Hidden Study', parent: 't1', look: 'study', theme: 'hall', ambient: 0.5, tint: [0.03, 0.0, 0.05], npc: { kind: 'oldman', title: 'THE LORD\'S SCRIBE', text: 'I WROTE DOWN EVERYTHING HE DID, AND NEVER ONCE LOOKED UP. NOW I CANNOT STOP LOOKING. HE IS ABOVE US. TAKE THIS, STRANGER - AND WHEN YOU MEET HIM, DO NOT LET HIM SPEAK.', again: 'I HAVE NO MORE PAGES. ONLY THE ONES I CANNOT BURN.', gifts: ['it_holy', 'it_holy', 'heart'], sells: { item: 'holy', price: 50 } } },
};
const ORDER = ['v0', 'vq', 'v1', 'tv', 'v2', 'v3', 'vb', 'vs', 'br', 'ot', 'og', 'sv', 'tg', 'g1', 'g2', 'g4', 'vg', 'g3', 'pd', 'ls', 's1', 'hw', 'hub1', 'hk', 'hr', 'sr', 'tw', 'w1', 'w2', 'vw', 'w3', 'wb', 'sw', 'tq', 'q1', 'q2', 'q3', 'qb', 'tf', 'sq', 'th', 'h1', 'h2', 'vh', 'h4', 'h3', 's2', 'tc', 'c1', 'c2', 'vc', 'c3', 's3', 'dc', 'hx', 'hub2', 'hl', 'ht', 'tu', 'u1', 'vu', 'u2', 'u3', 's5', 'tk', 'k1', 'vk', 'k2', 'k3', 'kb', 'sk', 'tl', 'l1', 'l2', 'l3', 'lb', 'sl', 'ti', 'i1', 'i2', 'i3', 'ib', 'ic', 'si', 'shc', 'shu', 'shl', 'sht', 'tt', 't1', 'tp', 't2', 's4', 'hv1', 'hv2', 'hv3', 'hv4', 'hc', 'shk', 'ga', 'wa', 'ha', 'ta', 'mr'];
// The castle is a GRAPH, not a road.  Each chain is a run of rooms joined edge to edge (a's right end opens into b's left end); the chains meet at two crossroads (hub1, hub2), whose doors are signed:
//   village - graveyard - hub1 -+- the Mire (a door high on a ledge: needs the double jump) - the Mother's Hollow (a dead end: its return door drops you back at hub1)
//                               +- the Great Hall ------------------------------------------------+-- back to hub1; the Chapel door has two sigils: the Hall's and the Flooded Gate's boss
//                               +- the Chapel - hub2 -+- the Crypts (their door is barricaded: burn it) ---+
//                                                     +- (the Clockwork Dungeon: its door is over a gulf) -+-- back to hub2; the Throne door has two sigils and a crystal wall (thunder)
//                                                     +- the Throne
// Every branch ends in a return door (RETURNS) that drops you at its crossroads, so you can always come back.
// Off the main row, Karluv Bridge has a door of its own (the 'cistern' pair): in a pier under the deck, reached by a fall through the planks and then the double jump and the dash.  It leads into the Cistern, the Flooded Gate, a waystone room (tf)
// and a wall of ice that only fire melts, and so on into the Frozen Caverns, whose far end drops you back on the bridge.
const CHAINS = [
  ['v0', 'v1', 'tv', 'v2', 'v3', 'vb', 'vs', 'br', 'tg', 'g1', 'g2', 'g4', 'g3', 'pd', 'hw', 'hub1', 'hk', 'hr'],
  ['tw', 'w1', 'w2', 'w3', 'wb'],
  ['th', 'h1', 'h2', 'h4', 'h3'],
  ['tc', 'c1', 'c2', 'c3', 'hx', 'hub2', 'hl', 'ht'],
  ['tu', 'u1', 'u2', 'u3'],
  ['tt', 't1', 'tp', 't2'],
  ['tk', 'k1', 'k2', 'k3', 'kb'],
  ['tl', 'l1', 'l2', 'l3', 'lb'],
  ['tq', 'q1', 'q2', 'q3', 'qb', 'tf', 'ti', 'i1', 'i2', 'i3', 'ib'],          // (the Cistern, then - through the ice wall at the end of the waystone room 'tf' - the Frozen Caverns)
];
const LINKS = CHAINS.flatMap(c => c.slice(1).map((id, i) => [c[i], 'R', id, 'L'])).concat([['vq', 'R', 'v0', 'L']]);          // (the secret hollow joins the hill's left edge)
// the crossroads' doors (two-way): hub a, its door tag ta, the first room of the branch b, the tag of that room's door tb; mod = how the door is built (see genCorridor), lock = boss flags it needs
const PAIRS = [
  { a: 'hk', ta: 'hall', b: 'th', tb: 'in', kind: 'wood', mod: 'door', label: 'ARX NOCTIS: THE GREAT HALL', hint: 'THE GATE OF THE KEEP. EVERYTHING BEYOND IT BELONGS TO THE LORD.' },
  { a: 'hub1', ta: 'mire', b: 'tw', tb: 'in', kind: 'crypt', mod: 'djDoor', label: 'THE WEEPING MIRE', hint: 'THE DOOR IS HIGH. ONLY A WINGED LEAP WILL REACH IT. THE MIRE ENDS WHERE ITS MOTHER WAITS.' },
  { a: 'hk', ta: 'chapel', b: 'tc', tb: 'in', kind: 'crypt', mod: 'door', label: 'ARX NOCTIS: THE MOONLIT CHAPEL', hint: 'A SECOND GATE INTO THE KEEP. IT OPENS ONLY WHEN THE MASTERS OF THE GREAT HALL AND OF THE FLOODED GATE ARE DEAD. THE FLOODED GATE IS IN THE CISTERN, UNDER KARLUV BRIDGE IN PRAGUE.', lock: ['boss_h4', 'boss_qb'] },
  { a: 'hub2', ta: 'crypts', b: 'tu', tb: 'in', kind: 'crypt', mod: 'cellDoor', gate: 'barricade', label: 'THE CRYPTS', hint: 'THE WAY IS BARRICADED. FIRE WILL CLEAR IT.' },
  // the Clockwork Dungeon is entered through the Orloj Tower, in PRAGUE: a locked door high on a ledge (a double jump) in Smouldering Lane...
  { a: 'v2', ta: 'orloj', b: 'ot', tb: 'in', kind: 'crypt', mod: 'djDoor', key: 'key_crypt', wide: true, label: 'THE ORLOJ TOWER', hint: 'THE DOOR IS HIGH, AND LOCKED. IT NEEDS THE KEY OF TIN.' },
  // ...and from the landing beside the clock, the way on into the Clockwork Dungeon
  { a: 'ot', ta: 'clockwork', b: 'og', tb: 'in', kind: 'crypt', side: 'R' },
  // ...which opens into the Boiler Loft, whose far door (sealed by the golem's sigil) is the way on into the Clockwork Dungeon
  { a: 'og', ta: 'forge', b: 'tk', tb: 'in', kind: 'crypt', side: 'R', lock: ['boss_og'], hint: 'THE BOILER GOLEM STILL BARS THE WAY ON.' },
  // the Cistern: a door in the pier under Karluv Bridge (a fall through the planks, then the double jump and the dash, to its ledge; no gate: the way in is the fall).  Beyond the Flooded Gate, past a second waystone, a wall of ice (fire melts it) is the way on into the Frozen Caverns.  The Library: a locked door, its key (the KEY OF ANTIMONY) is held by the Rimewyrm at the far end of the Frozen Caverns
  { a: 'br', ta: 'cistern', b: 'tq', tb: 'in', kind: 'crypt', mod: 'vaultDoor' },
  { a: 'hl', ta: 'library', b: 'tl', tb: 'in', kind: 'crypt', mod: 'door', key: 'key_frost', label: 'ARX NOCTIS: THE LIBRARY OF AGES', hint: 'LOCKED. THE KEY LIES IN THE FROZEN CAVERNS. THE LIBRARIAN KEEPS THE KEY TO THE THRONE.' },
  { a: 'ht', ta: 'throne', b: 'tt', tb: 'in', kind: 'crypt', mod: 'cellDoor', gate: 'crystal', key: 'key_gold', label: 'THE SHADOW THRONE', hint: 'CRYSTAL SEALS THE WAY, TWO SIGILS MUST BURN (THE COUNT OF THE CRYPTS AND THE LORD OF THE CLOCKWORK DUNGEON), AND THE DOOR IS LOCKED: THE LIBRARIAN KEEPS THE KEY.', lock: ['boss_u3', 'boss_kb'] },
];
// one-way doors: the far end of a branch drops you at its crossroads' door  [room, its door tag, hub, the hub door it arrives at]
const RETURNS = [['wb', 'out', 'hub1', 'mire'], ['h3', 'out', 'hk', 'hall'], ['u3', 'out', 'hub2', 'crypts'], ['kb', 'out', 'ot', 'clockwork'], ['lb', 'out', 'hl', 'library'], ['ic', 'out', 'br', 'cistern'], ['ls', 'out', 'pd', undefined]];
// what each boss gives (and what each door asks for): the order in which things can be done.  tools/test-world.mjs proves from this table that every castle can be finished.
export const PROGRESS = {
  gives: { g3: 'djump', h4: 'dash', c3: 'ember', u3: 'thunder', t2: 'dawn', qb: 'tide' },
  doors: { mire: { needs: ['djump'] }, hall: {}, chapel: { bosses: ['h4', 'qb'] }, crypts: { needs: ['ember'] }, orloj: { needs: ['djump'], key: 'key_crypt' }, clockwork: {}, forge: { bosses: ['og'] }, cistern: { needs: ['djump', 'dash'] }, library: { key: 'key_frost' }, throne: { needs: ['thunder'], bosses: ['u3', 'kb'], key: 'key_gold' } },
};
// some neighbouring areas are joined by a DOOR at each end (UP) instead of an open edge: 'a>b' = a's far-right door leads to b's far-left door.  (Only when both are generated rooms: the hand-built classic ones keep their open edges.)
const DOOR_LINK = { 'tp>t2': 'crypt', 'v2>v3': 'wood', 'g1>g2': 'crypt', 'w1>w2': 'wood', 'h1>h2': 'wood', 'c1>c2': 'wood', 'u1>u2': 'wood', 'k1>k2': 'wood', 'q1>q2': 'wood' };          // (consecutive rooms of a chain that are joined by doors instead)
// abilities the player owns when coming BACK through a zone (they've beaten that zone's boss by then)
const BACK = { 10: ['djump', 'dash', 'ember'], 11: ['djump', 'dash', 'ember'], 9: ['djump', 'dash'], 8: ['djump', 'dash', 'ember'], 6: [], 1: ['djump'], 7: ['djump'], 2: ['djump', 'dash'], 3: ['djump', 'dash', 'ember'], 4: ['djump', 'dash', 'ember', 'thunder'], 5: ['djump', 'dash', 'ember', 'thunder', 'dawn'] };
// Everything after Baelphegaz (who gives the double jump) is built for a hero who HAS it - Prague and the Graveyard (zones 6 and 1) are not.  Such a room's baseline abilities include the double jump.
const hasDJ = spec => (spec.abilities || []).includes('djump') || ![6, 1].includes(spec.zone);
const GATE = { barricade: TILE.BARRICADE, crystal: TILE.CRYSTAL, crack: TILE.CRACK, ice: TILE.ICE, lever: TILE.GATE };
// haunted portraits lurk among the pictures in the castle's halls: more in the Portrait Gallery and the Shadow Throne, a chance of one elsewhere indoors
for (const id of ['h1', 'h2', 'h3', 'c1', 'c2', 'c3', 'u1', 'u2', 't1']) if (SPEC[id] && SPEC[id].mix) SPEC[id].mix.portrait = id === 'h2' ? [3, 4] : id === 't1' ? [1, 1] : [0, 1];
const PORTRAIT_PEOPLE = 15;
const BOSS_TYPE = { drowned: 'boss_drowned', vampire: 'boss_vampire', beast: 'boss_beast', nightmare: 'boss_nightmare', angel: 'boss_angel', colossus: 'boss_colossus', shadow: 'boss_shadow', cinder: 'boss_cinder', bramble: 'boss_bramble', mirror: 'boss_mirror', golem: 'boss_golem', librarian: 'boss_librarian', rimewyrm: 'boss_rimewyrm' };
const FLYERS = new Set(['bat', 'ghost', 'wraith', 'fireskull', 'wyrm', 'frostwyrm', 'emberwyrm', 'tome', 'grimoire']);
const FLYING_BOSS = new Set(['angel', 'shadow', 'bramble', 'drowned', 'librarian', 'rimewyrm']);

// ------------------------------------------------------------------------------------------------ shared: populate + decorate
// a signpost's words for a crossroads door, and the extra facts a door can carry (which door it is, where it arrives, what locks it)
const signText = m => (m.label + (m.hint ? ' - ' + m.hint : '')).toUpperCase();
function patchDoor(b, d) { const o = b.def.doors[b.def.doors.length - 1]; if (d.tag) o.tag = d.tag; if (d.destTag) o.destTag = d.destTag; if (d.lock) { o.lock = d.lock; o.lockText = d.hint; } if (d.needs) o.needs = d.needs; if (d.key) o.key = d.key; if (d.gated) { o.gated = true; o.gate = d.gate; } if (d.reqs) o.reqs = d.reqs; if (d.arrive) o.arrive = d.arrive; }
// is there empty room for a framed portrait (about 3 tiles across, 3 high) hanging with its bottom edge on tile row `row`, centred on column x?
const wallRoom = (b, x, row) => { const W = b.w; for (let ty = row - 3; ty < row; ty++) for (let tx = x - 1; tx <= x + 1; tx++) { if (tx < 0 || tx >= W || ty < 0) return false; if (b.def.tiles[ty * W + tx] !== 0) return false; } return true; };
function reachSurfaces(S, seen) { return S.list.filter(sf => seen.has(sf.id)); }

// enemies, candles and decor go ONLY onto surfaces the validator proved reachable
function populate(b, W, H, spec, r, S, seen, g, hasCeiling, pads, avoid = []) {
  const reach = reachSurfaces(S, seen), ground = reach.filter(sf => sf.x1 - sf.x0 >= 2), used = [];
  const farFromPad = x => pads.every(p => Math.abs(x - p) >= 8) && !avoid.some(([a, z]) => x >= a && x <= z), free = (x, gap = 3) => !used.some(u => Math.abs(u - x) < gap);
  const pickGround = (minLen = 3, gap = 3) => { for (let t = 0; t < 60; t++) { const c = ground.filter(sf => sf.x1 - sf.x0 + 1 >= minLen); if (!c.length) return null; const sf = r.pick(c), x = r.i(sf.x0 + 1, Math.max(sf.x0 + 1, sf.x1 - 1)); if (farFromPad(x) && free(x, gap)) { used.push(x); return { sf, x }; } } return null; };
  const rows = { candle: [] };
  for (const [type, [lo, hi]] of Object.entries(spec.mix || {})) {
    const n = r.i(lo, hi);
    for (let i = 0; i < n; i++) {
      if (type === 'portrait') {                                                                           // on a wall, three tiles above the floor, where there is room for the whole frame
        let c = null; for (let tr = 0; tr < 10 && !c; tr++) { const q = pickGround(3, 1); if (q && wallRoom(b, q.x, q.sf.ty - 3)) c = q; } if (!c) continue;          // (a picture on the wall needs no floor space of its own)
        b.e('portrait', c.x, c.sf.ty - 3, { ci: r.i(0, PORTRAIT_PEOPLE - 1), frame: r.i(0, 4) }); continue;
      }
      if (type === 'bat') {
        const c = pickGround(1) || null; if (!c) continue;
        if (hasCeiling) b.e('bat', c.x, 3); else b.e('bat', c.x, Math.max(3, c.sf.ty - r.i(5, 7)));
      } else if (FLYERS.has(type)) { const c = pickGround(1); if (!c) continue; b.e(type, c.x, Math.max(hasCeiling ? 4 : 3, c.sf.ty - r.i(4, 6))); }
      else { const c = pickGround(type === 'hound' ? 6 : 3); if (!c) continue; b.e(type, c.x, c.sf.ty, spec.zone === 11 && type === 'hound' ? { frost: true } : {}); }          // (the Frozen Caverns' hounds are the frost ones)
    }
  }
  for (let i = 0, n = spec.barrels ? Math.round(r.i(spec.barrels[0], spec.barrels[1]) * 0.6) : 0; i < n; i++) { const c = pickGround(2, 2); if (c) b.e('barrel', c.x, c.sf.ty, { drop: r.pick(['coin', 'coin', 'heart', 'mana', 'coin', 'heart']) }); }          // clay pots: one hit, one small treat
  const nCandle = spec.candles ? r.i(spec.candles[0], spec.candles[1]) : 0, drops = ['heart', 'mana', 'coin', 'coin', 'potion', 'heart'];
  for (let i = 0; i < nCandle; i++) { const c = pickGround(3); if (c) b.candle(c.x, c.sf.ty); }                                   // lit candelabras: ambiance only, nothing to break
  const ns = nCandle / 2.5, nStatue = Math.floor(ns) + (r.chance(ns - Math.floor(ns)) ? 1 : 0);                                  // statues: breakable (2-3 hits), rich, and 2.5x rarer
  for (let i = 0; i < nStatue; i++) { const c = pickGround(3); if (c) b.e('statue', c.x, c.sf.ty, { drop: r.pick(drops) }); }
  if (r.chance(0.35)) { const c = pickGround(2); if (c) { const item = r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight])); b.e('itemspawn', c.x, c.sf.ty, { item, qty: ITEMS[item].pack, id: 'ip_' + b.def.id + '_' + c.x }); } }       // a carried item lying on the floor (gone for good once picked up)
  return { used, ground };
}

// statues (the Graveyard pack: 1 hooded mourner, 3 knight, 4 kneeling mourner, 5 gargoyle, 6 robed woman, 7 seated mourner, 8 owl; the angel, 2, stands at the Orloj Tower): which stand in which places, and about one flat column in N gets one.
// They are scenery behind the hero, set from a hash of the column so the random stream (and so every castle) stays as it was.
const STATUES = { graveyard: [['gy_st1', 'gy_st3', 'gy_st4', 'gy_st6', 'gy_st7', 'gy_st8'], 14], hall: [['gy_st3', 'gy_st6', 'gy_st1', 'gy_st7'], 20], chapel: [['gy_st1', 'gy_st4', 'gy_st6', 'gy_st7', 'gy_st8'], 20], throne: [['gy_st3', 'gy_st5', 'gy_st1'], 22], underworks: [['gy_st5', 'gy_st1', 'gy_st4', 'gy_st8'], 24], cistern: [['gy_st5', 'gy_st8'], 40], swamp: [['gy_st4', 'gy_st7'], 40], village: [['gy_st1', 'gy_st6'], 42], bridge: [['gy_st1', 'gy_st3', 'gy_st6', 'gy_st7', 'gy_st4', 'gy_st8'], 8] };
function decorate(b, W, spec, r, g, ceilRows, flatCols) {
  const th = spec.bridge ? 'bridge' : spec.theme || ZONES[spec.zone].theme;
  const stat = STATUES[th]; if (stat) { const set = stat[0], last = []; for (const x of flatCols) if (((x * 83492791 + 17) >>> 0) % stat[1] === 0) {          // (never the same statue as either of the last two in the room)
    let i = (((x * 2654435761) >>> 0) >>> 13) % set.length; for (let t = 0; t < set.length && set.length > 2 && last.includes(i); t++) i = (i + 1) % set.length; if (set.length === 2 && i === last[last.length - 1]) i = 1 - i; last.push(i); if (last.length > 2) last.shift();
    b.d('img', x, g[x], { img: set[i], back: true });
  } }
  if (th === 'bridge') {          // saints along the parapet (above), a lamp now and then, a brazier or two
    for (const x of flatCols) if (((x * 40503 + 29) >>> 0) % 19 === 4) b.d('img', x, g[x], { img: 'town_lamp' });
    for (let i = 0, n = r.i(1, 2); i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d('brazier', x, g[x]); }
    return;
  }
  if (th === 'swamp' || th === 'graveyard') for (const x of flatCols) {          // small foreground flowers, now and then, bigger than life and in front of the hero's feet (a hash of the column: the random stream is untouched)
    if (((x * 40503 + 17) >>> 0) % 37 === 0) b.d('img', x, g[x], { img: ['gy_daisy', 'gy_posy', 'gy_lily'][((x * 7) >>> 0) % 3], fore: true, scale: 1.4, sink: 5 });
    if (th === 'swamp' && ((x * 2654435761) >>> 0) % 23 < 3) b.d('img', x, g[x], { img: ['gy_lily', 'gy_posy', 'gy_daisy'][((x * 2654435761) >>> 0) % 3] });          // and wild ones on the ground
  }
  if (th === 'swamp') {          // Gothicvania Swamp: huge twisted trees behind, ferns and vines on the ground, the odd headstone
    let last = -99; for (let i = 0; i < Math.round(W / 9) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 14) continue; last = x; b.d('img', x, g[x], { img: 'swamp_trees', back: true, sink: 3 }); }
    last = -9; for (let i = 0; i < Math.round(W / 4) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 6) continue; last = x; const im = r.chance(0.6) ? 'swamp_props' : r.pick(['cemetery_stone-1', 'cemetery_stone-3', 'cemetery_bush-small']); b.d('img', x, g[x], { img: im, back: false, sink: im === 'swamp_props' ? 4 : 1 }); }          // (the vine sheet's pictures end 1-4px above the bottom of the image: sunk so they stand IN the ground)
    return;          // (the shallow pools that used to lie on the swamp's floor are gone: they made no sense there)
  }
  if (th === 'clockwork') {       // braziers for light, and the gears turning behind (the steampunk pack's boilers, valves and clocks were taken out: they did not suit the place)
    for (let i = 0, n = r.i(2, 3); i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d('brazier', x, g[x]); }
    for (const x of flatCols) { const h = ((x * 2654435761) >>> 0) % 61; if (h < 2) b.d('animgear', x, g[x] - 5 - (h % 3), { img: ['gear_a', 'gear_b', 'gear_c', 'gear_d', 'gear_e'][((x * 7) >>> 0) % 5], scale: 0.75 + 0.15 * (x % 3), rate: (x % 2 ? 0.45 : -0.45), phase: x, a: 0.3 }); }          // (a few turning accents from the Animated Gears pack, behind everything)
    return;
  }
  if (th === 'village') {         // a street of burning houses (drawn behind the tiles), with lamps, carts, barrels and braziers along it
    const homes = [];                                                                               // houses whose door is a real door (UP) are set first, so the door lines up with the house's own painted one
    for (const d of b.def.doors) if (d.house) { const img = r.pick(Object.keys(HOUSES)), hx = d.x - Math.round(DOORS[img][0] / 16); homes.push(hx); b.house(hx, d.gy, img, r.shuffle(HOUSES[img].map((_, k) => k)).slice(0, r.i(1, 2)), true); }
    for (let i = 0; i < Math.round(W / 14) && flatCols.length; i++) { const x = r.pick(flatCols); if (homes.some(h => Math.abs(h - x) < 15)) continue; homes.push(x); const img = r.pick(Object.keys(HOUSES)); b.house(x, g[x], img, r.shuffle(HOUSES[img].map((_, k) => k)).slice(0, r.i(1, 2))); }
    let last = -9; for (let i = 0; i < Math.round(W / 5) && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 5) continue; last = x; b.d('img', x, g[x], { img: r.pick(['town_lamp', 'town_lamp', 'town_crates', 'town_crates', 'town_cart', 'town_well', 'town_lamp', 'town_cart', 'town_crates']) }); }      // (the shop sign hangs above house doors - see B.house - never on the street)
    for (let i = 0, n = r.i(1, 3); i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d('brazier', x, g[x]); }
    return;
  }
  if (th === 'graveyard') {
    const kinds = [['cemetery_stone-1', 5, false], ['cemetery_stone-2', 5, false], ['cemetery_stone-3', 4, false], ['cemetery_stone-4', 4, false], ['cemetery_bush-small', 4, false], ['cemetery_bush-large', 3, true], ['cemetery_tree-1', 3, true], ['cemetery_tree-2', 3, true], ['cemetery_tree-3', 3, true],
      ['forest_tree_1', 3, true], ['forest_tree_2', 3, true], ['forest_tree_3', 3, true], ['forest_tree_4', 3, true]];       // the four gnarled dead trees are from Haunted Forest Trees (ETTiNGRiNDER, CC0)
    let last = -9; const n = Math.round(W / 6);
    for (let i = 0; i < n && flatCols.length; i++) { const x = r.pick(flatCols); if (Math.abs(x - last) < 4) continue; last = x; const k = r.wpick(kinds.map(k => [k, k[1]])); b.d('img', x, g[x], { img: k[0], back: k[2] }); }
    if (flatCols.length) { const x = r.pick(flatCols.slice(0, Math.max(1, flatCols.length >> 1))); b.d('img', x, g[x], { img: 'cemetery_statue', back: false }); }
    for (const x of flatCols) { const h = ((x * 2654435761) >>> 0) % 23; if (h < 4) b.d('img', x, g[x], { img: ['gy_lily', 'gy_daisy', 'gy_rose', 'gy_posy'][h] }); }          // wild flowers among the graves (from a hash of the column: the random stream is untouched)
    return;
  }
  const xs = []; for (let x = r.i(7, 11); x < W - 5; x += r.i(10, 15)) xs.push(x);
  if (th === 'hall') for (const x of xs) b.d('dgtorch', x, spec.deck ? 11 : 7); else b.torches(xs, spec.deck ? 10 : 6);
  if (spec.deck) { const lo = xs.map(x => x + 5).filter(x => x < W - 4); if (th === 'hall') for (const x of lo) b.d('dgtorch', x, 20); else b.torches(lo, 19); }          // a second row of torches for the lower floor          // the Hall's torches are the Sidescroller's Dungeon ones (the flame is in the sprite)
  const spread = (n, gap, fn) => { const used = []; for (let i = 0; i < n * 4 && used.length < n && flatCols.length; i++) { const x = r.pick(flatCols); if (used.some(u => Math.abs(u - x) < gap)) continue; used.push(x); fn(x); } };
  const banner = th === 'hall' ? '#7a1e2a' : th === 'throne' ? '#6a1020' : th === 'chapel' ? '#5a2a6a' : null;
  if (banner) for (let i = 0; i < Math.round(W / 20); i++) b.d('banner', r.i(8, W - 9), 2, { len: r.i(4, 7), color: banner });
  const place = (t, n) => { for (let i = 0; i < n && flatCols.length; i++) { const x = r.pick(flatCols); b.d(t, x, g[x]); } };
  if (th === 'hall' || th === 'chapel' || th === 'throne') place('cdl', r.i(2, 4));
  if (th === 'chapel' || th === 'throne') place('column', r.i(2, 4));
  if (th === 'underworks') place('brazier', r.i(2, 3)); if (th === 'cistern') place('brazier', r.i(1, 2));
  // set dressing: the Hall is a library of bookcases (drawn in code) between teal Sidescroller's pillars; the Chapel and the Throne keep to their columns, banners and candelabras;
  // the Underworks is crates, urns and barred windows
  if (th === 'hall' || th === 'chapel' || th === 'throne' || th === 'underworks') spread(b.def.id === 'h2' ? r.i(3, 4) : r.i(1, 3), b.def.id === 'h2' ? 11 : 15, x => { if (wallRoom(b, x, g[x] - 3)) b.d('portrait', x, g[x] - 3, { ci: r.i(0, PORTRAIT_PEOPLE - 1), emo: r.pick([0, 0, 1, 1, 4, 2, 3]), frame: r.i(0, 4) }); });          // framed portraits on the walls (some are not just pictures: see portraits.js)
  if (th === 'hall') {
    spread(r.i(1, 2), 16, x => b.d('bookcase', x, g[x], { back: true })); spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_pillar_' + r.i(1, 4), back: true }));
    spread(r.i(1, 2), 12, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(1, 12, x => b.d('hang', x, 2, { img: 'dg_banner_' + r.i(1, 6) }));
  } else if (th === 'throne') spread(1, 12, x => b.d('hang', x, 2, { img: 'dg_banner_' + r.pick([1, 4]) }));
  else if (th === 'cistern') {
    spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_pillar_' + r.i(1, 4), back: true })); spread(r.i(1, 2), 12, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(1, 14, x => b.d('img', x, g[x], { img: 'dg_crates' }));
  } else if (th === 'library') {
    spread(r.i(2, 3), 12, x => b.d('bookcase', x, g[x], { back: true })); spread(r.i(1, 2), 16, x => b.d('img', x, g[x], { img: 'dg_pillar_' + r.i(1, 4), back: true })); place('cdl', r.i(2, 3));
    spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(1, 14, x => b.d('hang', x, 2, { img: 'dg_banner_' + r.pick([2, 3, 5]) }));
  } else if (th === 'ice') {
    spread(r.i(3, 5), 8, x => b.d('icicles', x, 2, { n: r.i(2, 3) })); spread(r.i(2, 3), 14, x => b.d('crystals', x, g[x], { n: r.i(2, 4) }));
    if (ceilRows) {          // a few LOOSE icicles over the path (a drop of at least four tiles): they shiver when you come close, then fall (see icicles.js)
      const traps = []; spread(r.i(3, 5), 15, x => { if (x >= 9 && x <= W - 9 && g[x] - ceilRows >= 5 && b.def.tiles[(ceilRows - 1) * W + x] !== 0 && Array.from({ length: g[x] - ceilRows }, (_, k) => b.def.tiles[(ceilRows + k) * W + x]).every(v => v === 0)) traps.push({ x: x * 16 + 8, y: ceilRows * 16, len: r.i(18, 26), w: r.i(6, 8) }); });
      if (traps.length) b.def.icicleTraps = traps;
    }
  } else if (th === 'underworks') {
    spread(r.i(1, 2), 14, x => b.d('img', x, g[x], { img: 'dg_crates' })); spread(1, 14, x => b.d('img', x, g[x], { img: 'dg_urn_' + r.i(1, 3) })); spread(r.i(1, 2), 16, x => b.d('barwin', x, 8, { back: true }));
  }
}

// ------------------------------------------------------------------------------------------------ MOVING PLATFORMS (see movers.js)
// The validator cannot follow platforms that move, so a room that has them is shown FROZEN SNAPSHOTS: every platform at one end of its track, at the other, and alternating both ways.  Together those
// cover every pair of neighbouring platforms at its extremes (the widest gap, the biggest climb), so the room is only accepted if it can be crossed in all of them - whenever you jump, the platforms are
// somewhere between those extremes, never worse.  (Platforms are numbered along the route: neighbours always differ in parity.)
const MOVER_STYLE = { 8: 'brass', 7: 'wood', 9: 'teal', 10: 'wood', 11: 'teal' };          // (every other zone: stone)
const moverStyle = spec => MOVER_STYLE[spec.zone] || 'stone';
const moverCombos = (n, mid) => { const cs = [Array(n).fill(0), Array(n).fill(1), Array.from({ length: n }, (_, i) => i % 2), Array.from({ length: n }, (_, i) => 1 - (i % 2))]; if (mid) cs.push(Array(n).fill(0.5)); const seen = new Set(); return cs.filter(c => { const k = c.join(); if (seen.has(k)) return false; seen.add(k); return true; }); };
// the tiles a platform covers when it is `s` of the way along its track (a position between two rows counts as the lower row: the worse case for a jump up)
function moverTiles(d, s, W, H) {
  const [px, py] = moverAt(d, s), ty = Math.ceil(py / 16 - 0.01), out = [];
  for (let tx = Math.floor((px - d.w / 2) / 16); tx <= Math.floor((px + d.w / 2 - 1) / 16); tx++) if (ty > 2 && ty < H - 1 && tx >= 0 && tx < W) out.push(ty * W + tx);
  return out;
}
// validateRoom for a room with moving platforms.  Returns what validateRoom does (ok, errs, S, seen) except that `seen` leaves out the platforms' own surfaces (nothing is ever placed on a slab).
function validateMoving(def, movers, mid = false) {
  if (!movers.length) return validateRoom(def);
  let first = null, mask = [];
  for (const [ci, combo] of moverCombos(movers.length, mid).entries()) {
    const vdef = { ...def, tiles: Uint8Array.from(def.tiles) }, cover = [];
    movers.forEach((d, i) => { for (const k of moverTiles(d, combo[i], def.w, def.h)) if (vdef.tiles[k] === 0) { vdef.tiles[k] = TILE.PLAT; cover.push(k); } });
    const v = validateRoom(vdef); if (!v.ok) return { ok: false, errs: v.errs.slice(0, 3).map(e => 'moving platforms ' + combo.join('') + ': ' + e) };
    if (ci === 0) { first = v; mask = cover; }
  }
  const slab = new Set(mask.map(k => first.S.id[k]).filter(i => i >= 0));
  return { ok: true, errs: [], S: first.S, seen: new Set([...first.seen].filter(i => !slab.has(i))) };
}

// A corridor with ferries is validated in two parts, which keeps it fast (a whole corridor takes a while to prove, and the platforms would multiply that): the whole room once, with every ferry's pit
// filled in (so that everything except the crossings is proved, including how the pit's two sides connect to the rest), and then each ferry on its own in a tiny room - just its pit and a few tiles of floor
// either side - in the snapshots above, in BOTH directions.
function validateFerries(def, ferries, movers, abil) {
  if (!ferries.length) return validateRoom(def);
  const W = def.w, H = def.h, fdef = { ...def, tiles: Uint8Array.from(def.tiles) };
  for (const f of ferries) for (let cx = f.x0; cx < f.x0 + f.P; cx++) for (let ty = f.gy; ty < H; ty++) fdef.tiles[ty * W + cx] = TILE.SOLID;
  const v = validateRoom(fdef); if (!v.ok) return v;
  let mi = 0;
  for (const f of ferries) {
    const ms = movers.slice(mi, mi += f.n), L = 3, tw = L + f.P + L, tiles = new Uint8Array(tw * H), ox = (f.x0 - L) * 16;
    for (let tx = 0; tx < tw; tx++) {
      for (let ty = 0; ty < 3; ty++) tiles[ty * tw + tx] = def.tiles[ty * W + Math.max(0, f.x0 - 1)];                         // (the ceiling, if the room has one)
      if (tx >= L && tx < L + f.P) tiles[(H - 1) * tw + tx] = TILE.SPIKE; else for (let ty = f.gy; ty < H; ty++) tiles[ty * tw + tx] = TILE.SOLID;
    }
    const shifted = ms.map(d => ({ ...d, x0: d.x0 - ox, x1: d.x1 - ox }));
    for (const combo of moverCombos(ms.length)) {
      const t2 = Uint8Array.from(tiles); shifted.forEach((d, i) => { for (const k of moverTiles(d, combo[i], tw, H)) if (t2[k] === 0) t2[k] = TILE.PLAT; });
      const room = roomOf({ ...def, w: tw, tiles: t2 }), S = surfaces(room), a = S.id[f.gy * tw + 1], z = S.id[f.gy * tw + tw - 2];
      if (a < 0 || z < 0 || !reach(room, S, [a], abil).has(z) || !reach(room, S, [z], abil).has(a)) return { ok: false, errs: ['ferry at ' + f.x0 + ' cannot be crossed (platforms ' + combo.join('') + ')'] };
    }
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ SECRETS
// A few corridors hide a SECRET: an alcove behind a cracked wall (cut it open with the sword).  What is inside is a HOARD (a chest of 400 gold).  (Six of them used to hold one of the Lady's one-line letters - a flavour pickup
// from before the story pages, which unlocked nothing and was not part of the Letters book; they hold hoards now: the story is told by the six pages.)  The Astrolabe does not mark them, and the end of the game counts how many were found (see secrets.js).
export const SECRETS = { g2: 'hoard', g4: 'hoard', w2: 'hoard', w3: 'hoard', h2: 'hoard', c2: 'hoard', u1: 'hoard', q3: 'hoard', k1: 'hoard', l1: 'hoard', l3: 'hoard', i1: 'hoard', t1: 'hoard' };
// ------------------------------------------------------------------------------------------------ CORRIDOR
function genCorridor(id, spec, r) {
  // DECK: a tall room with TWO floors - a staircase of one-way platforms climbs to an upper floor over the middle of the room (its standing row is DK) and another staircase comes down at the far end
  const DASH = (spec.abilities || []).includes('dash');          // (a room entered with the DASH as well: wider pits, longer bridges - the dash and the double jump together carry much further)
  const DJ = hasDJ(spec);                          // (a room entered with the double jump in hand is built for it: wider gaps, taller steps, higher ledges)
  const outdoor = !!spec.outdoor, DECK = !!spec.deck, DY = DECK ? 12 : (spec.tall || 0), H0 = 14 + DY + (spec.under || 0), VR = spec.vault || 0, H = H0 + VR, BASE = 12 + DY, DK = 13, PAD = 6, ceil = outdoor ? 0 : 2, gyMin = (outdoor ? 8 : 9) + DY;
  const LEVERS = spec.levers && !outdoor && !DECK && ceil > 0 ? spec.levers : 0, leverMods = []; for (let k = 0; k < LEVERS; k++) leverMods.push({ t: 'lever', k }, { t: 'portcullis', k });          // (LEVERS: pairs of a floor lever and a portcullis that spans the room from floor to ceiling: only in rooms with a ceiling and no upper floor to climb round by)
  const mods = [...(spec.mods || []), ...leverMods, ...(spec.leverCell ? [{ t: 'cell', gate: 'lever', k: 'cL', chest: true, kind: 'hoard', secret: true, id: 'lc_' + id }, { t: 'lever', k: 'cL' }] : []), ...(spec.candleCell ? [{ t: 'cell', gate: 'lever', k: 'cP', page: spec.candleCell, secret: true, id: 'page' + spec.candleCell }, { t: 'candles', k: 'cP' }] : []), ...(SECRETS[id] ? [{ t: 'cell', gate: 'crack', secret: true, chest: SECRETS[id] === 'hoard', kind: SECRETS[id], id: 'sx_' + id }] : [])].map(m => ({ ...m })), flatMods = mods.filter(m => ['door', 'djLedge', 'cell', 'gap', 'djDoor', 'cellDoor', 'vaultDoor', 'gapDoor', 'iceWall', 'lever', 'portcullis', 'candles'].includes(m.t)), tablets = mods.filter(m => m.t === 'tablet'), deckDoors = mods.filter(m => m.t === 'deckDoor'), skulls = mods.filter(m => m.t === 'skull');
  const target = r.i(spec.w[0], spec.w[1]);
  const g = [], plats = [], ledges = [], doors = [], items = [], cells = [], climbs = [], signs = [], ferries = [], iceWalls = [], trenches = [], vaults = [], levers = [], gates = [], puzzles = []; let x = 0, gy = BASE, gapStart = -1, gapEnd = -1;
  const col = v => { g[x++] = v; };
  const flat = n => { for (let i = 0; i < n; i++) col(gy); };
  const canStep = (up, h) => { const ng = gy + (up ? -h : h); return ng >= gyMin && ng <= BASE; };
  const step = (up, h) => { gy += up ? -h : h; };
  const toBase = () => { while (gy < BASE) { step(false, Math.min(2, BASE - gy)); flat(r.i(2, 3)); } };

  const SEG = {
    flat: () => flat(r.i(2, 5)),
    step: () => { const up = gy >= BASE ? true : r.chance(0.5), h = r.i(1, DJ ? 3 : 2); if (canStep(up, h)) { step(up, h); flat(r.i(2, 4)); } else flat(3); },
    pit: () => { flat(2); const w = DASH ? r.i(4, 6) : DJ ? r.i(3, 5) : r.i(2, 3); for (let i = 0; i < w; i++) col(-1); flat(r.i(3, 4)); },
    bridge: () => { flat(2); const len = DASH ? r.i(10, 15) : DJ ? r.i(9, 14) : r.i(6, 10), x0 = x; for (let i = 0; i < len; i++) col(-1); const n = Math.ceil(len / (DASH ? 6 : DJ ? 5 : 4)); for (let k = 0; k < n; k++) { const c = Math.round(x0 + (k + 1) * len / (n + 1)), pl = r.i(2, 3); plats.push([c - Math.floor(pl / 2), pl, gy - r.i(0, DJ ? 2 : 1)]); } flat(r.i(3, 4)); },
    block: () => { const h = DJ ? r.i(2, 3) : r.i(1, 2); if (!canStep(true, h)) return flat(3); flat(2); step(true, h); flat(r.i(2, 4)); step(false, h); flat(r.i(2, 3)); },
    stairs: () => { const n = r.i(2, 3), up = gy > gyMin + n && r.chance(0.6); for (let i = 0; i < n; i++) { if (!canStep(up, 1)) break; step(up, 1); flat(2); } flat(1); },
    loot: () => { const len = r.i(3, 5); flat(1); plats.push([x + 1, len, gy - (DJ ? r.i(3, 5) : 3)]); flat(len + 2); },
    // a CHASM: a wide bottomless pit crossed by small one-way platforms at changing heights (stepping stones - no two more than two rows apart, no gap wider than three)
    chasm: () => {
      flat(2); const n = r.i(3, 4), x0 = x, ps = []; let off = r.i(1, 2), row = gy - r.i(0, 1);
      for (let k = 0; k < n; k++) { const len = r.i(2, 3); if (k) row = Math.max(gy - (DJ ? 4 : 3), Math.min(gy, row + r.pick(DJ ? [-3, -2, -1, 1, 2, 3] : [-2, -1, 1, 2]))); ps.push([off, len, row]); off += len + (DJ ? r.i(3, 5) : r.i(2, 3)); }
      ps[ps.length - 1][2] = Math.max(ps[ps.length - 1][2], gy - (DJ ? 3 : 2)); const width = off - 1 + r.i(0, 1);
      for (let i = 0; i < width; i++) col(-1); for (const [o, len, rw] of ps) plats.push([x0 + o, len, rw]); flat(r.i(3, 4));
    },
    // a FERRY: a wide pit (spikes below) crossed on one to three moving slabs - sideways shuttles and lifts, alternating.  (Zone 6, Prague, has none; the Clockwork Dungeon has the most.)
    ferry: () => {
      const n = spec.zone === 8 ? r.i(2, 3) : r.i(1, 2), SWt = 4, gapRest = DJ ? 3 : 2, P = n * SWt + (n + 1) * gapRest + r.i(0, 1);
      flat(2); const x0 = x; for (let i = 0; i < P; i++) col(-1);
      ferries.push({ x0, P, n, gy, vert1: r.chance(0.5) }); flat(r.i(3, 4));
    },
    // a WALL (open air only): four rows high - too tall to jump - with a one-way platform halfway up each face, so you go up in two hops, cross the top and drop down the far side
    wall: () => {
      if (!outdoor || gy !== BASE || !canStep(true, 4)) return SEG.block();
      flat(2); plats.push([x, 3, gy - 2]); flat(3); step(true, 4); flat(2); step(false, 4); plats.push([x, 3, gy - 2]); flat(3 + r.i(0, 1));          // (a platform on each face: the wall can be crossed both ways)
    },
  };
  const CITY = spec.zone === 6 && !spec.bridge;          // Prague is a city where people live: streets of steps and blocks, never pits, spikes or platforms over them
  const FERRY = spec.zone === 6 || spec.bridge ? 0 : spec.zone === 8 ? 26 : 7, MIN_FERRIES = spec.zone === 8 ? 2 : 0;          // (how often a moving-platform crossing turns up: never in Prague or on Karluv Bridge, now and then elsewhere, all the time in the Clockwork Dungeon)
  const WEIGHTS = [['flat', 19], ['step', 16], ['pit', 15], ['bridge', 8], ['block', 11], ['stairs', 9], ['loot', 8], ['chasm', 9], ['wall', 7], ['ferry', FERRY]].filter(([k, w]) => w > 0 && (!CITY || !['pit', 'bridge', 'chasm'].includes(k)) && (!spec.calm || ['flat', 'step', 'block'].includes(k)));          // (a calm place - the gates and crossroads - has only level ground, a step or a low block: no pits, no walls, no ferries)      // spikes live ONLY at the bottom of pits and gaps (never on open ground, where scenery can hide them)
  const MOD = {
    door: m => { toBase(); flat(2); const w = r.i(5, 7), x0 = x; flat(w); doors.push({ x: x0 + (w >> 1), gy, to: m.to, kind: m.kind || 'wood', tag: m.tag, destTag: m.destTag, lock: m.lock, hint: m.hint, key: m.key }); if (m.label) signs.push({ x: x0 - 1, text: signText(m), key: m.tag || m.to }); flat(2); },
    // a door on a high ledge: only the double jump gets you up to it
    djDoor: m => { toBase(); flat(2); const padX = x; flat(3); plats.push([padX, 3, gy - 3]); const lx = x, row = gy - 3 - (outdoor ? 5 : 4), LW = m.wide ? 10 : 6; ledges.push([lx, LW, row]); flat(LW + 2); doors.push({ x: lx + (LW >> 1), gy: row, to: m.to, kind: m.kind || 'crypt', tag: m.tag, destTag: m.destTag, lock: m.lock, hint: m.hint, needs: 'djump', key: m.key }); if (m.label) signs.push({ x: padX - 1, text: signText(m), key: m.tag || m.to }); },
    // a door inside a sealed cell: burn the barricade (or shatter the crystal) to reach it
    cellDoor: m => { toBase(); flat(2); const xs = x + 4, x0 = x; flat(14); cells.push({ ...m, xs, gy, door: true }); if (m.label) signs.push({ x: x0 - 1, text: signText(m), key: m.tag || m.to }); },          // (the sign stands before the cell's steps, which fill the first four columns)
    // a door beyond the dash gulf
    gapDoor: m => { toBase(); flat(6); gapStart = x; const G = r.i(spec.gapW?.[0] ?? 9, spec.gapW?.[1] ?? 9); for (let i = 0; i < G; i++) col(-1); gapEnd = x - 1; flat(6); doors.push({ x: x - 3, gy, to: m.to, kind: m.kind || 'crypt', tag: m.tag, destTag: m.destTag, lock: m.lock, hint: m.hint, needs: 'dash' }); if (m.label) signs.push({ x: gapStart - 3, text: signText(m), key: m.tag || m.to }); },
    djLedge: m => { toBase(); flat(2); const padX = x; flat(3); plats.push([padX, 3, gy - 3]); const lx = x, row = gy - 3 - (outdoor ? 5 : 4); ledges.push([lx, 6, row]); flat(8); items.push({ ...m, tx: lx + 3, gy: row, needs: 'djump' }); },
    cell: m => { toBase(); flat(2); const xs = x + 4; flat(14); cells.push({ ...m, xs, gy }); },
    // THE DOOR UNDER KARLUV BRIDGE: a stretch of the deck is wooden planks (one-way: you drop through them with DOWN + JUMP).  Under them is open air and then the river - the same river, at the same level, as under the rest of the bridge.
    // Whoever drops has to break the fall with a DOUBLE JUMP and carry on sideways with a DASH, under the stone deck, to a ledge in the next arch: a toll-house pier with a cell of ICE in it (only fire melts it) and the door to the Frozen
    // Caverns behind that.  Without both, the fall ends in the river (and the spikes under it: back to the bridge).  There is no way back up from the ledge, and none is needed: a waystone stands inside the door.  See the carving below.
    vaultDoor: m => { toBase(); flat(2); const e0 = x; flat(40); vaults.push({ e0, m }); cells.push({ ...m, xs: e0 + 7, gy: BASE + 10, door: true, vault: true, arriveAt: BASE }); },
    // a LEVER on the floor, and (further along) the PORTCULLIS it raises: two columns of iron bars from the ceiling to the floor, right across the way
    lever: m => { toBase(); flat(3); levers.push({ x, gy, k: m.k }); flat(4); },
    portcullis: m => { toBase(); flat(3); gates.push({ x, gy, k: m.k }); flat(2); flat(3); },
    candles: m => { toBase(); flat(2); const x0 = x; flat(14); puzzles.push({ k: m.k, x0, gy }); },          // (three candles and a tablet that says in what order to light them)
    // a WALL OF ICE: two blocks thick and seven high (taller than a double jump reaches) right across the way: only fire melts it
    iceWall: () => { toBase(); flat(3); iceWalls.push({ x, gy }); flat(2); flat(3); },
    climb: side => { toBase(); const x0 = x; flat(14); climbs.push({ x0, side }); },                                  // 14 flat columns: the foot of a staircase up to the upper floor
    gap: () => { toBase(); flat(6); gapStart = x; const G = r.i(spec.gapW?.[0] ?? 9, spec.gapW?.[1] ?? 9); for (let i = 0; i < G; i++) col(-1); gapEnd = x - 1; flat(6); },
  };
  const leverFirst = list => { for (let k = 0; k < LEVERS; k++) { const li = list.findIndex(m => m.t === 'lever' && m.k === k), pi = list.findIndex(m => m.t === 'portcullis' && m.k === k); if (li > pi) [list[li], list[pi]] = [list[pi], list[li]]; } return list; };          // (a lever always comes before the gate it works)
  flat(PAD); if (DECK) MOD.climb('L');
  const tEnd = target - (DECK ? 15 : 0), order = leverFirst(r.shuffle(flatMods)), need = { door: 9, djLedge: 15, cell: 18, gap: 22, djDoor: 15, cellDoor: 18, gapDoor: 22, vaultDoor: 46, iceWall: 11, lever: 9, portcullis: 11, candles: 17 }, reserved = order.reduce((s, m) => s + need[m.t], 0);
  const slotW = Math.max(6, (tEnd - PAD * 2 - reserved) / (order.length + 1));
  for (let s = 0; s <= order.length; s++) {
    const left = order.slice(s).reduce((t, m) => t + need[m.t], 0), until = Math.min(x + Math.max(5, Math.round(slotW * (0.7 + 0.6 * r.f()))), Math.max(x + 5, tEnd - PAD - left));
    while (x < until) SEG[r.wpick(WEIGHTS)]();
    if (s < order.length) MOD[order[s].t](order[s]);
  }
  while (x < tEnd - PAD) SEG[r.wpick(WEIGHTS)]();
  if (DECK) MOD.climb('R'); toBase(); flat(PAD);
  if (ferries.length < MIN_FERRIES) return { ok: false, errs: ['too few moving-platform crossings'] };

  const W = x, b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, ...(DECK || spec.tall || spec.under ? { horizon: BASE } : {}) });
  for (let cx = 0; cx < W; cx++) { if (g[cx] >= 0) b.rect(cx, g[cx], 1, H - g[cx]); else { b.put(cx, H0 - 1, TILE.SPIKE); if (VR) b.rect(cx, H0, 1, VR); } }
  const iceTiles = []; for (const w of iceWalls) for (let dx = 0; dx < 2; dx++) for (let k = 1; k <= 7; k++) { b.put(w.x + dx, w.gy - k, TILE.ICE); iceTiles.push([w.x + dx, w.gy - k]); }
  const movers = [], style = moverStyle(spec);                                                       // the moving slabs of each ferry, evenly spaced along its pit: sideways shuttles and lifts alternating
  for (const f of ferries) {
    const SWt = 4, gapR = (f.P - f.n * SWt) / (f.n + 1), y0 = f.gy * 16;
    for (let k = 0; k < f.n; k++) {
      const c = Math.round((f.x0 + gapR + SWt / 2 + k * (SWt + gapR)) * 16), ph = r.f(), vert = f.n === 1 ? f.vert1 : k % 2 === 1;
      const o = vert ? { x0: c, y0, x1: c, y1: Math.round((f.gy - 2.5) * 16), w: SWt * 16, period: 230 + r.i(0, 40), ph, style } : { x0: c - 16, y0, x1: c + 16, y1: y0, w: SWt * 16, period: 260 + r.i(0, 40), ph, style }, roll = r.f();
      if (!vert && spec.zone === 8 && roll > 0.7) o.vent = true;                                                  // (a steam-vent slab: only in the Clockwork Dungeon, only on the sideways ones)
      else if (f.n >= 2 && k >= 1 && roll < (spec.zone === 8 ? 0.3 : 0.22)) o.crumble = true;                      // (a crumbling slab: never the first of a ferry, and never the only one)
      movers.push(o);
    }
  }
  if (movers.length) b.def.movers = movers;
  if (spec.bridge) {                                                                                // the bridge: a deck three stones thick on round-headed arches and piers, with the river running under it
    const E = TILE.EMPTY; let cx = 4;
    while (cx < W) {
      const a0 = cx + 3, a1 = Math.min(W - 1, a0 + r.i(6, 8));                                      // [a0, a1] is an arch; the pier before it is three columns wide
      for (let c = a0; c <= a1; c++) { if (g[c] < 0) continue; const top = g[c] + 3 + (c === a0 || c === a1 ? 1 : 0); b.rect(c, top, 1, H0 - top, E); }          // (the arch's shoulders are one stone lower than its crown)
      cx = a1 + 1;
    }
    for (const v of vaults) {          // the toll-house pier (solid stone from the deck's underside down, with the cell in it: see the cells below), the ledge in front of the cell's door, the open arch beside it, and the planks in the deck
      const e0 = v.e0, LY = BASE + 10, P0 = e0 + 3, P1 = e0 + 13, L0 = P1 + 1, LW = 6, T0 = L0 + LW + 7, PWd = 4, B1 = T0 + PWd + 3, under = H0 - (BASE + 3);
      b.rect(P0, BASE + 3, P1 - P0 + 1, under, TILE.SOLID);                                              // the pier
      b.rect(L0, BASE + 3, B1 - L0 + 1, under, TILE.EMPTY); b.rect(B1 + 1, BASE + 3, 3, under, TILE.SOLID);          // the open arch (down to the bottom of the room) and the pier that ends it
      b.rect(L0, H0 - 1, B1 - L0 + 1, 1, TILE.SPIKE);                                                    // spikes at the bottom of the river: whoever misses the ledge lands on them and goes back to the bridge, as in any pit
      b.rect(L0, LY, LW, 1, TILE.SOLID);                                                                 // the ledge in front of the ice
      b.rect(T0, BASE + 1, PWd, 2, TILE.EMPTY); b.rect(T0, BASE, PWd, 1, TILE.PLAT);                    // the planks: the stone of the deck is gone under them, and they give way to DOWN + JUMP
      b.d('brazier', L0 + LW - 2, LY);                                                                   // (a fire on the ledge: it shows from far above)
    }
    b.def.rivers = [{ x0: 0, x1: W * 16, y: (H0 - 7) * 16 + 8, vx: 1.0 }];          // the river runs under the whole bridge, at one level
  }
  if (!outdoor) b.ceil(0, W, ceil);
  const leverDefs = levers.filter(lv => gates.some(q => q.k === lv.k)).map(lv => { const gt = gates.find(q => q.k === lv.k), gate = []; for (const dx of [0, 1]) for (let ty = ceil; ty < gt.gy; ty++) { b.put(gt.x + dx, ty, TILE.GATE); gate.push([gt.x + dx, ty]); } return { id: 'lv_' + id + '_' + lv.k, x: lv.x, gy: lv.gy, gate, gx: gt.x }; });
  for (const [px, len, row] of plats) b.plat(px, len, row);
  for (const [lx, len, row] of ledges) b.ledge(lx, len, row);
  if (DECK) {                                                                                      // the upper floor, with the odd hole, raised block and floating platform
    const L = climbs.find(c => c.side === 'L'), R = climbs.find(c => c.side === 'R'), da = L.x0 + 14, db = R.x0 - 1, len = db - da + 1;
    if (len < 14) return { ok: false, errs: ['upper floor too short'] };
    for (let k = 0; k < 3; k++) { b.plat(L.x0 + 1 + k * 4, 4, BASE - 3 - 3 * k); b.plat(R.x0 + 9 - k * 4, 4, BASE - 3 - 3 * k); }          // a staircase of one-way platforms up each end
    b.rect(da, DK, len, 2);
    // (the swamp's upper floor is rolling country, not a plank: more features, and hills and dips as well as holes, blocks and floating platforms)
    const rolling = (spec.theme || ZONES[spec.zone].theme) === 'swamp', feats = rolling ? Array.from({ length: Math.max(6, Math.round(len / 9)) }, () => r.wpick([['hole', 3], ['hill', 4], ['dip', 3], ['block', 1], ['plat', 1]])) : r.shuffle(['hole', 'block', 'hole', 'block', 'plat']).slice(0, r.i(2, 4)), nf = Math.min(feats.length, Math.floor((len - 10) / (rolling ? 6.5 : 8))), keepOut = ferries.map(f => [f.x0 - 3, f.x0 + f.P + 3]), holes = [];          // (nothing on the upper floor above a ferry: a fall from it would land in the spikes)
    // A DIVIDER: a wall that runs from above the upper floor right down through it, leaving only a low tunnel along the lower floor.  OVER it by a platform halfway up, or UNDER it: drop through a hole, walk the tunnel, and climb back
    // through a second hole on a staircase of one-way platforms.  (It needs a flat, clear stretch of the lower floor, and no door on it.)
    if (len >= 46 && r.chance(0.65)) {
      const okc = c0 => { for (let c = c0 - 10; c <= c0 + 9; c++) { if (gapStart >= 0 && c >= gapStart - 4 && c <= gapEnd + 4) return false; if (ferries.some(f => c >= f.x0 - 3 && c <= f.x0 + f.P + 3)) return false; if (doors.some(d => !d.deck && Math.abs(d.x - c) < 3)) return false; if (climbs.some(q => c >= q.x0 - 2 && c <= q.x0 + 15)) return false; if (cells.some(q => c >= q.xs - 6 && c <= q.xs + 9)) return false; if (ledges.some(([lx, ln]) => c >= lx - 7 && c <= lx + ln)) return false; if (items.some(it => Math.abs(it.tx - c) < 8)) return false; } return true; };
      const cand = []; for (let c0 = da + 12; c0 <= db - 12; c0++) if (okc(c0)) cand.push(c0);
      if (cand.length) {
        const cx = r.pick(cand), wallTop = DK - 4, wallBot = BASE - 4;
        for (let c = cx - 10; c <= cx + 9; c++) { b.rect(c, DK + 2, 1, BASE - DK - 2, TILE.EMPTY); b.rect(c, BASE, 1, H - BASE); g[c] = BASE; }          // (the lower floor is levelled here: flat, no pit, no spikes)
        b.rect(cx, wallTop, 2, wallBot - wallTop + 1);                                              // the wall (through the slab, down to the tunnel's roof)
        b.rect(cx - 6, DK, 3, 2, TILE.EMPTY);                                                       // hole A: drop through to the lower floor
        b.plat(cx - 2, 2, DK - 2);                                                                  // the way OVER: a platform against the wall's near face...
        b.rect(cx + 5, DK, 3, 2, TILE.EMPTY);                                                       // hole B: climb back up
        b.plat(cx + 2, 3, BASE - 3); b.plat(cx + 3, 3, BASE - 6); b.plat(cx + 5, 3, BASE - 9);    // ...and the staircase beneath hole B (the top step is level with the slab's underside)
        keepOut.push([cx - 10, cx + 10]); b.def.divider = cx; b.def.dividerRows = [wallTop, wallBot];          // (where the wall stands: Room.prerender draws it with the theme's own wall tiles, if the theme has any)
      }
    }
    for (let k = 0; k < nf; k++) {
      const cx = da + 5 + Math.round((len - 10) * (k + 0.5) / nf), f = feats[k];
      if (keepOut.some(([a, z]) => cx >= a - 4 && cx <= z + 2)) continue;          // (clear of the divider)
      if (f === 'hole') { const w = rolling ? r.i(2, 4) : r.i(2, 3); b.rect(cx, DK, w, 2, TILE.EMPTY); keepOut.push([cx - 2, cx + w + 1]); holes.push([cx, w]); }                   // a gap to jump (fall and you land on the lower floor)
      else if (f === 'block') { const w = r.i(3, 4), h = r.i(1, 2); b.rect(cx, DK - h, w, h); keepOut.push([cx - 2, cx + w + 1]); }
      else if (f === 'hill') { const w0 = r.i(5, 9), n = w0 >= 7 ? 3 : 2; for (let i = 0; i < n; i++) b.rect(cx + i, DK - 1 - i, w0 - 2 * i, 1); keepOut.push([cx - 2, cx + w0 + 1]); }          // a mound: each layer one tile narrower each side and one row higher, so it climbs as a flight of steps and comes down as one
      else if (f === 'dip') { const w = r.i(4, 6); b.rect(cx, DK, w, 1, TILE.EMPTY); keepOut.push([cx - 2, cx + w + 1]); }          // a hollow one row deep in the slab (the slab is two rows thick: the hollow floor is its lower row)
      else { b.plat(cx, 4, DK - 3); keepOut.push([cx - 1, cx + 5]); }
    }
    if ((spec.theme || ZONES[spec.zone].theme) === 'swamp') {                                          // a tall mire room has WATERFALLS: through every hole in the upper floor, from the sky to the lower floor, and a couple of cascades that seep through the slab
      const low = c => (g[c] >= 0 ? g[c] : BASE), taken = [];
      for (const [hx, hw] of holes) { b.d('waterfall', hx + hw / 2 - 0.5, low(hx + (hw >> 1)), { top: -80, w: hw * 16 - 10 }); taken.push(hx + hw / 2); }
      const cand = []; for (let c = da + 6; c <= db - 6; c++) if (!keepOut.some(([a, z]) => c >= a && c <= z) && g[c - 1] >= 17 && g[c] >= 17 && g[c + 1] >= 17) cand.push(c);
      for (let i = 0, want = holes.length >= 2 ? 1 : 2; i < want; i++) {
        const ok = r.shuffle(cand.filter(c => taken.every(q => Math.abs(q - c) >= 14))); if (!ok.length) break; const c = ok[0]; taken.push(c);
        b.d('waterfall', c, DK, { top: -80, w: 22 }); b.d('waterfall', c, g[c], { top: (DK + 2) * 16, w: 16 });          // (it falls on to the upper floor, and comes out again under it)
      }
    }
    for (const m of deckDoors) {                                                                   // a door on the upper floor leads to a small room of its own (and two of them stand well apart)
      const cand = []; for (let cx = da + 4; cx <= db - 4; cx++) if (!keepOut.some(([a, z]) => cx >= a && cx <= z) && doors.every(d => !d.deck || Math.abs(d.x - cx) >= 13)) cand.push(cx);
      if (!cand.length) return { ok: false, errs: ['no place for the upper door'] };
      const mid = cand.filter(cx => cx > da + len * 0.25 && cx < da + len * 0.75); doors.push({ x: r.pick(mid.length ? mid : cand), gy: DK, to: m.to, kind: m.kind || 'wood', deck: true });
    }
  } else if (deckDoors.length) return { ok: false, errs: ['an upper door needs an upper floor'] };
  if (spec.doorL) doors.push({ x: 4, gy: BASE, to: spec.doorL.to, kind: spec.doorL.kind, tag: spec.doorL.tag, destTag: spec.doorL.destTag }); if (spec.doorR) doors.push({ x: W - 5, gy: BASE, to: spec.doorR.to, kind: spec.doorR.kind, tag: spec.doorR.tag, destTag: spec.doorR.destTag });       // doors between areas
  const meta = { abilities: [...new Set([...(spec.abilities || []), ...(DJ ? ['djump'] : [])])], back: spec.bridge ? ['djump'] : BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [], items: [], start: { tx: 4, gy: BASE } };
  if (spec.closedLeft) { meta.entry.L = null; b.d('gate', 0, BASE); }
  for (const d of doors) {
    if (d.tag === 'hall' || d.tag === 'chapel') b.d('keepgate', d.x, BASE, {});          // the gate of Arx Noctis: the doors from the crossroads into the keep stand in it (see keepgate.js)
    if (d.tag === 'orloj') b.d('orlojtower', d.x, BASE, {});          // the Orloj Tower itself: it rises from the ground behind the door's ledge (the ledge is its balcony); see orlojtower.js
    b.door(d.x, d.gy, d.to, 3, 12, d.kind); patchDoor(b, d); if (d.deck) meta.must.push({ tx: d.x, gy: d.gy, name: 'upper door' });
    if (d.needs) meta.items.push({ id: 'door_' + d.tag, tx: d.x, gy: d.gy, needs: d.needs });                    // (the validator proves the door is out of reach without it)
    if (d.lock) b.d('sigils', d.x, d.gy, { flags: d.lock });
    if (d.key) b.d('padlock', d.x, d.gy, { key: d.key });                                                     // (a locked door: its padlock and chains, until it is opened)
  }
  for (const it of items) { b.e('upgrade', it.tx, it.gy, { kind: it.kind, id: it.id }); meta.items.push({ id: it.id, tx: it.tx, gy: it.gy, needs: 'djump' }); }
  for (const c of cells) {
    const cx = b.cell(c.xs, 7, c.gate ? GATE[c.gate] : TILE.EMPTY, c.gy), gate = [[c.xs + 6, c.gy - 3], [c.xs + 6, c.gy - 2], [c.xs + 6, c.gy - 1]];
    if (c.door) { b.door(cx, c.gy, c.to, 3, 12, c.kind || 'crypt'); patchDoor(b, { ...c, gated: !!c.gate, ...(c.vault ? { reqs: ['djump', 'dash'], arrive: { x: cx, gy: c.arriveAt } } : {}) }); meta.items.push({ id: 'door_' + c.tag, tx: cx, gy: c.gy, ...(c.gate ? { gate } : {}), ...(c.vault ? { needs: ['djump', 'dash'] } : {}) }); if (c.lock) b.d('sigils', cx, c.gy, { flags: c.lock }); if (c.key) b.d('padlock', cx, c.gy, { key: c.key }); continue; }          // (a door in a sealed cell)
    if (c.skull) b.e('skull', cx, c.gy, { id: c.id }); else if (c.page) b.e('upgrade', cx, c.gy, { kind: 'page', n: c.page, id: c.id, secret: true }); else if (c.chest) b.e('chest', cx, c.gy, { contents: c.kind, id: c.id, ...(c.secret ? { secret: true } : {}) }); else b.e('upgrade', cx, c.gy, { kind: c.kind, id: c.id, ...(c.secret ? { secret: true } : {}) });
    if (c.hollow) for (const [hx, hy] of gate) (b.def.hollow ||= []).push(hx + ',' + hy);          // (a hollow wall: it looks like any other, and gives under the sword)
    if (c.gate === 'lever') {          // the alcove is shut by a portcullis, raised by a lever (or a candle puzzle) elsewhere in the room
      const lvr = levers.find(q => q.k === c.k), pz = puzzles.find(q => q.k === c.k), at = lvr || (pz && { x: pz.x0 + 7, gy: pz.gy });
      if (!at) throw new Error('lever cell without a lever'); leverDefs.push({ id: 'lv_' + id + '_' + c.k, x: at.x, gy: at.gy, gate, gx: c.xs + 3, cell: { tx: cx, gy: c.gy }, puzzle: pz ? { x0: pz.x0, gy: pz.gy } : null });
      meta.must.push({ tx: cx, gy: c.gy, name: 'lever cell' }); continue;
    }
    meta.items.push({ id: c.id, tx: cx, gy: c.gy, gate, gateName: c.gate });
  }
  if (leverDefs.length) { b.def.levers = leverDefs.map(({ id: lid, x: lx, gy: lgy, gate }) => ({ id: lid, x: lx, gy: lgy, gate })); for (const lv of leverDefs) { if (lv.puzzle) { const P = lv.puzzle, hs = r.shuffle([0, 1, 2]), order = r.shuffle([0, 1, 2]), NAME = ['THE LOW FLAME', 'THE MIDDLE FLAME', 'THE TALL FLAME']; for (let i = 0; i < 3; i++) { b.e('litcandle', P.x0 + 3 + i * 4, P.gy, { id: lv.id, i, h: hs[i], order: order.map(k => k) , hs }); meta.must.push({ tx: P.x0 + 3 + i * 4, gy: P.gy, name: 'candle' }); } b.tablet(P.x0 + 1, P.gy, 'LIGHT ' + order.map(k => NAME[hs[k]]).join(', THEN ') + '.', 'tabcandle'); meta.must.push({ tx: P.x0 + 1, gy: P.gy, name: 'candle tablet' }); } else { b.e('lever', lv.x, lv.gy, { id: lv.id }); meta.must.push({ tx: lv.x, gy: lv.gy, name: 'lever' }); } } meta.levers = leverDefs.map(lv => ({ id: lv.id, tx: lv.x, gy: lv.gy, gate: lv.gate, beyond: lv.cell ? { tx: lv.cell.tx, gy: lv.cell.gy } : { tx: lv.gx + 3, gy: lv.gy } })); }
  if (gapStart >= 0) { meta.abilities = ['djump', 'dash']; meta.gap = { x0: gapStart, x1: gapEnd }; }
  // tablets: near the start, or just before the gulf
  const flatCols = []; for (let cx = 2; cx < W - 2; cx++) if (g[cx] >= 0 && g[cx - 1] === g[cx] && g[cx + 1] === g[cx] && !vaults.some(v => cx >= v.e0 + 22 && cx <= v.e0 + 38) && !leverDefs.some(lv => Math.abs(cx - lv.x) < 4 || (cx >= lv.gx - 3 && cx <= lv.gx + 4))) flatCols.push(cx);
  const solidAt = (tx, ty) => b.def.tiles[ty * W + tx];
  for (const t of tablets) {
    let tx = -1;
    if (t.near === 'gap' && gapStart >= 0) tx = gapStart - 3; else if (t.near === 'door' && doors.some(d => d.to === t.to)) { const dd = doors.find(d => d.to === t.to), cand = flatCols.filter(c => Math.abs(c - dd.x) >= 4 && Math.abs(c - dd.x) <= 8 && !solidAt(c, g[c] - 1) && doors.every(d => Math.abs(d.x - c) >= 4)); if (cand.length) tx = r.pick(cand); } else { const cand = flatCols.filter(c => c >= PAD + 2 && c <= PAD + 16 && !solidAt(c, g[c] - 1) && !doors.some(d => Math.abs(d.x - c) < 4)); if (cand.length) tx = r.pick(cand); }
    if (tx < 0) { const cand = flatCols.filter(c => !solidAt(c, g[c] - 1) && !doors.some(d => Math.abs(d.x - c) < 4)); tx = cand.length ? r.pick(cand) : -1; }          // (never in front of a door: a tablet would take the UP key)
    if (tx < 0) return { ok: false, errs: ['no place for tablet'] };
    b.tablet(tx, g[tx], t.text, t.id); meta.must.push({ tx, gy: g[tx], name: 'tablet ' + t.id });
  }
  // THE SKULLS: no cell, no barrier - one lies out on the open ground, tucked in a corner (the foot of a wall or a step) if the room has one, well away from the ends, doors, signs and everything else
  for (const sk of skulls) {
    const busy = c => doors.some(d => Math.abs(d.x - c) < 5) || signs.some(q => Math.abs(q.x - c) < 4) || cells.some(q => c >= q.xs - 6 && c <= q.xs + 9) || b.def.spawns.some(sp => ['tablet', 'waystone', 'chest', 'upgrade', 'lever', 'skull', 'altar', 'statue', 'barrel', 'bell', 'litcandle'].includes(sp.type) && Math.abs(sp.x - c) < 4) || gates.some(q => Math.abs(q.x - c) < 4) || levers.some(q => Math.abs(q.x - c) < 3) || ferries.some(fr => c >= fr.x0 - 3 && c <= fr.x0 + fr.P + 3) || puzzles.some(q => c >= q.x0 - 2 && c <= q.x0 + 16) || climbs.some(q => c >= q.x0 - 2 && c <= q.x0 + 15) || (gapStart >= 0 && c >= gapStart - 4 && c <= gapEnd + 4);
    const open = c => c >= PAD + 8 && c < W - PAD - 8 && g[c] >= 0 && !solidAt(c, g[c] - 1) && !solidAt(c, g[c] - 2) && !solidAt(c, g[c] - 3) && g[c - 1] === g[c] && g[c + 1] === g[c] && !busy(c);
    const corner = c => [c - 2, c + 2].some(q => g[q] >= 0 && g[q] < g[c] - 1) || [c - 1, c + 1].some(q => g[q] >= 0 && g[q] < g[c] - 1);          // (the foot of a wall or a step)
    const all = flatCols.filter(open), tuck = all.filter(corner), from = tuck.length ? tuck : all;
    if (!from.length) return { ok: false, errs: ['no place for a skull'] };
    const tx = r.pick(from); b.e('skull', tx, g[tx], { id: sk.id }); meta.must.push({ tx, gy: g[tx], name: 'skull ' + sk.id });
  }
  signs.forEach((s, i) => { if (g[s.x] === undefined || g[s.x] < 0) return; b.tablet(s.x, g[s.x], s.text, 'sign_' + id + '_' + i, s.key);  meta.must.push({ tx: s.x, gy: g[s.x], name: 'sign' }); });          // (the crossroads' signposts)
  if (spec.waystone) {                                                                                  // a waystone at the crossroads, near where you arrive, so you can always come back to it
    const cand = flatCols.filter(c => g[c] === BASE && c >= PAD + 3 && c <= PAD + 44 && doors.every(d => Math.abs(d.x - c) >= 6) && signs.every(s => Math.abs(s.x - c) >= 4) && !cells.some(q => c >= q.xs - 6 && c <= q.xs + 8));
    if (!cand.length) return { ok: false, errs: ['no place for the waystone'] };
    const wx = r.pick(cand); b.e('waystone', wx, BASE, { id: 'tp_' + id }); meta.must.push({ tx: wx, gy: BASE, name: 'waystone' });
  }
  if (spec.streams) {                                                                                    // flowing water on level floor, clear of everything you use and of every pit: it carries the hero along
    const near = new Set(), mark = (x0, rad) => { for (let k = -rad; k <= rad; k++) near.add(x0 + k); };
    for (const d of doors) mark(d.x, 4); for (const s of signs) mark(s.x, 3); for (const c of cells) mark(c.xs + 3, 8); for (const c of climbs) mark(c.x0 + 7, 9);
    for (const s of b.def.spawns) if (['tablet', 'waystone', 'upgrade', 'chest', 'statue', 'barrel', 'altar'].includes(s.type)) mark(s.x, 3);
    const okc = cx => { if (cx < PAD || cx >= W - PAD || g[cx] < 3 || near.has(cx) || b.def.tiles[(g[cx] - 1) * W + cx] !== 0 || b.def.tiles[(g[cx] - 2) * W + cx] !== 0) return false; return true; };
    const runs = []; let a0 = -1;
    for (let cx = PAD; cx <= W - PAD; cx++) { if (okc(cx) && (a0 < 0 || g[cx] === g[a0])) { if (a0 < 0) a0 = cx; } else { if (a0 >= 0 && cx - a0 >= 10) runs.push([a0, cx - 1]); a0 = okc(cx) ? cx : -1; } }
    const want = r.i(spec.streams[0], spec.streams[1]), picked = [];
    for (const [s0, e0] of r.shuffle(runs)) { if (picked.length >= want) break; const len = Math.min(e0 - s0 + 1, r.i(10, 22)), st = s0 + r.i(0, e0 - s0 + 1 - len); if (picked.some(q => st < q[1] + 6 && st + len > q[0] - 6)) continue; const e1 = st + len - 1, pitBeyond = d => { for (let k = 1; k <= 7; k++) { const q = d > 0 ? e1 + k : st - k; if (g[q] !== undefined && g[q] < 0) return true; } return false; }, dir0 = r.chance(0.5) ? 1 : -1, dir = !pitBeyond(dir0) ? dir0 : !pitBeyond(-dir0) ? -dir0 : 0;          // (never into a pit: the water is pushing you AWAY from one, or the stretch is not used)
      if (!dir) continue; picked.push([st, e1, dir]); }
    for (const [s0, e0] of picked) { b.put(s0, g[s0] - 1, TILE.SOLID); b.put(e0, g[e0] - 1, TILE.SOLID); }          // a stone sill at each end: the water is held in a trough, it never runs on into nothing
    const list = picked.map(([s0, e0, dir]) => ({ x0: (s0 + 1) * 16, x1: e0 * 16, y: g[s0] * 16, vx: dir * (0.30 + 0.2 * r.f()) }));
    if (!list.length) return { ok: false, errs: ['no place for a stream'] };
    for (const c of list) { const up = c.vx > 0 ? Math.floor(c.x0 / 16) + 1 : Math.floor(c.x1 / 16) - 2; b.d('waterfall', up, Math.round(c.y / 16), { top: -80, w: 20 }); }          // (it pours in from the ceiling at the upstream end)
    b.def.currents = list;
  }
  const jetList = [];
  if (spec.jets) {                                                                                       // STEAM JETS (see steamjets.js): on level floor with clear air above, apart from each other and from everything the hero uses
    const near = new Set(), mark = (x0, rad) => { for (let k = -rad; k <= rad; k++) near.add(x0 + k); };
    for (const d of doors) mark(d.x, 5); for (const s of signs) mark(s.x, 3); for (const c of cells) mark(c.xs + 3, 8); for (const c of climbs) mark(c.x0 + 7, 9);
    for (const f of ferries) for (let q = f.x0 - 3; q <= f.x0 + f.P + 3; q++) near.add(q); for (const w of iceWalls) mark(w.x, 3); for (const pz of puzzles) for (let q = pz.x0 - 3; q <= pz.x0 + 17; q++) near.add(q);
    for (const lv of leverDefs) { mark(lv.x, 4); mark(lv.gx, 4); } if (gapStart >= 0) for (let q = gapStart - 6; q <= gapEnd + 6; q++) near.add(q);
    for (const s of b.def.spawns) if (['tablet', 'waystone', 'upgrade', 'chest', 'statue', 'barrel', 'altar', 'lever', 'skull', 'bell', 'litcandle'].includes(s.type)) mark(s.x, 3);
    const clear = cx => { for (let dx = -1; dx <= 1; dx++) for (let k = 1; k <= 5; k++) if (b.def.tiles[(g[cx] - k) * W + cx + dx] !== 0) return false; return true; };
    const ok = cx => cx >= PAD + 8 && cx < W - PAD - 8 && g[cx] >= 0 && g[cx - 1] === g[cx] && g[cx + 1] === g[cx] && !near.has(cx) && clear(cx);
    const cand = []; for (let cx = 0; cx < W; cx++) if (ok(cx)) cand.push(cx);
    const want = r.i(spec.jets[0], spec.jets[1]);
    for (const cx of r.shuffle(cand)) { if (jetList.length >= want) break; if (jetList.some(j => Math.abs(j.cx - cx) < 8)) continue; jetList.push({ cx, x: cx * 16 + 8, y: g[cx] * 16, h: 88, ph: r.f(), period: 230 + r.i(0, 50) }); }
    if (jetList.length < spec.jets[0]) return { ok: false, errs: ['no room for the steam jets'] };
    b.def.jets = jetList.map(({ cx, ...j }) => j);
    for (let i = flatCols.length - 1; i >= 0; i--) if (jetList.some(j => Math.abs(j.cx - flatCols[i]) < 3)) flatCols.splice(i, 1);          // (no brazier or candelabra on a vent)
  }
  const poolList = [];
  if (spec.pools) {                                                                                      // POOLS (the Weeping Swamp): now and then a ONE-TILE HOLLOW in the level ground, three to five tiles wide, with a step down and a step up, and water in it (drawn by the water shader; see Player.waterAt)
    const near = new Set(), mark = (x0, rad) => { for (let k = -rad; k <= rad; k++) near.add(x0 + k); };
    for (const d of doors) mark(d.x, 3); for (const s of signs) mark(s.x, 2); for (const c of cells) mark(c.xs + 3, 6); for (const c of climbs) mark(c.x0 + 7, 7);          // (a pool is harmless: it only keeps clear of what the hero uses)
    for (const f of ferries) for (let q = f.x0 - 2; q <= f.x0 + f.P + 2; q++) near.add(q); for (const w of iceWalls) mark(w.x, 3); for (const pz of puzzles) for (let q = pz.x0 - 3; q <= pz.x0 + 17; q++) near.add(q);
    for (const lv of leverDefs) { mark(lv.x, 3); mark(lv.gx, 3); } if (gapStart >= 0) for (let q = gapStart - 4; q <= gapEnd + 4; q++) near.add(q); for (const j of jetList) mark(j.cx, 3);
    for (const s of b.def.spawns) if (['tablet', 'waystone', 'upgrade', 'chest', 'statue', 'barrel', 'altar', 'lever', 'skull', 'bell', 'litcandle'].includes(s.type)) mark(s.x, 2);
    const T0 = (cx, row) => (cx < 0 || cx >= W || row < 0 || row >= H ? -1 : b.def.tiles[row * W + cx]);
    const okc = cx => cx >= PAD + 2 && cx < W - PAD - 2 && g[cx] >= 5 && !near.has(cx) && T0(cx, g[cx]) === TILE.SOLID && T0(cx, g[cx] + 1) === TILE.SOLID && [1, 2, 3].every(k => T0(cx, g[cx] - k) === 0);          // (plain solid ground, thick enough, clear air above)
    const want = r.i(spec.pools[0], spec.pools[1]);
    for (let tries = 0; tries < 40 && poolList.length < want; tries++) {
      const w = r.i(3, 5), s = r.i(PAD + 3, Math.max(PAD + 3, W - PAD - 4 - w)), e = s + w - 1; let ok = okc(s - 1) && okc(e + 1) && g[s - 1] === g[s] && g[e + 1] === g[s];          // (the ground on both sides is the same height: the hollow is bounded by a step up at each end)
      for (let cx = s; ok && cx <= e; cx++) ok = okc(cx) && g[cx] === g[s];
      if (!ok || poolList.some(q => s < q[1] + 8 && e > q[0] - 8)) continue; poolList.push([s, e, g[s]]);
    }
    for (const [s, e, row] of poolList) for (let cx = s; cx <= e; cx++) { b.put(cx, row, TILE.EMPTY); g[cx] = row + 1; }
    if (poolList.length) b.def.pools = poolList.map(([s, e, row]) => ({ x0: s * 16, x1: (e + 1) * 16, y: row * 16, yb: (row + 1) * 16 }));
    for (let i = flatCols.length - 1; i >= 0; i--) if (poolList.some(([s, e]) => flatCols[i] >= s - 1 && flatCols[i] <= e + 1)) flatCols.splice(i, 1);          // (no scenery standing in the water)
  }
  const closedRight = !!spec.hub || !!spec.closedRight; if (closedRight && gapStart < 0) meta.entry.R = null;          // (a crossroads has no way on at its right end)
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: closedRight ? null : meta.entry.R };
  // (the walls of ice are proved with the ice melted: the room is checked as it will be once the Ember has cleared the way, and a wall may not stand in a doorway)
  let vbase = b.def; if (iceTiles.length) { const t2 = Uint8Array.from(b.def.tiles); for (const [tx, ty] of iceTiles) t2[ty * W + tx] = 0; vbase = { ...b.def, tiles: t2 }; }
  const v = validateFerries(vbase, ferries, movers, meta.abilities); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  populate(b, W, H, spec, r, v.S, v.seen, g, !outdoor, [1, W - 2], ferries.map(f => [f.x0 - 1, f.x0 + f.P]).concat(jetList.map(j => [j.cx - 2, j.cx + 2])).concat(vaults.map(v => [v.e0 + 22, v.e0 + 38])).concat(iceWalls.map(w => [w.x - 1, w.x + 2])).concat(leverDefs.map(lv => lv.puzzle ? [lv.puzzle.x0 - 1, lv.puzzle.x0 + 15] : [lv.x - 3, lv.x + 3])).concat(leverDefs.map(lv => [lv.gx - 2, lv.gx + 3])).concat(poolList.map(([s, e]) => [s - 1, e + 1])));          // (nothing is placed over a pit, or in a pool)
  decorate(b, W, spec, r, g, ceil, flatCols);
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ TOWER (vertical climb)
function genTower(id, spec, r) {
  const DJ = hasDJ(spec), DASH = (spec.abilities || []).includes('dash');          // (with the dash in hand the steps can lie much further apart)
  const W = r.i(spec.w[0], spec.w[1]), H = r.i(spec.h[0], spec.h[1]), floor = H - 2, top = r.i(spec.top[0], spec.top[1]);
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, horizon: floor }); b.def.interior = true;                  // (a tower is a building: brickwork and narrow windows behind you, never open sky)
  b.floor(0, W, floor).ceil(0, W, 2);
  const plats = []; let prev = { x: r.i(3, 6), len: r.i(5, 6), row: floor - r.i(2, 3) }; plats.push(prev); let dir = 1, guard = 0;
  const add = (nx, len, row) => { const xmin = spec.bell && row < top + 9 ? W - 14 : 1; prev = { x: Math.max(xmin, Math.min(W - 2 - len, nx)), len, row }; plats.push(prev); };          // (the bell tower: above nine rows over the top landing's height the climb keeps to the right, under the landing - the bell's ledge on the left has nothing to jump from)
  while (prev.row - top > 3 && guard++ < 60) {
    let rise = r.i(2, DJ ? 4 : 3); if (prev.row - rise < top + 2) rise = Math.max(1, prev.row - (top + 2));
    const len = r.i(5, 6), gap = DASH ? r.i(2, 5) : r.i(0, DJ ? 3 : 2); let nx;
    if (dir > 0) { nx = prev.x + prev.len + gap; if (nx + len > W - 2) dir = -1; }
    if (dir < 0) { nx = prev.x - gap - len; if (nx < 1) { dir = 1; nx = prev.x + prev.len + gap; } }
    add(nx, len, prev.row - rise);
  }
  while (prev.x + prev.len < W - 17 && guard++ < 90) add(prev.x + prev.len + r.i(0, 2), r.i(5, 6), prev.row);       // work over to the right side, under the top ledge
  // some of the steps are MOVING platforms instead: a step that slides about 1.25 tiles either way (never the first or the last, never two in a row; none in Prague).  The Clockwork Dungeon has the most.
  const movers = [], MOVE_P = spec.zone === 6 || spec.orloj ? 0 : spec.zone === 8 ? 0.9 : 0.18, mstyle = moverStyle(spec), AMPT = 1.25;
  plats.forEach((p, i) => {
    if (!MOVE_P || i < 1 || i >= plats.length - 2 || p.moves || (plats[i - 1] && plats[i - 1].moves && !(spec.zone === 8 && r.chance(0.45))) || !r.chance(MOVE_P)) return;          // (the Mainspring Shaft is mostly moving steps, sometimes two in a row)
    if (p.x - AMPT < 1 || p.x + p.len + AMPT > W - 1) return;
    p.moves = true; const c = (p.x + p.len / 2) * 16;
    movers.push({ x0: Math.round(c - AMPT * 16), y0: p.row * 16, x1: Math.round(c + AMPT * 16), y1: p.row * 16, w: p.len * 16, period: 260 + r.i(0, 40), ph: r.f(), style: mstyle });
  });
  for (const p of plats) if (!p.moves) b.plat(p.x, p.len, p.row);
  if (movers.length) b.def.movers = movers;
  b.plat(W - 14, 14, top);                                                   // the top landing (one-way, so you can jump up through it)
  if (spec.orloj) { const sc = 1.45, hpx = 112 * sc; b.d('cog', W / 2 - 8.2, top - 6.5, { r: 40, n: 15, spin: 0.011, a: 0.8 }).d('cog', W / 2 + 7.6, top - 1.5, { r: 30, n: 11, spin: -0.0145, phase: 0.5, a: 0.8 }).d('cog', W / 2 - 6.5, top + 3.5, { r: 22, n: 8, spin: 0.020, a: 0.8 }).d('cog', W / 2 + 6.4, top - 9, { r: 18, n: 7, spin: 0.023, phase: 1, a: 0.8 });
    b.d('animgear', W / 2 - 11, top - 2, { img: 'gear_b', scale: 1.1, rate: 0.5, a: 0.36 }).d('animgear', W / 2 + 11, top + 6, { img: 'gear_a', scale: 1.2, rate: -0.45, a: 0.36 }).d('animgear', W / 2 - 3, top + 11, { img: 'gear_c', scale: 1.0, rate: 0.5, a: 0.32 });          // (accents from the Animated Gears pack, beside the generated cogs)
    b.d('img', W / 2 - 0.5, top - 4.2 + hpx / 32, { img: 'orloj', back: true, scale: sc });
    b.d('pendulum', 4, top - 11, { len: 112, bob: 10, speed: 0.032, swing: 0.3 }).d('pendulum', W - 5, top - 11, { len: 112, bob: 10, speed: 0.032, phase: 3.1, swing: 0.3 }); }          // THE ORLOJ: centred in the shaft, behind everything, its centre a little above the landing where the door to the Clockwork Dungeon stands
  const meta = { abilities: [...new Set([...(spec.abilities || []), ...(DJ ? ['djump'] : [])])], back: BACK[spec.zone], entry: { L: { tx: 1, gy: floor }, R: { tx: W - 2, gy: top } }, must: [], items: [] };
  if (spec.doorL) { b.door(W - 9, floor, spec.doorL.to, 0, 0, spec.doorL.kind); patchDoor(b, spec.doorL); }                       // the door from the previous area
  if (spec.doorR) { b.door(W - 11, top, spec.doorR.to, 3, 12, spec.doorR.kind || 'crypt'); patchDoor(b, spec.doorR); meta.entry.R = null; }          // a door on the top landing: the way back to a crossroads
  if (spec.bell) { const LEN = 5, LX = Math.max(1, W - 28), bx = LX + 2; b.plat(LX, LEN, top); b.e('bell', bx, top, { id: 'page5', secret: true }); meta.items.push({ id: 'page5', tx: bx, gy: top, needs: ['djump', 'dash'] }); }          // (the BELL of the bell tower: hidden on a ledge at the far side of the top from the way out, across a gulf nine tiles wide that only the double jump and the dash together can cross)
  if (spec.topItem) { b.e('upgrade', W - 7, top, { kind: spec.topItem.kind, id: spec.topItem.id }); meta.must.push({ tx: W - 7, gy: top, name: 'top item' }); }
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  if (spec.chase) { b.def.chase = true; b.def.chaseTop = top; }          // (the Bell Tower is on fire: see Game.beginChase)
  const tabAvoid = [];          // (the ground a tablet stands on: nothing else is put there)
  for (const t of (spec.mods || []).filter(m => m.t === 'tablet')) {          // (a tablet is up on the top landing - unless it is marked near: 'start': then it stands on the ground by the way in, just past the foot of the first step, so it is read before the climb.  No random numbers are drawn here)
    const p0 = plats[0], tx = t.near === 'start' ? Math.min(W - 12, p0.x + p0.len + 1) : W - 4, gy = t.near === 'start' ? floor : top;
    b.tablet(tx, gy, t.text, t.id); meta.must.push({ tx, gy, name: 'tablet' }); if (gy === floor) tabAvoid.push([tx - 2, tx + 2]);
  }
  const v = validateMoving(b.def, movers); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const g = new Array(W).fill(floor);
  populate(b, W, H, spec, r, v.S, v.seen, g, true, [1, W - 2], tabAvoid);
  for (const rr of [floor - 6, floor - 14, floor - 22].filter(y => y > top)) b.torches([2, W - 3], rr);
  b.d('brazier', 4, floor).d('brazier', W - 5, floor);
  if (spec.falls) for (let i = 0, n = r.i(spec.falls[0], spec.falls[1]), used = []; i < n; i++) { const x = r.i(3, W - 4); if (used.some(u => Math.abs(u - x) < 8)) continue; used.push(x); b.d('waterfall', x, floor, { top: -80, w: 18 }); }          // water pours down the shaft
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ BOSS ARENA
function genArena(id, spec, r) {
  const outdoor = !!spec.outdoor, H = spec.h || 14, BASE = H - 2, W = r.i(spec.w[0], spec.w[1]), rise = spec.rise || 3;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme });
  b.floor(0, W, BASE); if (!outdoor) b.ceil(0, W, 2);
  const mirror = !!spec.mirror, mc = W - 12;                                                       // the mirror room: a great mirror 12 tiles wide hangs on the back wall, its middle at column mc, and stands on the floor
  const L = r.i(5, 9), len1 = r.i(4, 5), Rr = W - r.i(9, 13) - len1;
  b.plat(L, len1, BASE - rise); b.plat(Rr, len1, BASE - rise);
  if (mirror) {
    const band = 7, fx = (mc - 6) * 16, fx1 = (mc + 6) * 16, fy = 36, gy1 = BASE * 16;            // the frame (its foot is hidden by the floor), the glass inside it, and the middle line the reflection is mirrored across
    b.def.mirror = { fx, fy, fw: fx1 - fx, fh: gy1 + band - fy, band, x0: fx + band, x1: fx1 - band, y0: fy + band, y1: gy1, axis: (fx + fx1) / 2 };
  }
  const must = [{ tx: L + 1, gy: BASE - rise, name: 'left platform' }, { tx: Rr + 1, gy: BASE - rise, name: 'right platform' }];
  if (spec.plats >= 3) { const ml = r.i(5, 7), mx = Math.round(W / 2 - ml / 2) + r.i(-2, 2), mr = BASE - rise - 2; b.plat(mx, ml, mr); must.push({ tx: mx + 2, gy: mr, name: 'middle platform' }); }
  const bossX = mirror ? mc : Math.round(W * 0.7) + r.i(-3, 2), flying = FLYING_BOSS.has(spec.boss), brow = flying ? BASE - (spec.flyRow || 6) : BASE;
  b.e(BOSS_TYPE[spec.boss], bossX, brow, { reward: spec.reward, ...(spec.page ? { page: spec.page } : {}) });
  const lair = !!spec.lair, gated = lair || !!spec.doorL, closedR = lair || spec.seal === 'left' || !!spec.doorR;                    // a lair is entered by a door (at x=3), has no other way out, and needs no seals
  const seals = gated ? [] : [{ x: 0, y0: BASE - 3, y1: BASE - 1 }];
  if (!gated && spec.seal === 'both' && !spec.doorR) seals.push({ x: spec.exitGate ? W - 2 : W - 1, y0: BASE - 3, y1: BASE - 1 });
  b.bossSeals(...seals);
  if (spec.jets) {                                                                                       // STEAM JETS in the boss's room: on the floor, out from under the platforms, away from the doors and the boss's own ground; they stop when it dies
    const gap = spec.jetGap || 9, pm = spec.jetGap ? 1 : 3, bn = spec.jetGap ? 3 : 7, cols = [], busyC = cx => (cx >= L - pm && cx <= L + len1 + pm - 1) || (cx >= Rr - pm && cx <= Rr + len1 + pm - 1) || Math.abs(cx - bossX) < bn || cx < 8 || cx > W - 8 || (spec.plats >= 3 && b.def.tiles[(BASE - rise - 2) * W + cx] === TILE.PLAT);
    for (const cx of r.shuffle(Array.from({ length: W }, (_, i) => i).filter(cx => !busyC(cx)))) { if (cols.length >= spec.jets) break; if (cols.some(q => Math.abs(q - cx) < gap)) continue; cols.push(cx); }
    if (cols.length < Math.min(2, spec.jets)) return { ok: false, errs: ['no room for the steam jets'] };
    b.def.jets = cols.map(cx => ({ x: cx * 16 + 8, y: BASE * 16, h: 88, ph: r.f(), period: 240 + r.i(0, 40) })); b.def.jetsBoss = true;
  }
  if (lair) b.door(3, BASE, spec.parent, 0, BASE, 'crypt');
  if (spec.doorL) { b.door(3, BASE, spec.doorL.to, 3, BASE, spec.doorL.kind || 'crypt'); patchDoor(b, spec.doorL); }          // (a room entered by a door from the area before it)
  if (spec.doorR) { b.door(W - 5, BASE, spec.doorR.to, 3, BASE, spec.doorR.kind || 'crypt'); patchDoor(b, spec.doorR); if (spec.doorR.lock) b.d('sigils', W - 5, BASE, { flags: spec.doorR.lock }); }          // the way on (usable once the boss is down: doors do not work during a fight); sealed by a sigil if the boss's death is what it waits for
  if (spec.exitGate) b.rect(W - 1, BASE - 3, 1, 3, GATE[spec.exitGate]);
  const g = new Array(W).fill(BASE), meta = { abilities: spec.abilities || [], back: BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: closedR ? null : { tx: spec.exitGate ? W - 4 : W - 2, gy: BASE } }, must, items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: closedR ? null : { tx: W - 2, gy: BASE } };
  if (spec.candles) { const n = spec.candles[0];                                                                          // (a boss room has candelabras only: no treasure statues)
    const span = (mirror ? mc - 9 : W - 8) - 8; for (let k = 0; k < n; k++) { const cx = Math.round(8 + span * (k + 0.5) / n) + r.i(-2, 2); b.candle(cx, BASE); } }
  if (ZONES[spec.zone].theme === 'cistern') { b.put(6, BASE - 1, TILE.SOLID); b.put(W - 7, BASE - 1, TILE.SOLID); }          // (the flood is held in a trough: a stone sill at each end of it, so the water never just stops in mid-room; see the currents below)
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  // decor
  const flat = []; for (let cx = 3; cx < W - 3; cx++) flat.push(cx);
  const th = ZONES[spec.zone].theme, spread0 = (n, gap, fn) => { const used = []; for (let i = 0; i < n * 4 && used.length < n; i++) { const x = r.i(4, W - 5); if (used.some(u => Math.abs(u - x) < gap)) continue; used.push(x); fn(x); } };
  if (th === 'graveyard') { b.d('brazier', 4, BASE).d('brazier', W - 5, BASE).d('img', Math.round(W / 2), BASE, { img: 'cemetery_statue', back: true }); for (const k of ['cemetery_stone-4', 'cemetery_stone-1']) b.d('img', r.i(8, W - 9), BASE, { img: k }); }
  else if (th === 'village' || th === 'swamp') { decorate(b, W, spec, r, g, 0, flat); b.d('brazier', 4, BASE).d('brazier', W - 5, BASE); }
  else if (th === 'library') { b.torches([4, 12, Math.round(W / 2), W - 13, W - 5], 6); b.d('bookcase', 9, BASE, { back: true }).d('bookcase', W - 10, BASE, { back: true }).d('cdl', 5, BASE).d('cdl', W - 6, BASE); for (const bx of [12, W - 13]) b.d('banner', bx, 2, { len: 7, color: '#5a1a22' }); }
  else if (th === 'ice') {                                                                          // a cavern of blue ice: crystals along the floor, icicles hanging from the roof (the wisps and the boss light it)
    spread0(r.i(4, 6), 6, x => b.d('icicles', x, 2, { n: r.i(2, 3) })); spread0(r.i(3, 4), 9, x => b.d('crystals', x, BASE, { n: r.i(2, 4) }));
  }
  else if (th === 'cistern') {                                                                      // falls pour down the back wall, and the whole floor is awash (shallow water the hero wades through, slowly): still until the Drowned Warden heaves the tide one way or the other (BossDrowned 'tide')
    b.d('brazier', 4, BASE).d('brazier', W - 5, BASE); b.d('waterfall', 10, BASE, { top: -80, w: 26 }).d('waterfall', W - 12, BASE, { top: -80, w: 26 });
    b.def.currents = [{ x0: 7 * 16, x1: (W - 7) * 16, y: BASE * 16, vx: 0 }];
  }
  else if (spec.loft) {          // the Boiler Loft: the clock's great cogs turn behind the fight, and braziers light it
    b.d('cog', Math.round(W * 0.3), 5.5, { r: 36, n: 13, spin: 0.012, a: 0.75 }).d('cog', Math.round(W * 0.58), 6.5, { r: 26, n: 9, spin: -0.016, phase: 0.5, a: 0.75 }).d('cog', W - 9, 5, { r: 20, n: 8, spin: 0.022, a: 0.75 }).d('brazier', 4, BASE).d('brazier', W - 12, BASE);
  }
  else { b.torches([4, 12, Math.round(W / 2), W - 13, W - 5].concat(mirror ? [mc - 8, mc + 8] : []).filter(cx => cx > 2 && cx < W - 2 && !(mirror && Math.abs(cx - mc) <= 7)), 6); if (spec.decor === 'column') { b.d('column', 4, BASE).d('column', W - 5, BASE); b.d('cdl', r.i(10, 16), BASE).d('cdl', W - r.i(12, 18), BASE); } else if (spec.decor === 'brazier') { b.d('brazier', 4, BASE).d('brazier', W - 5, BASE); } else if (spec.decor === 'banner') { b.d('column', 4, BASE).d('column', W - 5, BASE).d('brazier', 11, BASE).d('brazier', W - 12, BASE); for (const bx of [8, 14, W - 15, W - 9]) b.d('banner', bx, 2, { len: 8, color: '#6a1020' }); } else for (const bx of mirror ? [10, mc - 10] : [10, W - 11]) b.d('banner', bx, 2, { len: 6, color: mirror ? '#3a1a5a' : '#7a1e2a' }); }
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ SANCTUARY (save room)
function genSanctuary(id, spec, r) {
  const b = new B(id, spec.name, spec.zone, 22, 14, { theme: 'chapel', music: 'save', ambient: 0.35, save: true, weather: 'wisps', horizon: 12, map: spec.map });
  b.floor(0, 22, 12).ceil(0, 22, 2).torches([4, 18], 7); const flip = r.chance(0.5);
  b.d('cdl', flip ? 15 : 7, 12, { keep: true }).d('cdl', flip ? 7 : 15, 12, { keep: true }).e('altar', 11, 12).door(3, 12, spec.parent, 0, 12, 'wood');
  const col = r.pick(['#5a2a6a', '#2a3a6a', '#6a2a3a']); b.d('banner', 9, 2, { len: 5, color: col }).d('banner', 13, 2, { len: 5, color: col });
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: 12 }, must: [{ tx: 11, gy: 12, name: 'altar' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ WAYSTONE CHAMBER (the teleport room that opens every zone)
// A calm, enemy-free room in the zone's own look (open sky in the outdoor zones) with the waystone in the middle.  Walking up to it attunes it; UP opens the travel map.
function genTeleport(id, spec, r) {
  const W = r.i(26, 32), H = 14, BASE = 12, outdoor = !!spec.outdoor, cx = W >> 1;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, music: 'save', theme: spec.theme });
  b.floor(0, W, BASE); if (!outdoor) b.ceil(0, W, 2);
  b.e('waystone', cx, BASE, { id: 'tp_' + id }); if (ZONES[spec.zone].theme !== 'ice') b.d('brazier', cx - 7, BASE).d('brazier', cx + 7, BASE);          // (no fires in the wilderness of the Frozen Caverns: ghostly wisps light it)
  const meta = { abilities: [...(spec.abilities || [])], back: BACK[spec.zone], entry: { L: spec.doorL ? null : { tx: 1, gy: BASE }, R: { tx: spec.exitGate ? W - 4 : W - 2, gy: BASE } }, must: [{ tx: cx, gy: BASE, name: 'waystone' }], items: [], start: { tx: 3, gy: BASE } };
  if (spec.exitGate) b.rect(W - 1, BASE - 3, 1, 3, GATE[spec.exitGate]);                                                              // (a wall across the way on - ice, that only fire melts - at the far end)
  if (spec.doorL) { b.door(4, BASE, spec.doorL.to, 3, BASE, spec.doorL.kind || 'crypt'); patchDoor(b, spec.doorL); }                   // (a branch's first room is entered by a door from the crossroads)
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const g = new Array(W).fill(BASE), flatCols = []; for (let x = 3; x < W - 3; x++) if (Math.abs(x - cx) > 6) flatCols.push(x);
  decorate(b, W, spec, r, g, outdoor ? 0 : 2, flatCols);
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ INTERIOR (a house, a hut, a crypt: one calm room behind a door)
// People stand about or amble slowly; each gives you something for listening (UP).  A few barrels, a thing on the floor, and the room is furnished from the same props the castle uses.
function genInterior(id, spec, r) {
  const W = r.i(spec.w ? spec.w[0] : 22, spec.w ? spec.w[1] : 28), H = 14, look = spec.look || 'cottage';
  const b = new B(id, spec.name, spec.zone, W, H, { theme: spec.theme || 'hall', ambient: spec.ambient === undefined ? 0.4 : spec.ambient, tint: spec.tint || [0.14, 0.06, 0.01], vig: 0.6, horizon: 12, weather: spec.weather || null, indoor: true });
  b.floor(0, W, 12).ceil(0, W, 2).door(3, 12, spec.parent, 0, 12, 'wood').torches([7, W - 5], 6); if (look === 'cottage') b.def.house = true;          // (a cottage has wooden walls: see drawHouse in world.js)
  // A SECRET FLOOR (spec.trapdoor): three tiles of the floor are a wooden HATCH, and a LEVER on the floor a few steps away draws it back (it slides under the floor beside it: see Game.openHatch and the 'hatch' scenery in decor.js; the
  // lever is thrown once, for good, and the hole stays open).  A hero who walks or falls into the hole drops out of the bottom of the room and lands in the room named (Game.checkExits reads def.dropTo).
  const trap = spec.trapdoor ? Math.floor(W * 0.62) : -99;
  if (spec.trapdoor) {
    const lever = spec.trapdoor.lever, gate = []; for (let k = 0; k < 3; k++) for (const ty of [12, 13]) gate.push([trap + k, ty]);
    b.def.dropTo = { room: spec.trapdoor.room, tx: spec.trapdoor.tx, gy: spec.trapdoor.gy };
    b.d('hatch', trap + 1, 12, { w: 48, lever }); b.e('lever', trap + 6, 12, { id: lever }); b.def.levers = [{ id: lever, kind: 'hatch', gate, hx: trap }];
  }
  const slots = r.shuffle(Array.from({ length: Math.floor((W - 13) / 3) + 1 }, (_, i) => 8 + i * 3).filter(x => Math.abs(x - (trap + 1)) > 2 && Math.abs(x - (trap + 6)) > 1)), take = () => slots.pop();
  const furnish = {
    cottage: [['bookcase', null, true], ['bookcase', null, true], ['img', 'town_crates'], ['img', 'dg_crates'], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_urn_' + r.i(1, 3)]],
    hut: [['img', 'dg_crates'], ['img', 'town_crates'], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_urn_' + r.i(1, 3)]],
    crypt: [['img', 'dg_urn_' + r.i(1, 3)], ['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)], ['column', null, true], ['img', 'dg_crates']],
    study: [['bookcase', null, true], ['bookcase', null, true], ['bookcase', null, true], ['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)]],
    vault: [['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_crates'], ['column', null, true], ['img', 'dg_urn_' + r.i(1, 3)], ['img', 'dg_crates']],
  }[look] || [];
  for (const [t, img, back, scale] of furnish) { const x = take(); if (x === undefined) break; if (t === 'img') b.d('img', x, 12, { img, back: !!back, ...(scale ? { scale } : {}) }); else b.d(t, x, 12, { back: !!back }); }
  for (const x of [Math.floor(W * 0.35), Math.floor(W * 0.7)]) if (r.chance(0.8) && look !== 'cottage') b.d('barwin', x, 8, { back: true });          // (a cottage's windows are part of its wooden wall)
  for (let i = 0; i < 3; i++) b.candle(8, 12);                                                      // (set properly by arrangeCandelabras: beside the door and about the room)
  const used = [];
  const spot = () => { for (let k = 0; k < 40; k++) { const x = r.i(7, W - 4); if (used.every(u => Math.abs(u - x) >= 3)) { used.push(x); return x; } } return null; };
  if (spec.chest) { const x = Math.floor(W * 0.6); used.push(x); b.e('chest', x, 12, { contents: spec.chest.kind, id: spec.chest.id }); }          // (a vault: the treasure behind the locked door)
  if (spec.page) { const x = Math.floor(W * 0.6); used.push(x); b.e('upgrade', x, 12, { kind: 'page', n: spec.page, id: 'page' + spec.page, secret: true }); }          // (a page of the story on a stone, waiting)
  if (spec.empty) { /* (nobody lives here now: no people, no barrels, nothing on the floor) */ }
  else if (spec.npc) { const x = Math.floor(W * 0.55); used.push(x); b.e('villager', x, 12, { kind: spec.npc.kind, calm: true, stand: true, title: spec.npc.title, text: spec.npc.text, gifts: spec.npc.gifts, again: spec.npc.again, ...(spec.npc.sells ? { sells: offerOf(spec.npc.sells.item, spec.npc.sells) } : {}) }); }
  else {
    const n = r.i(spec.npcs ? spec.npcs[0] : 1, spec.npcs ? spec.npcs[1] : 2), kinds = r.shuffle(['woman', 'bearded', 'hatman', 'oldman']), shops = r.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, spec.sellers === undefined ? (r.chance(0.55) ? 1 : 0) : spec.sellers);       // some of them sell
    for (let i = 0; i < n; i++) { const x = spot(); if (x !== null) b.e('villager', x, 12, { kind: kinds[i % 4], calm: true, stand: r.chance(0.4), ...(shops.includes(i) ? { sells: offerOf(r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight + 1]))) } : {}) }); }
  }
  for (let i = 0, n = spec.empty ? 0 : r.i(1, 2); i < n; i++) { const x = spot(); if (x !== null) b.e('barrel', x, 12, { drop: r.pick(['coin', 'coin', 'heart', 'mana', 'heart']) }); }
  if (!spec.empty && r.chance(0.5)) { const x = spot(); if (x !== null) { const item = r.wpick(ITEM_ORDER.map(k => [k, ITEMS[k].weight])); b.e('itemspawn', x, 12, { item, qty: ITEMS[item].pack, id: 'ip_' + id + '_' + x }); } }
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: 12 }, must: spec.page ? [{ tx: Math.floor(W * 0.6), gy: 12, name: 'page' }] : [], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ DISCO (a joke room: enter by the door at one end, the Magic Shoes wait at the other)
function genDisco(id, spec, r) {
  const W = r.i(spec.w[0], spec.w[1]), H = 14, BASE = 12;
  const b = new B(id, spec.name, spec.zone, W, H, { theme: 'hall', ambient: 0.2, tint: [0.05, 0.0, 0.09], vig: 0.7, horizon: 12, indoor: false, music: 'disco' });
  b.def.disco = true;
  b.floor(0, W, BASE).ceil(0, W, 2).door(3, BASE, spec.parent, 0, BASE, 'wood');
  b.e('upgrade', W - 6, BASE, { kind: 'shoes', id: 'got_shoes' });
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: BASE }, must: [{ tx: W - 6, gy: BASE, name: 'shoes' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ GEARS (the gear room: a great pit crossed on moving brass platforms)
// Five brass slabs, each five tiles wide, glide over a pit lined with spikes: the 1st, 3rd and 5th shuttle sideways, the 2nd and 4th rise and fall (see movers.js).  Each runs on a visible
// rail, eases to a near stop at each end, and carries whoever stands on it.  Hop from slab to slab.
// The validator cannot follow moving platforms, so it is shown frozen snapshots: every slab at one end of its track, at the other, alternating, and at the middle.  Those cover every
// adjacent pair of slabs at its two extremes (the widest gap, the biggest climb), so the room is only accepted if the far side can be reached in all of them - whenever you jump, the
// platforms are somewhere between those extremes, never worse.
function genGears(id, spec, r) {
  const W = r.i(spec.w[0], spec.w[1]), H = 22, BASE = 18, PADL = 13, PADR = 14, pitW = W - PADL - PADR, n = 5, SW = 4, EDGE = 4.5, gap = (pitW - 2 * EDGE) / (n - 1), AMP = 2.2;          // (the slabs are far apart: the hero arrives with the double jump AND the dash)
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, horizon: BASE });
  b.floor(0, PADL, BASE).floor(W - PADR, W, BASE).ceil(0, W, 2);
  for (let x = PADL; x < W - PADR; x++) b.put(x, H - 1, TILE.SPIKE);
  const movers = [], rowH = [BASE - 1, BASE - r.i(2, 3), BASE - 1];          // (the sideways slabs' rows)
  for (let i = 0; i < n; i++) {
    const c = PADL + EDGE + i * gap, ph = r.f(), period = 250 + r.i(0, 50);
    if (i % 2 === 0) { const row = rowH[i >> 1]; movers.push({ x0: Math.round((c - AMP) * 16), y0: row * 16, x1: Math.round((c + AMP) * 16), y1: row * 16, w: SW * 16, period, ph, style: 'brass', ...(i === 2 ? { vent: true } : {}) }); }
    else movers.push({ x0: Math.round(c * 16), y0: (BASE - 1) * 16, x1: Math.round(c * 16), y1: Math.round((BASE - 3.5) * 16), w: SW * 16, period: period - 30, ph, style: 'brass', ...(i === 3 ? { crumble: true } : {}) });
  }
  b.def.movers = movers;
  for (const x of [6, W - 7]) b.d('brazier', x, BASE);
  b.e('skeleton', 8, BASE).e('zealot', W - 10, BASE).e('sorcerer', W - 6, BASE);
  for (const i of [1, 2, 3]) b.e('fireskull', Math.round(PADL + EDGE + i * gap) + (i === 2 ? 0 : i === 1 ? -2 : 2), BASE - r.i(8, 9));
  b.candle(4, BASE); b.candle(W - 5, BASE);
  const meta = { abilities: [...(spec.abilities || [])], back: spec.bridge ? ['djump'] : BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [], items: [], start: { tx: 4, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const v = validateMoving(b.def, movers, true); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };          // (the room's own snapshots also include every slab at the middle of its track)
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ THE FROZEN WELL
// Where the hero lands when the floor of the Rimewyrm's arena gives way: a deep shaft of ice with waterfalls pouring down its walls, and at the bottom a cave with a stream running over its floor, the wyrm's treasure
// in chests (the Key of Antimony, a hoard of gold, and one gem of each blade), and a door out.
function genWell(id, spec, r) {
  const W = 30, H = 46, BASE = H - 3, b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, horizon: BASE, interior: true });
  b.floor(0, W, BASE).ceil(0, W, 2); b.rect(0, 2, 8, 29).rect(W - 8, 2, 8, 29);          // the shaft runs down between two masses of rock (columns 8..21), into a cave that spans the whole width
  b.put(6, BASE - 1, TILE.SOLID); b.put(W - 7, BASE - 1, TILE.SOLID);                     // (stone sills hold the stream in)
  b.def.currents = [{ x0: 7 * 16, x1: (W - 7) * 16, y: BASE * 16, vx: 0.42 }];
  b.d('waterfall', 9, BASE, { top: -80, w: 20 }).d('waterfall', 20, BASE, { top: -80, w: 20 });
  for (const x of [10, 14, 18]) b.d('icicles', x, 2, { n: 3 }); for (const x of [4, 12, 17, 25]) b.d('crystals', x, BASE, { n: r.i(2, 4) });
  const chests = [[4, 'frostkey'], [8, 'hoard'], [11, 'e_ice'], [19, 'e_fire'], [22, 'e_sun']]; for (const [x, c] of chests) b.e('chest', x, BASE, { contents: c, id: 'well_' + c });
  if (spec.doorR) { b.door(W - 4, BASE, spec.doorR.to, 3, BASE, spec.doorR.kind || 'crypt'); patchDoor(b, spec.doorR); }
  b.def.meta = { abilities: [], entry: {}, start: { tx: 15, gy: BASE }, must: [{ tx: 4, gy: BASE, name: 'chest' }, { tx: 22, gy: BASE, name: 'chest' }, { tx: W - 4, gy: BASE, name: 'door' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ THE PIT OF DESPAIR (a short room after Baelphegaz)
function genDespair(id, spec, r) {
  const W = r.i(34, 38), H = 20, BASE = 12, P0 = 7, P1 = W - 8, n = 5, span = P1 - P0 + 1;          // (H: eight rows of nothing under the banks, so the pit looks deep: the darkness hides that it ends)
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme });
  b.floor(0, P0, BASE).floor(P1 + 1, W, BASE);                                                         // two banks and, between them, a pit with nothing at the bottom of it (no spikes: it just goes on)
  for (let k = 0; k < n; k++) { const len = 3, cx = P0 + Math.round((k + 0.5) * span / n) - 1 + r.i(0, 1), row = BASE - (k % 2 ? 3 : 1) - r.i(0, 1); b.plat(Math.max(P0 + 1, Math.min(P1 - len, cx)), len, row); }
  b.d('brazier', 4, BASE).d('brazier', W - 5, BASE).d('voidpit', (P0 + P1 + 1) / 2 - 0.5, BASE, { w: span * 16 });
  for (const [x, y] of [[P0 + 4, 4], [P0 + Math.round(span / 2), 6], [P1 - 4, 4]]) b.e('bat', x + r.i(-1, 1), y + r.i(0, 1));          // (a few bats)
  const meta = { abilities: ['djump'], back: ['djump'], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [], items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const g = new Array(W).fill(BASE), flatCols = []; for (let x = 0; x < W; x++) if (x >= P0 && x <= P1) g[x] = -1; else if (x >= 3 && x < W - 3 && Math.abs(x - 4) > 1 && Math.abs(x - (W - 5)) > 1 && (x < P0 - 1 || x > P1 + 1)) flatCols.push(x);
  decorate(b, W, spec, r, g, 0, flatCols);
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ LETOSNIK ABYSS (the fall beneath the Pit of Despair)
function genAbyss(id, spec, r) {
  const W = 34, H = 82, BASE = H - 3, TOP = 58, CX = 17;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, horizon: BASE, interior: true });
  b.floor(0, W, BASE).ceil(0, W, 2);
  const ph = r.f() * 6;                                                                                // the shaft: two masses of rock with ragged faces (the middle of it, columns 12..21, is always open)
  for (let y = 2; y < TOP; y++) { const jl = Math.round(Math.sin(y * 0.37 + ph) * 1.2 + Math.sin(y * 0.11 + 1) * 1.5), jr = Math.round(Math.sin(y * 0.29 + 2 + ph) * 1.2 + Math.sin(y * 0.13) * 1.5); b.rect(0, y, 9 + jl, 1); b.rect(W - 9 + jr, y, 9 - jr, 1); }
  b.rect(0, TOP, 1, BASE - TOP).rect(W - 1, TOP, 1, BASE - TOP);                                       // the cave beneath the shaft spreads right across the room
  b.rect(W - 9, BASE - 5, 8, 5);                                                                       // the raised ledge on the right, where the page lies
  b.plat(21, 3, BASE - 3);                                                                             // and a plank to get up to it
  b.door(3, BASE, spec.doorR.to, 3, 12, spec.doorR.kind || 'crypt'); patchDoor(b, spec.doorR);       // the way back up (to the start of the Pit of Despair)
  const chests = [7, 11, 14, 19]; chests.forEach((x, i) => b.e('chest', x, BASE, { contents: 'hoard', id: 'abyss_c' + (i + 1), secret: true }));
  const PX = W - 5; b.e('upgrade', PX, BASE - 5, { kind: 'page', n: 4, id: 'page4', secret: true });
  b.d('waterfall', 12, BASE, { top: -80, w: 18 }).d('waterfall', 21, BASE, { top: -80, w: 18 }).d('waterfall', 4, BASE, { top: TOP * 16, w: 16 }).d('waterfall', 28, BASE - 5, { top: TOP * 16, w: 16 });
  b.d('torch', 6, BASE - 4).d('torch', 25, BASE - 9);
  b.def.rivers = [{ x0: 16, x1: (W - 1) * 16, y: (BASE - 3) * 16, vx: 0.25 }];                        // the pool: three tiles deep
  b.def.meta = { abilities: ['djump'], entry: {}, start: { tx: CX, gy: BASE }, must: [...chests.map(x => ({ tx: x, gy: BASE, name: 'chest' })), { tx: PX, gy: BASE - 5, name: 'page' }, { tx: 3, gy: BASE, name: 'door' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ SHOP (the Keeper's stall)
function genShop(id, spec, r) {
  const W = 26, H = 14, b = new B(id, spec.name, spec.zone, W, H, { theme: 'chapel', ambient: 0.3, tint: [0.07, 0.0, 0.1], vig: 0.7, horizon: 12, indoor: true, music: 'shop', weather: 'dust' });          // (the Keeper's own theme: music/shop_keeper.mp3; the sanctuary's track plays if it is missing)
  b.floor(0, W, 12).ceil(0, W, 2).door(3, 12, spec.parent, 0, 12, 'wood');
  b.d('brazier', 8, 12).d('brazier', W - 6, 12); b.d('banner', 12, 2, { len: 6, color: '#3a1450' }).d('banner', 18, 2, { len: 6, color: '#3a1450' });
  b.e('shopkeeper', 15, 12, { id, tier: spec.tier || 0 });
  b.def.meta = { abilities: [], entry: {}, start: { tx: 3, gy: 12 }, must: [{ tx: 15, gy: 12, name: 'shopkeeper' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ THE STONE BRIDGE TOWER (the calm gate at the Prague end of the bridge, after the Cinder Warden: an altar to save at)
// A chain room like a waystone chamber (the road runs through it, left to right).  The Gothic gate tower (src/bridgetower.js) stands behind the road and the altar stands in its gateway: UP at the altar saves the game and
// restores health and mana.  A mason's scaffold of planks zig-zags up the front of the tower, past the statues, to a gallery under the rose window, where a hoard waits (a secret).  A tablet by the road tells the tower's story
// (nothing later than 1541: the game's own year).  The room is tall (28 rows), the ground at row 26.
function genGateTower(id, spec, r) {
  const W = 32, H = 34, BASE = 32, cx = W >> 1;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, music: 'save', save: true, horizon: BASE });
  b.floor(0, W, BASE);
  b.d('bridgetower', cx, BASE);
  b.d('cdl', cx - 2, BASE, { keep: true }).d('cdl', cx + 2, BASE, { keep: true }).e('altar', cx, BASE);
  b.d('brazier', cx - 7, BASE).d('brazier', cx + 7, BASE).d('img', 3, BASE, { img: 'town_lamp' }).d('img', W - 4, BASE, { img: 'town_lamp' }).d('img', cx - 11, BASE, { img: 'town_crates' }).d('img', cx + 11, BASE, { img: 'town_cart' });
  b.tablet(6, BASE, 'Charles the Fourth began this tower in 1357. Peter Parler drew it, and his masons carved its face. The kings of Bohemia rode under this arch on their way to be crowned. Saint Vitus stands between two of them, and I always thought he looked the most tired. Rest a while. The fire has not come into the passage.', 'tab23');
  // the scaffold: planks three rows apart, zig-zagging up the front of the tower to the gallery (row 8), where the hoard stands in the middle
  const steps = [[8, 3, BASE - 3], [12, 3, BASE - 6], [16, 3, BASE - 9], [19, 3, BASE - 12], [14, 3, BASE - 15]], GAL = BASE - 18;
  for (const [x, len, gy] of steps) b.plat(x, len, gy);
  b.plat(cx - 4, 9, GAL); b.e('chest', cx, GAL, { contents: 'hoard', id: 'vs_hoard', secret: true });
  const meta = { abilities: [], back: BACK[spec.zone], entry: { L: { tx: 1, gy: BASE }, R: { tx: W - 2, gy: BASE } }, must: [{ tx: cx, gy: BASE, name: 'altar' }, { tx: 6, gy: BASE, name: 'tablet' }, { tx: cx, gy: GAL, name: 'chest' }], items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: meta.entry.R };
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ THE COOPER'S CELLAR (a secret room under a house: a way in from above, and two doors)
// The hatch in the Cooper's House floor (drawn back by a lever) drops the hero into the middle of this room (see genInterior: def.dropTo).  On the left, the way out - a door back to the street, the one the house stands at - with a sign
// that says EXIT; on the right, a door to the Keeper's stall, with the same sign as every other Keeper's door.  Fixed size (the house names the tile he lands on).
function genCellar(id, spec, r) {
  const W = 28, H = 14, BASE = 12, XD = 4, SD = W - 5;
  const b = new B(id, spec.name, spec.zone, W, H, { theme: 'chapel', ambient: 0.32, tint: [0.12, 0.05, 0.01], vig: 0.7, horizon: 12, indoor: true, music: 'save', weather: 'dust' });
  b.floor(0, W, BASE).ceil(0, W, 2).torches([10, 19], 6);
  b.door(XD, BASE, spec.exitTo, 0, BASE, 'wood'); patchDoor(b, { tag: 'out', destTag: spec.exitTag });          // (a one-way door, like the ones that bring a branch back to its crossroads: it arrives at the street door of the house above, the door with that tag)
  b.door(SD, BASE, spec.shop, 3, BASE, 'wood');
  b.tablet(XD + 3, BASE, 'EXIT', 'sign_' + id + '_exit', 'cellarexit');
  b.tablet(SD - 3, BASE, 'THE KEEPER - SOMETHING IN THE DARK SELLS WHAT THE DEAD NO LONGER NEED.', 'sign_' + id + '_shop', spec.shop);
  b.e('barrel', 10, BASE, { drop: r.pick(['coin', 'coin', 'heart']) }).e('barrel', 17, BASE, { drop: r.pick(['coin', 'mana', 'heart']) });          // (a cooper's cellar: barrels)
  b.d('img', 11, BASE, { img: 'dg_crates', back: true }).d('img', 18, BASE, { img: 'town_crates', back: true }).d('img', 1, BASE, { img: 'dg_urn_' + r.i(1, 3), back: true }).d('img', 26, BASE, { img: 'dg_urn_' + r.i(1, 3), back: true });
  b.def.meta = { abilities: [], entry: {}, start: { tx: 14, gy: BASE }, must: [{ tx: XD, gy: BASE, name: 'door' }, { tx: SD, gy: BASE, name: 'door' }, { tx: XD + 3, gy: BASE, name: 'sign' }, { tx: SD - 3, gy: BASE, name: 'sign' }], items: [] }; b.def.entries = {};
  const v = validateRoom(b.def); if (!v.ok) return { ok: false, errs: v.errs, def: b.def };
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

// ------------------------------------------------------------------------------------------------ THE LAST DARK (the room before the Shadow Lord's: a pit that only the Ouroboros crosses)
// Rooms like this one are proved differently: the two platforms are checked as they are, and the crossing by simulateChain (a bot that chains jump, double jump and dash for ever) from several places on the first platform, with the jump button tapped and held.
function genChasm(id, spec, r) {
  const L0 = r.i(15, 18), PW = r.i(spec.pit[0], spec.pit[1]), R0 = r.i(14, 16), W = L0 + PW + R0, H = 30, BASE = 12, P0 = L0, P1 = L0 + PW - 1;
  const b = new B(id, spec.name, spec.zone, W, H, { ...spec.opts, theme: spec.theme, horizon: BASE });
  b.floor(0, P0, BASE).floor(P1 + 1, W, BASE).ceil(0, W, 2).pit(P0, P1 + 1);                           // two cliffs, and between them a pit with spikes at the bottom of it (unseen: the dark hides them)
  b.d('voidpit', (P0 + P1 + 1) / 2 - 0.5, BASE, { w: PW * 16 });                                       // (the scenery fades into black below the banks: see decor voidpit)
  b.d('brazier', 4, BASE).d('brazier', P0 - 4, BASE); b.torches([2, 8, P0 - 2], 6);
  b.tablet(10, BASE, 'There is no floor in the dark ahead, and no wall to lean on. Only the serpent that eats its own tail can cross it: strike, and leap, and leap again, and do not come down. I left it in the ice of the Glacier Road, where you were in too much of a hurry to look. I will be your light.', 'tabdark');                                                           // (her voice: it tells him what will carry him over, and where she left it)
  if (spec.doorR) { b.door(W - 5, BASE, spec.doorR.to, 3, BASE, spec.doorR.kind || 'crypt'); patchDoor(b, { ...spec.doorR, needs: 'ouroboros' }); }          // the way on to the Throne (the validator knows the door needs the Ouroboros)
  const meta = { abilities: ['djump', 'dash'], back: ['djump', 'dash'], entry: { L: { tx: 1, gy: BASE }, R: null }, must: [{ tx: 10, gy: BASE, name: 'tablet' }], items: [], start: { tx: 3, gy: BASE } };
  b.def.meta = meta; b.def.entries = { L: meta.entry.L, R: null };
  b.def.pitFade = { x0: P0 * 16, xm: Math.round((P0 + PW * 0.3) * 16), xd: Math.round((P0 + PW * 0.55) * 16) };
  const room = roomOf(b.def);
  for (const sx of [P0 - 1, P0 - 4, P0 - 9]) for (const hold of [false, true]) {
    const res = simulateChain(room, { x: sx * 16 + 8, y: BASE * 16, dir: 1, hold, stopX: (P1 + 3) * 16, stopY: BASE * 16 - 8 });
    if (!res || !res.over) return { ok: false, errs: ['the Ouroboros does not carry a hero across the pit (from ' + sx + ', ' + (hold ? 'held' : 'tapped') + ')'], def: b.def };
  }
  const sp = checkSpawns(b.def); if (sp.length) return { ok: false, errs: sp, def: b.def };
  return { ok: true, def: b.def };
}

const GEN = { chasm: genChasm, despair: genDespair, abyss: genAbyss, well: genWell, shop: genShop, gatetower: genGateTower, cellar: genCellar, gears: genGears, disco: genDisco, authored: id => ({ ok: true, def: authoredDef(id) }), corridor: genCorridor, tower: genTower, arena: genArena, sanctuary: genSanctuary, teleport: genTeleport, interior: genInterior };

// ------------------------------------------------------------------------------------------------ authored fallback + linking
function authoredDef(id) {
  const a = AUTHORED[id], def = { ...a, tiles: Uint8Array.from(a.tiles), spawns: JSON.parse(JSON.stringify(a.spawns)), decos: JSON.parse(JSON.stringify(a.decos)), doors: JSON.parse(JSON.stringify(a.doors)), seals: JSON.parse(JSON.stringify(a.seals)), exits: [] };
  // arrival pads = wherever the hand-built neighbours drop you; doorway rows = this room's own exits (the two can differ, e.g. the belfry's high exit)
  def.entries = {}; def.doorway = {}; for (const e of a.exits) def.doorway[e.side] = { from: e.from, to: e.to };
  for (const o of Object.values(AUTHORED)) for (const e of o.exits) if (e.room === id) def.entries[e.side === 'R' ? 'L' : 'R'] = { tx: e.tx, gy: e.gy };
  for (const e of a.exits) if (!def.entries[e.side]) def.entries[e.side] = { tx: e.side === 'L' ? 1 : a.w - 2, gy: e.to + 1 };
  return def;
}
function link(rooms, linked = new Set()) {
  for (const [a, sa, b, sb] of LINKS) {
    const A = rooms[a], Bd = rooms[b];
    if (linked.has(a + '>' + b)) { const da = A.doors.find(d => d.room === b), db = Bd.doors.find(d => d.room === a); da.tx = db.x; da.tgy = db.gy; db.tx = da.x; db.tgy = da.gy; continue; }     // joined by doors, not an open edge
    const ea = A.entries[sa], eb = Bd.entries[sb];
    const da = A.doorway?.[sa] || { from: ea.gy - 3, to: ea.gy - 1 }, db = Bd.doorway?.[sb] || { from: eb.gy - 3, to: eb.gy - 1 };
    A.exits.push({ side: sa, from: da.from, to: da.to, room: b, tx: eb.tx, gy: eb.gy });
    Bd.exits.push({ side: sb, from: db.from, to: db.to, room: a, tx: ea.tx, gy: ea.gy });
  }
  for (const id of ORDER) if (rooms[id] && (SPEC[id].kind === 'sanctuary' || SPEC[id].kind === 'interior' || SPEC[id].kind === 'shop' || SPEC[id].lair)) {
    const S = rooms[id], P = rooms[SPEC[id].parent], pd = P.doors.find(d => d.room === id) || P.doors[0];
    pd.room = id; pd.tx = 3; pd.tgy = 12; S.doors = [{ x: 3, gy: 12, room: P.id, tx: pd.x, tgy: pd.gy }];
  }
  for (const id of ORDER) { const R = rooms[id]; if (!R) continue; for (const d of R.doors) if (d.destTag) { const T2 = rooms[d.room], t = T2 && T2.doors.find(q => q.tag === d.destTag); if (t) { d.tx = t.arrive ? t.arrive.x : t.x; d.tgy = t.arrive ? t.arrive.gy : t.gy; } } }          // doors that arrive at a named door (the crossroads and the ways back to them)
}

// every transition must be walkable: the doorway rows are open on the leaving side, and the arrival spot is real standable ground
const GATES = new Set([TILE.SEAL, TILE.BARRICADE, TILE.CRYSTAL, TILE.CRACK, TILE.ICE]);
function checkLinks(rooms) {
  const errs = [], open = {};
  const ids = ORDER.filter(id => rooms[id]);
  for (const id of ids) { const d = rooms[id], t = Uint8Array.from(d.tiles); for (let i = 0; i < t.length; i++) if (GATES.has(t[i])) t[i] = 0; open[id] = surfaces(roomOf({ ...d, tiles: t })); }
  for (const id of ids) for (const e of rooms[id].exits) {
    const A = rooms[id], col = e.side === 'L' ? 0 : A.w - 1;
    for (let y = e.from; y <= e.to; y++) { const v = A.tiles[y * A.w + col]; if (v !== 0 && !GATES.has(v)) errs.push(`${id} ${e.side} doorway blocked at row ${y}`); }
    const S = open[e.room], T2 = rooms[e.room];
    if (S.id[e.gy * T2.w + e.tx] < 0) errs.push(`${id} -> ${e.room}: arrival (${e.tx},${e.gy}) is not standable`);
    const back = rooms[e.room].exits.find(x => x.room === id); if (!back) errs.push(`${e.room} has no way back to ${id}`);
  }
  for (const id of ids) for (const d of rooms[id].doors) { const T2 = rooms[d.room]; if (!T2 || open[d.room].id[d.tgy * T2.w + d.tx] < 0) errs.push(`${id} door -> ${d.room}: arrival not standable`); }
  return errs;
}

// ------------------------------------------------------------------------------------------------ the map
// The map is PACKED: rooms are blocks of cells that touch, with no space and no line between areas.  Every chain of rooms is a strip hung from the room its first room is entered from, on the side it prefers;
// side rooms (sanctuaries, houses, lairs) sit against their parent.  The packing itself is in maplayout.js; the map screen (MapScreen, ui.js) draws what it is given.
const MAP_SIDES = [[], ['right'], ['right'], ['above'], ['above'], ['right'], ['above'], ['above'], ['below']];          // where each chain (in the order of CHAINS) prefers to sit against its anchor: the Cistern below the bridge (required), the others wherever the whole map comes out biggest on the screen (found by trying every combination, on several seeds, among the layouts where every room touches another and every zone is one piece)
const MAP_FIRST = [8];          // (the Cistern and the Frozen Caverns are set against the bridge before the main row's side rooms: the Cistern lies UNDER Karluv Bridge on the map, as it does in the castle)
function layoutMap(rooms) {
  const ids = ORDER.filter(id => rooms[id] && !rooms[id].hidden), size = {}, zone = {}, parent = {}, anchor = {};
  for (const id of ids) { size[id] = mapCells(rooms[id]); zone[id] = rooms[id].zone; if (SPEC[id].parent) parent[id] = SPEC[id].parent; }
  CHAINS.forEach((c, ci) => { if (ci) { const p = PAIRS.find(q => q.b === c[0]); if (p) anchor[ci] = p.a; } });
  const pos = packMap({ ids, size, zone, chains: CHAINS, anchor, parent, sides: MAP_SIDES, first: MAP_FIRST });
  for (const id of ORDER) if (rooms[id]) rooms[id].map = pos[id] || (SPEC[id].parent && pos[SPEC[id].parent]) || { x: 0, y: 0 };          // (a secret room is not on the map: it takes its parent's place)
}

// ------------------------------------------------------------------------------------------------ the world
const cache = new Map();
// The whole castle takes several seconds to make (every room is generated and then proved passable), so it is made in STEPS, one room at a time: buildWorld() runs them all at once (tools, tests), and
// buildWorldAsync() runs them in slices between frames, so the title screen keeps moving while the castle is made behind it (see Game.prebuild).
function* buildSteps(seed, opts = {}) {
  seed = seed | 0; if (cache.has(seed) && !opts.fresh) return cache.get(seed);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), t0 = now();
  const rooms = {}, report = { seed, attempts: {}, fallbacks: [], errors: {}, version: GEN_VERSION };
  const isHand = () => false;                                // (there is no hand-built castle any more: every room but Market Street is generated, whatever the seed)
  const ends = {};                                           // the doors that join neighbouring areas
  for (const [k, kind] of Object.entries(DOOR_LINK)) { const [a, b2] = k.split('>'); (ends[a] ||= {}).doorR = { to: b2, kind }; (ends[b2] ||= {}).doorL = { to: a, kind }; }
  for (const p of PAIRS) { if (p.side === 'R') (ends[p.a] ||= {}).doorR = { to: p.b, tag: p.ta, destTag: p.tb, kind: p.kind, lock: p.lock, hint: p.hint }; else ((ends[p.a] ||= {}).mods ||= []).push({ t: p.mod, to: p.b, tag: p.ta, destTag: p.tb, kind: p.kind, label: p.label, hint: p.hint, lock: p.lock, gate: p.gate, key: p.key, wide: p.wide }); (ends[p.b] ||= {}).doorL = { to: p.a, tag: p.tb, destTag: p.ta, kind: p.kind }; }
  for (const [a, ta, b2, tb] of RETURNS) (ends[a] ||= {}).doorR = { to: b2, tag: ta, destTag: tb, kind: 'crypt' };
  let stepNo = 0;
  for (const id of ORDER) {
    yield stepNo++ / ORDER.length;
    let def = null; const e = ends[id] || {}, spec = { ...SPEC[id], ...e, mods: [...(SPEC[id].mods || []), ...(e.mods || [])] }, hand = SPEC[id].kind === 'authored';
    if ((spec.kind === 'interior' || spec.lair) && !(rooms[spec.parent] && rooms[spec.parent].doors.some(d => d.room === id))) continue;          // no door leads here in this world (a hand-built parent): no room
    // seed 0 is the classic castle: every hand-built room as authored (the rooms that were added later have no hand-built version, so they use seed 1)
    const useHand = isHand(id), tries = hand ? MAX_TRY : MAX_TRY * 6;
    if (!useHand) for (let a = 0; a < tries && !def; a++) {
      try { const res = GEN[spec.kind](id, spec, makeRng(seed, id, a)); if (res.ok) { def = res.def; report.attempts[id] = a + 1; } else (report.errors[id] ||= []).push(res.errs[0]); }
      catch (e) { (report.errors[id] ||= []).push('exception: ' + e.message); }
    }
    if (!def) {
      if (!hand) throw new Error('level generator could not build room ' + id + ' for seed ' + seed + ': ' + (report.errors[id] || []).slice(0, 3).join(' | '));
      def = authoredDef(id); report.attempts[id] = MAX_TRY; report.fallbacks.push(id);
    }
    def.id = id; if (SPEC[id].hidden) def.hidden = true; if (SPEC[id].areaLabel) def.areaLabel = SPEC[id].areaLabel; tidyRoom(def); arrangeCandelabras(def); rooms[id] = def;          // (candelabras are scenery: set them once the room's doors and loot are known)
  }
  const linked = new Set();
  for (const k of Object.keys(DOOR_LINK)) {
    const [a, b2] = k.split('>'), A = rooms[a], Bd = rooms[b2], da = A.doors.find(d => d.room === b2), db = Bd.doors.find(d => d.room === a);
    if (da && db) linked.add(k);
    else for (const [R, d] of [[A, da], [Bd, db]]) if (d) { R.doors = R.doors.filter(q => q !== d); R.decos = R.decos.filter(q => !(q.t === 'door' && q.x === d.x * 16 + 8 && q.y === d.gy * 16)); }       // only one side got its door (a fallback room): back to an open edge
  }
  report.doorLinks = [...linked];
  link(rooms, linked); layoutMap(rooms); report.linkErrors = checkLinks(rooms);
  const world = { seed, rooms, start: { room: 'v0', x: 12, gy: 12 }, order: ORDER.filter(id => rooms[id]), stones: ORDER.filter(id => rooms[id] && rooms[id].spawns.some(s => s.type === 'waystone')), report };
  report.ms = Math.round(now() - t0); cache.set(seed, world); if (cache.size > 6) cache.delete(cache.keys().next().value);
  return world;
}
export function buildWorld(seed, opts = {}) { const it = buildSteps(seed, opts); for (;;) { const r = it.next(); if (r.done) return r.value; } }
export const worldReady = seed => cache.has(seed | 0);
export function adoptWorld(seed, world) { cache.set(seed | 0, world); if (cache.size > 6) cache.delete(cache.keys().next().value); }          // (a castle made on the other thread)
export function buildWorldAsync(seed, onProgress, sliceMs = 6) {
  return new Promise((resolve, reject) => {
    const it = buildSteps(seed), tick = () => {
      try { const t0 = performance.now(); for (;;) { const r = it.next(); if (r.done) { if (onProgress) onProgress(1); return resolve(r.value); } if (onProgress) onProgress(r.value); if (performance.now() - t0 > sliceMs) break; } setTimeout(tick, 0); } catch (e) { reject(e); }
    };
    tick();
  });
}
// Where a hero who travels by waystone appears: beside the stone, on SOLID floor with room to stand - never over a pit.  [x in pixels] - tries the right side, then the left, then nearer and nearer, at last the stone itself.
export function arrivalBesideStone(def, w) {
  const at = (cx, ty) => (cx < 0 || cx >= def.w || ty < 0 || ty >= def.h ? 1 : def.tiles[ty * def.w + cx]);
  for (const off of [34, -34, 26, -26, 18, -18, 0]) {
    const x = w.x * 16 + 8 + off; let ok = true;
    for (const cx of [Math.floor((x - 6) / 16), Math.floor((x + 6) / 16)]) { if (at(cx, w.y) !== 1 || at(cx, w.y - 1) === 1 || at(cx, w.y - 1) === 3 || at(cx, w.y - 2) === 1 || at(cx, w.y - 3) === 1) ok = false; }
    if (ok) return x;
  }
  return w.x * 16 + 8;
}
export const randomSeed = () => 1 + Math.floor(Math.random() * 999999);

// ASCII picture of a room (for debugging / tests):  # solid  = one-way  ^ spikes  X gate  o entity  . air
export function ascii(def) {
  const ch = { 0: '.', 1: '#', 2: '=', 3: '^', 4: 'x', 5: 'X', 6: 'C', 7: '|', 8: 'I', 9: 'G' }, rows = [];
  for (let y = 0; y < def.h; y++) { let s = ''; for (let x = 0; x < def.w; x++) s += ch[def.tiles[y * def.w + x]]; rows.push(s); }
  for (const sp of def.spawns) { const y = FLYERS.has(sp.type) ? sp.y : sp.y - 1; if (rows[y]) rows[y] = rows[y].slice(0, sp.x) + (sp.type === 'candle' ? 'i' : sp.type === 'upgrade' ? '*' : sp.type === 'tablet' ? 'T' : sp.type === 'lever' ? 'L' : 'o') + rows[y].slice(sp.x + 1); }
  for (const d of def.doors) if (rows[d.gy - 1]) rows[d.gy - 1] = rows[d.gy - 1].slice(0, d.x) + 'D' + rows[d.gy - 1].slice(d.x + 1);
  return rows.join('\n');
}
export const _dbg = { GEN, SPEC, makeRng, validateMoving, CHAINS, PAIRS, ORDER, MAP_SIDES };
