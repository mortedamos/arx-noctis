# ARX NOCTIS

A gothic-fantasy, side-scrolling action-adventure for the browser, in the spirit of *Castlevania* and *Bloodstained*.
You are a nameless cloaked stranger with a sword, exploring a haunted castle: platforming, secrets, power-ups,
nine zones laid out as a branching map, fourteen boss fights (one of them optional), throwable items, waystone travel, and a three.js effects layer (fire, flickering candles, lightning, auras, mist). Text is set in two
free gothic typefaces (Morris Roman and Almendra, with Blackletter ExtraBold for the title and Eroded Motta for the gravestones) rather than a pixel font. The hero is Ansimuz's Gothic Hero (the hooded-warrior set is archived in `assets/archive/`), draped in an
experimental animated **white cloak** (a cloth hung from both shoulders that drapes behind him; Options > White Cloak turns it off, or start with `?cloak=0`).

## Play it

The game is **plain static files** - no server-side code at all - so it runs on any web host, **GitHub Pages included** (see below).
Browsers will not run ES modules from a double-clicked `index.html` (`file://`), so to try it on your own computer something has to hand the files over; a tiny local server does that:

* **Windows:** double-click **`play.bat`** (uses Node.js if installed, otherwise a built-in PowerShell server).
* **Anywhere with Node:** `node server.js` and open <http://localhost:8080>  (add `--open` to launch the browser).

No install step, no dependencies - three.js is vendored in `lib/three/`, so it also works offline.

### Putting it on GitHub Pages

1. Push the game folder to a GitHub repository (the `.gitignore` already keeps the downloaded art packs in `assets/sprites/source/` out - their licences do not allow redistributing them).
2. In the repository: **Settings > Pages > Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Open the address Pages gives you. Nothing else is needed: every path in the game is relative, so it also works from a sub-folder address like `https://you.github.io/arx-noctis/`.

Before you publish:
* `node tools/music-manifest.mjs` - rewrites `music/files.json` (a static host cannot list a folder; the game reads this file instead). Run it again whenever you add, remove or rename a track.
* `node tools/check-paths.mjs` - Windows ignores capital letters in file names but Pages does not; this checks that every file the game asks for is spelled exactly right.
* `.nojekyll` (already here) stops Pages from running Jekyll over the folder.

### On a phone: the Home Screen, and save files

* **Add to Home Screen.** `manifest.webmanifest` (name, icons in `assets/icons/`) and the service worker `sw.js` let the game be installed: on an iPhone, Safari's **Share > Add to Home Screen**; on Android, Chrome offers **Install** (and the SAVE GAME panel shows an INSTALL button when it can). It then opens full screen, like an app.
* **The music is kept.** `sw.js` stores each track and sound effect the first time the game fetches it, and plays it from storage on every later visit (about 60 MB, most of the download). It checks each stored sound against the server at most twice a day by its *size* (a HEAD request): a replaced track or effect is fetched again; GitHub Pages' ETags change on every publish, so they are not used. Everything else (page, code, pictures) still comes from the network first, so a new build shows at once; the stored copy is only for when the network fails. Raising `CACHE` in `sw.js` (`arx-noctis-1`) throws away everything stored, for every player.
* **Everything is fetched ahead of time, in the order it will be needed.** From the first tap, click or key press on the title screen, `src/loader.js` fetches every music track and recorded effect in the background: the hero's own zone first, then what every zone needs (the death sting, the sanctuary, boss and Keeper tracks), then the zones the doors and edges of the current room lead to, then the rest of the castle in the order it is met, and last the parts behind him. Three tracks come down at once at a low priority (so the music playing is never starved), the effects in a lane of their own. With the browser's data saver on, a 2g connection or a device that reports 2 GB of memory or less, it holds only the next few tracks (3, or 12). Nothing ever waits for it: anything not fetched yet streams, or plays its built-in stand-in. `window.__loader.plan()` shows what is still to come.
* **The service worker is off on localhost** (a stored sound would hide one just replaced with the Sound Browser). `?sw=1` turns it on there for testing; `?sw=0` turns it off anywhere. Turning it off also deletes what it stored.
* **Saves.** Safari on an iPhone erases a website's storage (the save!) after about a week without a visit, though not for a game on the Home Screen, which has storage of its own. So there are two kinds of save. **QUICK SAVE** (pause menu) and the altars write the game into the browser's storage (one slot); **QUICK LOAD** (title screen and pause menu) plays it. Quick save works wherever the hero stands, except in a boss fight, in the air or on a moving platform. At an altar, after the QUICK SAVE COMPLETE banner, a YES / NO question offers a save file as well (the cursor starts on NO). And **SAVE GAME** (pause menu) / **LOAD GAME** (title screen and pause menu) write the game to a **save file** named `ArxN Save <date> <time>.bin` (for example `ArxN Save 2026-11-19 20.30.bin`) and read one back, on any device: the file is the save's JSON, gzipped (about 1.5 KB for a finished game), written by a download or, on a phone, the share sheet (Save to Files). On an iPhone in Safari the title screen also says how to keep the save. The first save of each visit asks the browser to keep the game's storage for good (`navigator.storage.persist()`; the browser decides).

The published repository holds only what the game needs to run. `.gitignore` keeps `play.bat`, `play.ps1`, `server.js`, `tools/` (the launchers, the local server and the test scripts mentioned in this file), `assets/source/`, `assets/sprites/source/` (the art packs as downloaded) and `.claude/` out of it - they stay in the author's working copy.

## Controls

| Action | Keys |
|---|---|
| Move | Arrow keys / WASD |
| Jump (variable height) | Space / Z / K  - press again in mid-air once you own the **Aether Feather** |
| Attack (tap again for a 3-hit combo) | X / J  (works in the air too; the hero stays planted while swinging) |
| Alembic Strike (a slash beneath you) | in the air, hold Down / S + attack  - needs the **Alembic Strike**; one bounce off whatever it hits |
| Duck | hold Down / S  - shrinks your hitbox; you can slash while ducking (a low cut that skims the floor) |
| Drop through one-way platforms | Down / S  + Jump |
| Dash (invulnerable) | Shift / L  - needs the **Quicksilver Step** |
| Use the selected spell or item | C / I |
| Move the selection box (top of the screen) | Q (left) / V (right) |
| Use altar, read tablet, open chest, enter door, use a waystone | Up / W / E |
| Map (arrow keys scroll it) / Pause | M or Tab / Esc, P or Enter |
| Mute | N  (the game also pauses and mutes by itself when the window loses focus) |

A gamepad also works (A jump, X attack, B dash, Y use selected, bumpers move the selection, Start pause, Back map).

**Phones and tablets:** on-screen controls appear by themselves on a touch screen (and go away when a key is pressed). A round **D-pad** at the bottom left: slide a thumb round it to run, duck, or go up a door (up is also USE). **JUMP** and **HIT** are the big buttons on the right (they are also OK and BACK in the menus); **DASH**, **ITEM** (uses the selected spell or item) and the two small arrows that change the selection sit above them, and **MAP**, **MENU** (pause) and a full-screen square run along the top. Tap a menu item to pick it, tap the item box in the corner to change the selection, tap to advance a dialogue. Turn the phone sideways for a bigger picture (held sideways, the picture gives up some width so the controls only overlap its edges a little; on a squarer tablet the controls take a strip under it instead). Add `?touch=1` to the address to force the pad on (or `?touch=0` to keep it off); Options > TOUCH PAD switches it by hand. On the iPhone, "Add to Home Screen" runs the game full screen.

## The story

*Prague, Bohemia, 1541* - the year of the great fire of Prague. The Stranger - we never learn his name - is found kneeling at a grave on a hill above the city, in the rain: the grave of a woman who was his wife, his sister, his lover (the game never says). She died to
**Arx Noctis**, the castle that rose out of the countryside, took the **sun** and let the things of the shadow-realm walk the earth. As he kneels the city far below begins to burn. He rises, draws the sword **Silberzahn**
("the silver tooth") and goes down to it. Under his white cloak there is armour: a soldier's, or a monster-hunter's.

* **An opening scene** (once, at the start of a new game; any key skips it): rain, a tolling bell, the grave with a blue candle on it, the title card, the glow of fire rising over the roofs. It is a real room - **the Hill Above Prague**, west of Market Street - with a tablet of its own.
  Its music is the `intro` track.
* **The Cart Road** (`vt`, between the hill and Market Street): a gentle, slower place to learn the controls by playing - there are no signs. A low wall to jump (one tile), a barrel and two breakable statues to strike, a plank platform and a stack of crates (with a second platform beyond it) to jump up on, two slow zombies that rise from the ground as you come near, and a **carter** beside his broken wagon who presses a **bandage** into your hands (UP to talk). The hill's fences, trees and stones thin out on the left and the lamps and first house of the city come in on the right; the `intro` music carries on until Market Street. It is hand-built in `src/rooms.js` like the hill, and the carter's words are `[npc vt]` in `assets/dialogue.txt`.
* **Her ghost walks behind him** - pale, translucent, her lower half fading into nothing. She is invisible except in an **arcane (blue) light**: a waystone, a will-o'-the-wisp, a blue seal-flame, the candle on her grave, the **Ignis Vapour**
  lantern - which is HER: the pale blue wisp you carry once the Mire Mother falls follows where the ghost used to float, and from then on the ghost is no longer seen. **Every tablet and gravestone is her voice** (the stones are a headstone from the Graveyard 400 Assets pack, with flowers at their feet), lettered in the Eroded Motta font, in mixed case (it has no colon, so colons become dashes): advice about the road ahead, and what it is to be a ghost. She shows for a while whenever one speaks. (Signposts are only signs.)
* **The ending grows with the Pages** (`Ending` in `ui.js`, `src/farewell.js`). On the hill at dawn the narration is read, then she speaks: everyone hears her thanks and her sorrow for her father, each Page found in that game adds a line, a flower lies on her grave for each, and with all six she gives him back his name, he walks down toward the city and the narration calls him Wenzel. He never gives up the sword: it hums once at the very end. Short of six a card says how many were found; finishing does not overwrite the last save, so a player can go back for the rest. Her words are the `[farewell ...]` and `[ending ...]` sections of `assets/dialogue.txt`.
* **Speaking voices** (`src/voices.js`): while a speaker's words fill a dialogue box, soft hummed syllables play (sung vowels with a breath and a small room, not bare oscillators) - five to a voice, one note to each word, chosen by its letters (consonant-heavy words sound low, vowel-heavy ones high), never the same one twice running.  Speech appears at about seven words a second (`TEXT_RATE`), resting a little after a comma and longer after the end of a sentence (`typeStep`). The Lady's are high (her tablets too), the Stranger's deep, and each boss, kind of townsfolk and the Keeper has its own. A box with no name over it (signposts, doors, questions, the narrating stones) is silent. They follow the SFX volume and MUTE. To hear them one by one, and to compare the other sounds in `STYLES` (marimba, thumb piano, harp, felt piano, water drops, flute, glass): `http://localhost:8080/tools/voices.html`. Under every tone a boss speaks lies the same note an octave down (`bass`). The game plays the breathy flute (`style` in `voices.js`), four semitones lower than first made (`PITCH`).
* **When a boss's death lights a sigil, she comes and says where to go next** - to the other sigil, or to the door now open, and what the road there asks (`src/guide.js`; her words are the `[guide ...]` sections of `assets/dialogue.txt`).
* **Every boss speaks to the Stranger before the fight** (once), and some say a last word as they fall; the Shadow Lord's come just before the sun rises. The ending returns to the grave.
* **Alchemy, as Prague loved it.** The sun is the **Azoth**, the light that wakes it. The spells are **Sulphur** and **Vitriol**; the feather is **Aether**, the dash **Quicksilver**; the containers are the **Elixir Vitae** and the **Quintessence**;
  the whetstone is **Sal Martis**; the boss rewards are the **Salamander Mantle**, the **Ignis Vapour Lantern**, the **Lacuna Shard**, the **Perpetuum**, the **Alembic Strike** and the **Shoes of Hermes**; the thrown salt is **Sal Terrae**, the bandage **Panacea**.
  The six keys are the **Keys of Lead, Iron, Silver, Tin, Copper and Mercury** (the metals of the old planets; gold, the Sun, is what was stolen). The four stages of the Great Work - Nigredo, Albedo, Citrinitas, Rubedo - are the frame the text hangs on.
* **All the words are in one file, `src/story.js`:** the opening, her tablets, each boss's exchange and the ending. Edit it freely - it is plain text in capitals, nothing else needs to change.

## The game

* **9 zones in a branching castle - one look per zone.** The story is set in **Bohemia**; you begin in its capital, **Prague**. A level never mixes tilesets; each look gets its own level.
  It is a graph, not a corridor: after the Graveyard the way splits at **the Three Roads** (a crossroads with a waystone) by **the Lower Road** into the **Weeping Mire** (a door high on a ledge - it needs the Double Jump - leads to a long way down; the Mire ends at the Mire Mother, whose arena is walled in by blue fire at both ends until she dies; beyond it **the Weeping Falls** drop a short way among waterfalls to two pools and a signpost - a **waystone** to the left, a **save shrine** to the right) and the **Great Hall** (the Gate of Arx Noctis has just this one door into the keep). Between the Entrance Hall and the Portrait Gallery lies **the Warder's Chamber** (one screen: a cot, a table, a stand of arms, and an iron grate in the floor with a lever beside it). Draw the grate back and drop through into **the Oubliette**: four screens of walls and planks of bone, full of skeletons, to the door of the **Moonlit Chapel** at the bottom, down in the lower levels of the keep, sealed until the masters of the Hall and of the Frozen Caverns are dead (the way to them is in Prague, through the Cistern under Karluv Bridge - see below). There is no climbing out through the grate: **half way down, a way out to the left leads to a waystone** (the Waystone Undercroft). The Oubliette plays the Crypts' music. The Chapel leads to a second crossroads, **the Crossing Hall** (now four short places: the Crossing Waystone, the Barricaded Gallery, the Throne Approach - with **the Black Stair** climbing from it - and the Archive Passage - with **the Index Stair** up to the Library), where the way splits again into **the Crypts**
  (barricaded: burn it) and the **Shadow Throne** (sealed by crystal - Thunder - and by the Crimson Count and the Hierophant). The **Clockwork Dungeon** is not on the crossroads at all: its way in is back in **Prague** - a locked door high above Smouldering Lane (it needs the **Key of Tin** from the top of the Bone Stair, and the double jump) leads up **the Orloj Tower** (Smouldering Lane is a tall street, and the tower itself - a pixelated picture of the real Prague Orloj tower - rises behind that door), where the great astronomical clock hangs in a shaft of turning cogwheels (with a few faded, animated gear clusters from the Animated Gears pack among them) and swinging pendulums, and the door to the Clockwork Dungeon stands on the landing beside it. You must go back for it. Every door at a
  crossroads has a signpost, every branch ends in a door that drops you back at its crossroads (the Great Hall's ends instead at the top of the Belfry, where a way out to the left leads to the Waystone Belfry), and the order in which you do the branches is yours. `tools/test-world.mjs` proves, for every castle, that it can be finished
  and that each of those locks really needs its key. Open room edges (marked by a small arrow on the screen edge), **doors** (UP) and fade transitions connect the rooms; the zone name appears when you cross into a new one.
  **The map is the geography of the world** (`src/maplayout.js`): every room is a block of cells, up on the map is up in the world, and every way from one room to the next is drawn level, one doorway meeting the other; it sprawls, and you scroll about it. Branches go the way they go in the world: the Moonlit Chapel and the Crypts lie in the lower levels of Arx Noctis (below the Great Hall, at the foot of the Oubliette), the Mire lower still down the Lower Road, the Pier Falls and the Cistern under Karluv Bridge, the Frozen Caverns deepest of all far below the Cistern, the Library and the Shadow Throne high above up their stairs, and the Clockwork Dungeon on up from the Orloj Tower. A room shows its doors as small marks where they really are (gold = door, blue = one-way, violet = the Keeper, red = save, cyan = waystone) and a gap in its wall where it opens onto the next room; the room under the cursor is framed, its zone's name is written over it (no other zone is named), and the panel below lists where it leads. The arrows move the cursor from room to room. **Zoom** with the mouse wheel, the + / - keys (or PageUp / PageDown, or a controller's shoulder buttons), or the two buttons at the corner of the map (a tap works too); X (Jump on a phone) flips between the whole castle and the last zoom. The small rooms off a two-floor room stand where their doors are: over it for a door upstairs, under it for a door on the floor (the Hall of Shadows' Last Sanctuary is drawn over it though its door is downstairs). `node tools/test-map.mjs <seed>` checks that no rooms overlap, every room touches another and every zone is one piece.
* **The Bell Tower and its Descent** - the Bell Tower (a climb with a fire chasing you, a **max HP up** on its top landing and the hidden bell) lets out onto the top of **Bell Tower Descent**, exactly as tall, which takes you back down to street level and out into the Burning Square. A stretch of cracked floor at its foot gives onto **the Bellfounder's Cache** below: one room, a hoard, and a door back up.
* **Cracked floors** (TILE.FLOOR) give way only to the **Alembic Strike** (jump over them, hold down and attack; the floor breaks where the blade reaches or where he comes down). Besides the Cache, the **Cooper's House** has one over the cellar (it used to be a hatch with a lever), and six corridors hide a **floor cache** - a hollow with a hoard and a plank to climb out by (`FLOOR_CACHES` in `levelgen.js`: Grave Hollow, Mire Edge, the Bell Gallery, the Ossuary, the Escapement, the Frozen Gallery). The strike comes from the Seraph of Ash, so these are things to go back for.
* **The top of the Stone Bridge Tower** has a second hoard on a plank on its roof, with nothing leading to it: only the **Ouroboros** gets there, flying up by jump, double jump and dash again and again.
* **The ways down** (`genShaft` in `levelgen.js`): the Bell Tower Descent, the Pier Falls, the Lower Road, the Oubliette, the **Freezing Deep** and the **Black Ice Falls** are built of ragged ledges, each with one way down - an opening at the left, at the right, or a gap in the middle, never under the one above - so you cross every level and cannot find a wall and drop past it all; some levels are S-bends, with a hump of rock to climb over between where you land and the way down (spiked stubs jut under the side openings). Planks in each opening let you climb back. The two freezing ways, from the Cistern's wall of ice down to the Frozen Caverns, have water running along every floor that carries you toward the way down and pours from each lip to the floor below, a deep pool at the foot that **chills** you, and icicles that fall. The Frozen Caverns are painted as an ice cave (wrapping noise: rock masses with ice on them, icicles, frozen falls, crystals, near teeth of rock - newzones.js). The Oubliette's walls and planks are heaps of bone - long bones at every angle, tipped skulls, ragged edges (boneHeap / boneRaft in world.js).
* **Karluv Bridge** - after the Burning Square and before the Graveyard road, a short run over the Vltava: a medieval stone bridge on round arches, with saints along its parapet, broken spans and stepping stones over the river (a fall is the river), and a cracked wall hiding a heart container. It is the castle's open-air platforming level and is built for a single jump. The river is water drawn by the effects layer (the same shader as the Cistern's streams and waterfalls). **Its planks hide the way into the Cistern and, beyond it, the Frozen Caverns:** four planks in the deck give way to DOWN + JUMP, and whoever falls must break the fall with a double jump and a dash to reach a ledge under the next arch, where a door in the pier leads into **the Pier Falls**: a narrow drop inside the pier, ledge to ledge, with a wading pool on every ledge and on the floor, water pouring into each, and Grief Wraiths haunting the lower half. A door at its foot opens into the Waystone Culvert and **the Cistern** (so it needs both, and the Cistern is met after the Great Hall, whose master gives the dash). Beyond the Drowned Warden's Flooded Gate lie a second waystone and **a wall of ice that only the fire spell melts** (Sulphur, which the Drowned Warden, master of the Cistern, gives; a thrown torch does nothing to ice); past it are **the Frozen Caverns**, whose far end drops you back on the bridge. The monsters and bosses of each zone are tougher than those of the zone before on this path (see ZONE_HP and BOSS_K in game.js).
* **No two boss fights go the same way.** Each boss rolls a mood per fight (which attacks it favours), never repeats either of its last two attacks, reads where you are (close, far, in the air), sometimes pauses long and sometimes chains an attack straight on (more often in the second phase), and grows impatient when nearly dead. Every attack is still telegraphed. The **Shadow Lord** keeps his skull volley for the second half of the fight.
* **Baelphegaz, risen** (the Hall of Sorrow, between the Hall of Shadows and the Last Dark): the master has raised him, grey-purple and quicker, to feast on the Stranger's sorrow. The floor is bare. **Every wound makes him bigger**, until he stands just over what a double jump reaches (so a charge is cleared by bouncing off him with the Alembic Strike, by a dash at the top of the jump or with the Ouroboros - or dashed through). He charges, breathes soulfire, leaps, **blinks** behind you in purple flame, sends wisps after you, and in the second half walks pillars of fire across the floor. He leaves a max HP up.
* **The wisp is her.** Besides lighting the way, the Ignis Vapour keeps close when you stand still, darts ahead of you when you are hurt, gutters when your life is low, sighs now and then and trails a thin veil of light.
* **Prague is calm at dusk - until the Cinder Warden arrives.** The village starts as a violet dusk with the monsters already loose; as you start up Smouldering Lane, the first street beyond the Waystone Square, a short scene plays (you cannot move or strike, and the monsters
  freeze): the Warden steps out of the dark, hurls three torches that set the houses alight one by one, turns to look at you, and vanishes in flame. From then on Prague burns (Market Street too).
* **Moving gears.** The Clockwork Dungeon has brass-and-iron rooms and a background of gears behind gears, from ones half a hero tall to ones the size of the room. In **the Great Gear** you cross a pit on the *teeth* of three great turning
  wheels: every tooth on a wheel's upper side is a moving one-way platform that carries you with it - ride one up, over and down, and hop to the next.
* **Flowing water.** In the Cistern streams of water run along the floor and **carry the hero** the way they flow (wading: fully; in the air: a little), under waterfalls; the Drowned Warden keeps the gate at the end, and gives **fire** (the Ember); the Seraph of Ash in the Chapel leaves the **Alembic Strike**:
  jump, then hold **down** and **attack**, and he slashes in an arc beneath him (it does a sword's damage and breaks what a sword breaks). If it lands on a foe, a barrel, a statue or spikes it **bounces** him back up and gives back the double jump and the air dash - **once** only until he touches the ground again. (It replaced the Aqua Regia; a save that had that now has this.)
* **The Disco.** A joke room off the Nave's upper floor: skeletons dance in the background, at three depths, under sweeping coloured spotlights and a mirror ball, to a track of its own. The **Shoes of Hermes** (+10% movement speed) wait at the far
  end. When you reach the middle of the floor the music dies with a record scratch, every skeleton stops and turns to look at you, and the lights swing round to find you. Come back later and the room is dark and empty.
* **Every boss leaves a power-up.** The four bosses that used to leave a heart or mana container now leave something that changes how you play: the **Cinder Warden** the **Salamander Mantle** (fire hurts half as much and soot never
  stains the cloak), the **Mire Mother** the **Ignis Vapour Lantern** (a wisp follows you - it lights the dark, clears the fog around you and draws loot from much further off), the optional **Reflection** the **Lacuna Shard** (your sword
  knocks arrows, bones, orbs and thrown items aside so they harm no one) and the **Hierophant** the **Perpetuum** (your dash recharges twice as fast). The other bosses already give a power (double jump, dash, Ember,
  Thunder, the Alembic Strike, the Azoth). The containers they used to carry are now on a high ledge in Prague, in a hidden cell in the Portrait Gallery and in two new locked vaults (below).
* **Keys and locked doors.** Six doors are **locked** - a padlock and chains are drawn over them, in the colour of their key - and lead to optional **vaults** (the Gravekeeper's, the Steward's, the Verger's, the
  Ferryman's and the Engineer's) with a chest inside - and to the **Orloj Tower**, which is not optional.  (The Count's Treasury, once locked, is open.) Each key is found earlier in the same zone: in a chest in a hidden cell of the Iron Gate, at the top of the Belfry Stairs, in a chest in the Nave, at the top of the Bone Stair, in a cell
  of Mire Edge, in a barricaded cell of the Escapement. Walk up to a locked door and press
  Up: without its key it tells you which one it needs; with it the door opens for good (the key is used up). Vaults are optional, and the Key of Tin lies on the way through the Crypts, so no key can ever lock you out of the game - `tools/test-world.mjs` proves every key is
  reachable and every locked door is shut without its key.
* **The pause screen shows what you have found:** the four powers (dim and unnamed until you find them), the Shoes of Hermes, the Alembic Strike and the rest once found, and the keys you carry. (They are no longer on the main screen.)
* **Breakable things glow faintly** - barrels and crates (in the colour of what they hold), cracked walls (lilac), barricades (embers) and crystals (ice); statues, which hold treasure, glow a little more.
* **Scenery stands on the ground.** On levels drawn over a parallax picture nothing hangs in the air: wall torches become braziers on the floor (fewer of them, clear of doors), barred windows are gone, and every framed portrait - painted
  or haunted - hangs on a freestanding pillar. Banners stay: they are fixed to the ceiling. (Towers have a brick shaft that does not slide, so they keep their wall torches.)
* **The mire's upper floors** (Weeping Hollow, the Drowned Boardwalk; `swampUpper` in `levelgen.js`) are broken country: gaps, wide ones crossed on planks, hills, hollows, still pools, high planks, and **spills** - a trough of running water that pours over its lip through a hole to a pool below, and carries you with it if you stand in it.
* **Two floors.** Seven of the generated areas (Iron Gate, the Mourning Fields, Weeping Hollow, the Drowned Boardwalk, the Entrance Hall, the Nave, the Hall of Shadows) are tall rooms with a lower floor and an upper floor: a staircase of one-way platforms climbs to the upper floor, which has its own gaps, blocks and loot, and comes down again at the far end. Four of them hide a **door on the upper floor** to a small room of its own (the gravedigger's shed, the fisherman's hut, the servants' quarters, the scribe's study).
* **Waystones (teleport rooms).** Every zone opens with a *waystone chamber*, a calm room with a glowing stone. Walk up to attune it, then press
  **Up** at any attuned stone to open the map: the choice starts on the stone you stand at, and the arrows (or the D-pad) move it to the waystone lying that way
  on the map - the opposite arrow takes a move back. Press Enter to travel there (Esc cancels). Waystones are not save points - altars still are. Which ones you have found is part of your save.
* **Throwable items** (top-right of the screen, beside your spells; **Q / V** move the selection box, **C / I** uses what is selected). They are
  found lying about, in statues and barrels, dropped by enemies and left behind by bosses. Each can be found again and again and adds to your stack, up to its limit:
  **throwing dagger** (fast, weak, up to 30), **torch** (sets a foe ablaze for
  damage over time, and burns wooden barricades, 10), **magic arrow** (a dagger that homes in on the nearest foe, trailing white sparks, 20 - caltrops are gone), **Sal Terrae**
  (a handful of salt thrown in a low arc: the grains bounce, roll and drop off ledges, and whatever stands where they come to lie is hurt, the undead most, 6) and **bandages** (heal a third of your life, at most 3 - and not usable at full health).
* **Houses and people.** Three houses on Market Street and one on the lane can be entered (UP at the door - the shop sign hangs over the ones that matter). Inside, calm villagers stand about or amble slowly. **Talk to anyone with UP** (a little arrow appears over everything you can use): street villagers cry out and press a gift into your hands the first time; the people indoors and in the small rooms give you something too - or **sell** it. A merchant makes an offer; if you can pay, a YES / NO box asks (LEFT / RIGHT or the d-pad to choose, ENTER / A to answer, ESC / B means no); if you cannot, he tells you to come back. Coins (15 each, 50 for a gem) are the money; a merchant has three of a thing to sell and will not sell what you cannot carry.
* **Barrels and crates** shatter in one hit for a small treat; the larger **statues** still take 2-3 hits and pay 2-3 items - they glow softly (gold; rose or blue when a heart or mana is inside) so you can tell a treasure statue from the scenery.
* **The air moves.** The swish of your sword (and your dash) flings smoke, embers and fog along its path and bends nearby flames away. **Rolling ground fog** lies in the graveyard's hollows, the swamp, the nave and the Hall of Shadows: thick, wispy and translucent, it hides most of what is in it and parts where you cut through it.
* **Will-o'-the-wisps** drift through the Weeping Swamp: cold blue lights that float in and out of the background, shed real light and thin the mist wherever they go. You can never get near one - it bolts away into the background, and winks out if you keep coming.
* **Portraits** hang on the walls of the halls, chapels and the throne room - painted faces (fifteen people, five moods each, pixelated to 26x33 by `tools/pixelate-portraits.ps1`) in gilt, oak, silver, bronze or ebony frames. **Some are haunted.** They begin with a hopeful face, but as you walk up to one the picture turns - happy, neutral, sad, furious - and then it wakes and fights: some **spit fire from their eyes** (the eyes burn first), some release **wisps of blue fire that follow you** (cut them down with the sword), some **tear off the wall and fly at you**, and some fly *and* shoot. Until one wakes it cannot be hurt, and it cannot hurt you.
* **Waterfalls** pour through the tall rooms of the Weeping Swamp - from the sky, through the holes in the upper floor, down to the lower one - with spray where they land.
* **Hazards are always seen:** spikes are drawn again above the fog and the dark, and live only at the bottom of pits. Nothing stands in front of a door.
* **Candelabras** are scenery now (indoors only - never in the graveyard or the mire): they flank doors and waystones, stand beside tablets and at the foot of walls and steps, and are spaced along the floor - never on top of loot.
* **21 monster types:** bats, rising zombies, bone-throwing skeletons, phasing ghosts, orb-casting wraiths, charging fire skulls, hell hounds,
  burning ghouls and teleporting dark wizards - plus **bone / frost / ember wyrms** (skull-headed serpents whose whole body follows
  the head; they gape and rear back before they strike - a clean hit breaks the attack - and the ember kind spits fire),
  **swamp spiders** (they squat before they spring), **swamp things**, blue-robed **acolytes**, staff-wielding **archmages**, bronze-robed **brass sorcerers** (fire-hurling casters who slip away when you close in), red-robed **zealots** (Szadi's sickle fighter: he plants his feet, then lunges through a slash) and the **haunted portraits** on the walls.
* **10 bosses** with two phases each (one is optional: the **Reflection**, below; the Crimson Count now rules the Crypts and leaves Thunder): the Cinder Warden (the village's keeper - ember volleys, a staff slam, a leap, flame pillars once he is hurt; he leaves a heart container), Baelphegaz (his fire breath is an arch of flame from his head to the floor - stand under it, or stay clear of where it lands), the Mire Mother (a floating head of tentacles: marked holes in the ground, spore fans, spider summons; she leaves a mana crystal), the Phantom Steed, the Seraph of Ash, the Brazen Hierophant (master of the Clockwork Dungeon: he rises, then crashes down), the Drowned Warden (a blue many-armed thing over the flooded gate: tidal waves, water orbs, geysers, and a dive that comes up somewhere else), the Shadow Lord, and
  the optional **Reflection**: a second door on the upper floor of the Entrance Hall opens on the Mirror Room, where a great gilt mirror hangs on the back wall and shows you, mirrored, doing whatever you do. Walk in front of it and meet your reflection in the middle: the glass
  cracks and your reflection crashes out of it in silver and violet, with red eyes. It fights with a sword (a two-blow combo, three in the second half), a **shadow dash** that cuts as it ends, a leap,
  and the same items you carry: **daggers** (duck under them), a **torch** and **salt**, violet (lobbed at where you stand: the landing spot is marked) and a homing **magic arrow**
  (cut it down, or outrun it) - and it binds its wounds with a **bandage** when it can find a quiet moment: that is your opening. It leaves a mana container. Every attack is telegraphed: an **icon and name** appear over the boss about a second before it
  acts, then a coloured aura, a warning sound and a **danger zone** (charge lane, breath sweep, landing marker, slam
  area, lightning/flame columns) show during the windup. The boss is open to counter-attack after each move.
  Turn the icons/names off in Options > Boss Hints if you want a purer challenge (zones and sounds stay).
* **Metroidvania progression:** Double Jump (Aether), Quicksilver Step (dash), Sulphur (fire - burns barricades) and Vitriol
  (lightning - shatters crystal). Several secrets (Elixirs Vitae, Quintessences, Sal Martis) are only reachable once
  you own the right power, so backtracking pays off. Levels, XP and item drops included. **Stone statues** are the breakable
  treasure: 2-3 sword hits to shatter, paying out 2-3 items instead of one, and they stand about 2.5x less often than the
  old candles did. Candelabras are scenery only.
* **Sword enchantments:** enemies (and more often bosses) sometimes drop a glowing rune that imbues your blade for a minute -
  **Flame Blade** (10% more damage, and every slash shoots a short fireball for 25% of a bare blow: together, what Sunbrand does), **Frost Blade** (15% more, a chance to freeze foes for 1-3 s; rarer and
  shorter on bosses, with a thaw immunity so nothing can be stun-locked) and **Sunbrand** (35% more, glowing aura). The same rune
  again adds a minute, up to a fresh one's length plus a minute.
* **Temporal Seals:** the prize in each of the four puzzle rooms. Each makes a sword enchantment last **20 seconds longer** (2:20 with all four, 3:20 at most), and adds the 20 seconds to one already running. Numbers: `TUNE` in `enchant.js`.
* **A different castle every game:** the rooms are generated from a seed (see below), but every room is *proven*
  beatable before you ever see it.
* **The white cloak remembers.** Fire singes it grey-black, filth (zombies, swamp things, thrown bones) dirties it brown, and teeth, claws and spikes
  splash it red - a little per hit, patchiest at the hem. Stains fade by themselves over a minute or two, and **rain washes them off**: stand out in
  the rain (the graveyard) or the snow (the frozen caverns) and they run off in seconds.
* **Water.** Standing in water, the hero runs at **half speed** and jumps **half as high**. There is water in the Weeping Swamp's corridors (now and then a **pool**: a one-tile hollow in the
  ground, three to five tiles wide, with a step down and a step up), in the Cistern's flowing channels (which also **push you along** the way they run) and on the floor of the Drowned Warden's arena,
  a sheet of still shallow water until the Warden heaves the **tide**: for a few seconds the whole flood runs one way, or the other (a lane on the water shows which way, just before). Water is drawn by the
  three.js water shader (`fx.js`); the physics are in `Player.waterAt` (`player.js`). In the Freezing Deep and the Black Ice Falls the water running along each ledge **carries you over its edge**
  if you stand in it (walking upstream still works).
* **The Library's secret (spoiler).** Nothing in the game points to it. One bookcase on the ground floor of the Spiral Stair (the right-hand one) breaks at the third blow and shows a door to **the Book Nook**, a warm little room with a fire, a cat and a lever.
  The lever slides a bookcase aside in **The Stacks**, and behind it is **the Sealed Archive** with a Sal Martis. Until each is found, its door is not drawn, cannot be used and is not on the map (`hiddenDoor` in `levelgen.js`).
* **Puzzle rooms (spoilers).** Four single rooms off the vertical ways and the gallery, each with levers and a chained chest holding a Temporal Seal. Every lever is either off (red) or on (green); each pull throws it over and works its rule (candles it puts out, lights, then toggles). **Every third pull that does not solve it summons one of the area's monsters.** The rules and monsters are in `puzzle` of the room's entry in `levelgen.js`,
  and `tools/test-world.mjs` proves each puzzle can be solved from wherever the levers can bring it.
  * **The Winding Room** (half way up the Mainspring Shaft): levers 1 and 3 each toggle two of three candelabras and lever 2 only the middle one; light all three. The middle one starts lit, so the third lever does it, and nothing else will (pulls of the other two have to be taken back).
  * **The Vestry** (the Barricaded Gallery): four altar candles; the soot on the wall shows that the second and fourth should burn. Lever 1 lights 1 and 2 and puts out 3; lever 2 puts out 2 and 3 and lights 4; lever 3 toggles 1. From all dark: levers 2, 1, 3.
  * **The Wisp Causeway** (the Lower Road): four bog vents; the carved stone shows 1, 3 and 4 burning and 2 not (sludge covers the lock while it does). Lever 1 toggles 1 and 2; lever 2 lights 2 and puts out 3; lever 3 toggles 3 and 4; lever 4 puts out 1 and toggles 4. From all dormant: levers 2, 1, 3.
  * **The Glacial Lattice** (the Black Ice Falls): a beam through three lenses, clear or frosted, must light both side crystals and miss the node: lenses 1 and 3 clear, 2 frosted. Lever 1 toggles 1 and frosts 2; lever 2 toggles 2 and 3; lever 3 clears 1 and toggles 3. No start needs more than two pulls.
* **Save altars** (candle shrines in small sanctuary rooms) heal you and save to the browser's localStorage.
  Dying returns you to your last altar.

## Procedural castle

Each new game builds its castle from a **seed**: the zones, boss order, abilities, save sanctuaries and secrets are always
where they should be, but every room's insides are re-rolled - ground height, pits, bridges, spike runs, steps, ledges,
the layout of the climbing towers, arena platforms, where the enemies stand and where the statues, barrels and scenery go. (The opening Market Street
  is hand-built and the same every time; everything else is generated, whatever the seed.)

* New game = a random seed.  **New Game** on the title screen opens a keypad drawn in the game where you can pick one (press BEGIN with nothing typed for a random castle): click or tap the numbers, move
  the cursor with the arrow keys or the controller's D-pad and press OK, or just type the digits (the same seed always builds the same
  castle, so you can share them).  `?seed=1234` in the URL also works. (A save made before the castle's layout last changed wakes at the start with everything it carries.)
* The seed is shown on the map and pause screens and is stored in your save, so Continue always loads the same castle.
* **Nothing impossible ever ships.** Each generated room is simulated with the game's *real* movement code (same physics
  constants and collision routines as the player - checked jump-for-jump against the live player): a search over
  every jump / double jump / dash the player can make must prove that
  entrance and exit connect **both ways**, the save door, altar and lore tablets can be reached, ability secrets
  (e.g. the Double Jump ledges, the dash gulf) need exactly the ability they're meant to, sealed cells open only once their
  gate is destroyed, and nothing spawns inside a wall. Doorways between rooms are checked too. A room that fails is
  re-rolled (usually 1-2 tries); if it somehow can't be fixed it falls back to its hand-built version.
* Generating a castle takes about half a second.

## Music

Put your tracks in **`music/`** and list them in **`music/TRACKLIST.txt`**.
That file is both your to-do list (each track has a mood description *and a Suno prompt*, all sharing five recurring
leitmotifs) and the config the game reads: each line maps an ID to a file name. (TRACKLIST.txt is **not published**: it is in `.gitignore`. Run `node tools/music-manifest.mjs` before a publish and it copies the track lines into `music/tracks.txt`, which is what the published game reads.) Missing tracks are skipped silently,
so you can add them one at a time and just refresh - except that a **level** (or boss) with no track of its own plays one of **`general_track_1` ... `general_track_4`** instead, picked at random (the final boss and the second boss theme try the ordinary boss track first; stings, the title, intro and ending never borrow one). `.mp3`, `.ogg` and `.wav` all work. Edit the FILE NAME column to
point a track at any file (spaces and brackets are fine).

## Project layout

```
index.html          page + canvases (2D sprite canvas with the three.js effects canvas stacked on top)
manifest.webmanifest + sw.js   the Home Screen app and the stored music (see "On a phone" above); icons in assets/icons/
server.js           zero-dependency static server for local play (+ a live /__music file listing; not needed on GitHub Pages)
 credits.txt        what the title screen's CREDITS option shows (plain text, yours to edit)
play.bat / play.ps1 Windows launchers
src/
  main.js game.js   boot + the game state machine, room loading, combat, bosses, rendering
  stain.js          cloak stains: what singes / dirties / bloodies the cloak, and how fast they fade or wash off
  player.js         the stranger (movement, ducking, sword, dash, spells)      cloak.js   the white cloak: a hanging cloth drawn behind the sprite
  slash.js          the sword swipes: the crescent painted on three attack frames is cut out of the sprite at load (assets.js) and drawn back in three.js, in the same shape, sweeping, streaked and fading, in the enchantment's colour
  enemies.js        regular monsters + the wyrms      beasts.js   villagers, swamp creatures, cultists, zealots
  bosses.js         the nine bosses + telegraphed hazard columns
  guide.js          where the Lady says to go next when a sigil is lit
  farewell.js       her farewell in the ending, by the Pages found
  voices.js         the speaking voices: soft notes while a speaker's words appear
  mirror.js         the Mirror Room: the mirror (frame, glass, cracks) and the items the Reflection throws
  items.js itemdata.js   throwable items: the data (limits, pack sizes) and the thrown objects / effects
  salt.js           Sal Terrae in three.js: each grain a tiny cube that tumbles, bounces, rolls, falls off ledges and rides moving platforms; where they lie is where they harm
  projectiles.js    fireballs, bones, shockwaves, fire patches     props.js   pickups, statues, barrels, altar, waystones, relics
  world.js          tile themes (auto-tiled from the tilesets), parallax backgrounds, collision queries
  rooms.js          Market Street, the builder DSL (B), the zone table (ZONES) and the old hand-built rooms (no longer used, kept as a reference)
  levelgen.js       procedural castle: the room table (SPEC), the graph (CHAINS, PAIRS, RETURNS, PROGRESS), the room generators and the world builder (validation, retries, linking, map layout)
  maplayout.js      where every room sits on the castle map: the packed layout (rooms touch, no gaps) that MapScreen draws
  gears.js          the turning gears of the gear room: each tooth is a moving platform that carries the hero      scenes.js   scripted scenes (the Cinder Warden setting Prague alight)
  validate.js       reachability prover (jump simulation + search)       physics.js   movement constants shared with the player
  enchant.js        sword enchantment data + effects
  puzzle.js         the lever puzzles' rules, solver and starting patterns      puzzleprops.js   their levers, candles, vents, lenses and beam      latticeart.js   the pixel art of the lens room
  fx.js             three.js effects: particles, flame shaders, lightning, rings, magic circles, light/darkness
  procart.js        code-drawn pixel art: bat, icons, props
  audio.js          music manager + synthesized sound effects      ui.js   HUD, menus, map, story screens
  touch.js          the on-screen controls for phones and tablets (HTML buttons that hold the same actions as the keys)
  savefile.js pwa.js   SAVE GAME / LOAD GAME (the save as a gzipped file named ArxN Save <date> <time>.bin, written and read by HTML panels) / the service worker, persistent storage, install and iPhone checks
  font.js           gothic text: Morris Roman + Almendra (+ Blackletter for the title, Eroded Motta for her gravestones) drawn as vector text on the hi-res canvas (bitmap fallback if the fonts are missing)
  assets.js input.js util.js decor.js viewer.js     decor.js also draws the bookcases and barred windows in code, and animates the torches
assets/             sprites + environment art (+ sprites.json frame manifest, original licenses), fonts/ (the two gothic TTFs)
                    (assets/sprites/source/ holds the art packs as downloaded - keep that folder out of anything you publish, see CREDITS.md)
lib/three/          three.js r187 (MIT)
music/              your tracks, tracks.txt (the list the game reads online) - TRACKLIST.txt stays on your computer
```

### Testing the generator

```
node tools/test-levels.mjs 300 1       # build 300 castles; reports retries, fallbacks, doorway problems
node tools/test-world.mjs 60 1         # plays every castle as a graph: each can be finished, and each lock really needs its key
node tools/dbg-room.mjs h2 7 0         # ASCII picture of room h2 for seed 7 (attempt 0)
```

To change what can be generated edit the `SPEC` table (names, sizes, secrets, enemy mixes) or a room generator in
`src/levelgen.js`; the validator rejects anything unbeatable, so experimenting is safe.

### Editing levels

Market Street (and the older hand-built rooms, kept as a reference) are authored in `src/rooms.js` with a tiny builder - coordinates are in 16-px tiles:

```js
const b = new B('g1', 'Iron Gate', 1, 60, 14, { weather: 'rain', storm: true });
b.floor(0, 60, 12).block(30, 10, 4, 2).plat(14, 4, 9);      // ground, a raised block, a one-way platform
b.many('zombie', [18, 28, 42], 12).e('bat', 38, 5);        // enemies (x tile, ground row)
b.candle(12, 12);                                          // a lit candelabra (scenery only)
b.e('statue', 40, 12, { drop: 'heart' });                  // breakable statue: 2-3 hits, a heart plus extras
b.exit('R', 9, 11, 'g2', 1, 12);                           // walk off the right edge -> room g2, tile (1,12)
```

The header comment in that file lists the movement budget (jump height/distance with and without abilities) so gaps
can be designed to require - or not require - a power-up.

### Debug helpers

* `http://localhost:8080/?viewer=hero,vampire` - sprite sheet viewer (any sheet-id prefix).
* In the browser console: `game.debug.seed(1234)` jumps into the castle for a seed, `game.world.report` shows how it was
  generated, `game.debug.tp('c2', 4, 12)` teleports to a room, `game.debug.giveAll()` grants every
  ability, `game.debug.god()` makes you invulnerable.

## Credits

The title screen has a **CREDITS** option. What it shows is the plain text file **[credits.txt](credits.txt)** - edit it freely (the format is explained at the top of the file), save, and reopen the screen. Full details and licence links are in [CREDITS.md](CREDITS.md) (some of the art requires attribution - it is all listed there). Most sprites and tiles are CC0 art by Luis Zuno (Ansimuz) from OpenGameArt; the bat,
icons and props are original pixel art drawn in code for this project; sound effects are
synthesized live.
