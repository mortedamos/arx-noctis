# Credits

Everything in ARX NOCTIS that was not made for it: who made it, the licence it came under, and where the game uses it.

* **In the game.** The title screen's CREDITS option shows [`credits.txt`](credits.txt), the short version. This file is the full record.
* **Licence texts** as supplied by the authors are in [`assets/credits/`](assets/credits/).
* **Source packs.** The art packs as downloaded are kept in `assets/sprites/source/`, `assets/source/` and `assets/archive/`. They are **not published** (several licences forbid passing a pack on); the game ships only the pieces cut out of them into `assets/env/` and `assets/sprites/`.
* **Links** were last checked on 2026-11-17, and the ones added since on 2026-11-18 and 2026-11-20 (the CraftPix and Free Game Assets pages). All were reachable except the Pixabay pages, which refuse automated requests.
* Licences are given as the authors' own pages and files state them. Where a page and a file disagree, or nothing is stated, the item is listed under [Open items before publishing](#open-items-before-publishing). Two itch.io packs (Icko, CaptainSkolot) have a licence field that is stricter than the author's own description; this project follows the descriptions, and the table row says so.

## Contents

[Licences at a glance](#licences-at-a-glance) · [Open items before publishing](#open-items-before-publishing) · [Attribution required](#attribution-required) · [AI-generated content](#ai-generated-or-ai-assisted-content) · [Art](#art) · [Fonts](#fonts) · [Sound effects](#sound-effects) · [Music](#music) · [Code and libraries](#code-and-libraries)

## Licences at a glance

| Licence | Used for | What it asks of the game |
|---|---|---|
| CC0 / public domain | most of the art (Ansimuz, ETTiNGRiNDER, FreeGameSprites, Szadi art) and most sound effects | nothing; credit is given anyway |
| CC BY 4.0, CC BY 3.0, OGA-BY 3.0 | three art packs and six sounds | credit the creator, link the licence, say what was changed (see [Attribution required](#attribution-required)) |
| Free for commercial use, on the author's own terms | Anokolisa, Eddie's Workshop, assets2D, Icko, CaptainSkolot, Worlds Without End, heosphorus, CraftPix; the fonts Morris Roman, Blackletter, Eroded Motta and Livingstone; the Pixabay sounds | follow each author's note (see [Free for commercial use](#free-for-commercial-use)) |
| SIL Open Font License 1.1 | Pirata One, Almendra, Elementary Gothic Bookhand | keep the licence text with the font (done) |
| MIT | three.js | keep the licence notice (`lib/three/LICENSE`, done) |
| **Not confirmed** | the music | see [Open items before publishing](#open-items-before-publishing) |

## Open items before publishing

These are the things to settle before the game goes on a store or is sold. Each is also marked where it appears below.

| # | Item | The problem | Used for | What to do |
|---|---|---|---|---|
| 1 | **The music** | Made with Suno. Whether the tracks may be used commercially depends on the plan they were generated on. | all the music | Keep the plan and Suno's terms at the time on file. |

**Settled:** the Keeper's sprites (a CraftPix freebie) first came from the Free Game Assets page on itch.io, which has no licence text. On 2026-11-21 the same pack was downloaded again from CraftPix (`craftpix-net-922426-free-city-trader-character-sprite-sheets-pixel-art.zip`): it is byte-for-byte the same file (SHA-256 `34355955EC96A6C205D3B9C57C183725977A2535674BA117A665CE6F4C45C955`), and its `Licens.txt` holds only the address https://craftpix.net/file-licenses/ . So the licence is that page's section 2 (Freebie Products), as followed here.

## Attribution required

CC BY and OGA-BY ask for the creator's name, the title, a link to the source and the licence, and a note of any changes. These appear on the game's credits screen and here.

| Work | Creator | Licence | What was changed |
|---|---|---|---|
| [Castlevania-esque Tilemap (Stone and Bricks)](https://opengameart.org/content/castlevania-esque-tilemap-stone-and-bricks) | Chloe Wolfe | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | cropped and rearranged |
| [Bosses and Monsters Spritesheets (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Balmer, with Redshrike | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | cropped and rearranged; recoloured while loading |
| [Super Dead Gunner: Cyber-tooth (enemy)](https://opengameart.org/content/super-dead-gunner-cyber-tooth-enemy) | Emcee Flesher | [OGA-BY 3.0](https://opengameart.org/content/oga-by-30-faq) | sliced and re-assembled in code |
| [The Sidescroller's Dungeon Tileset \[32x32\]](https://inr-1ko.itch.io/the-sidescrollers-dungeon) | [Icko](https://inr-1ko.itch.io/) | the licence field says [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/), which asks for credit; the author's description allows commercial use and changes | cut out of the sheet, some drawn at half size |
| [Animated Gears - Pixel Art Steampunk Machinery](https://heosphorus.itch.io/animated-gears) | heosphorus | free to use with credit (confirmed by the project owner) | five of the ten animations packed into strips |

Five sound effects are by Free Sounds Library ([freesoundslibrary.com](https://www.freesoundslibrary.com/)), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Each was trimmed, level-matched and re-encoded as a mono mp3.

| File | Title |
|---|---|
| `shatter_2.mp3` | [Glass Shattering Sound Effect](https://www.freesoundslibrary.com/glass-shattering-sound-effect/) |
| `levelup.mp3` | [Ding Level Up](https://www.freesoundslibrary.com/ding-level-up-sound-effect/) |
| `kill_rot_4.mp3` | [Zombie Noise](https://www.freesoundslibrary.com/zombie-noise/) |
| `boss_nightmare.mp3` | [Horse Whinny Sound Effect](https://www.freesoundslibrary.com/horse-whinny-sound-effect/) |
| `boss_nightmare_2.mp3` | [Horse Neighing Sound Effect](https://www.freesoundslibrary.com/horse-neighing-sound-effect/) |

## AI-generated or AI-assisted content

Some stores ask developers to say which shipped content was made with AI. This is the list, from what the sources say about themselves.

| Content | What is known | Used for |
|---|---|---|
| The fifteen portraits | made by the project owner with Google Gemini | the framed pictures and haunted portraits |
| The music | made with Suno (open item 1) | all the music |
| The game's code and the first drafts of much of its story text | written with the help of an AI assistant (Claude, by Anthropic), directed and edited by the project owner | the code, the level generator, the dialogue, tablets and letters (stated on the credits screen under "AI disclaimer") |
| [Magic Books](https://captainskolot.itch.io/magic-books-pixelart-pixel-art-sprite-grimoire-pack-for-rpg-fantasy), CaptainSkolot | the itch.io page says "AI Assisted" | the flying books and their pages |
| [Graveyard 400 Assets](https://worldswithoutend.itch.io/graveyard-2d-game-assets), Worlds Without End | the itch.io page says "AI Assisted" | headstones, flowers, fences and statues |
| [Gothic Vampire Undead Horde](https://assets2d.itch.io/gothic-vampire-horde-pixel-art-2d-character-sprites), assets2D | the itch.io page says "AI Assisted" | the Crimson Count |

The pages of the other itch.io packs (Icko, Anokolisa, Eddie's Workshop, heosphorus, Szadi art) carry no AI disclosure. Checked on 2026-11-18. The page of the [Free City Trader](https://free-game-assets.itch.io/free-city-trader-character-sprite-sheets-pixel-art) pack (the Keeper) is tagged "No generative AI was used". Checked on 2026-11-20.

## Art

Some sprites are recoloured while the game loads (the bone-white skeleton, the green zombie, the frost hound and others).

### Luis Zuno (Ansimuz), CC0

Downloaded from OpenGameArt.org. Each page lists the pack as CC0; the authors' own wording is "public domain and free to use on whatever you want, personal or commercial. Credit is not required but appreciated." The licence texts are in `assets/credits/`. (The Church and Cemetery licence texts also mention demo music by Pascal Belisle; that music is not used in the game.)

| Pack | Used for |
|---|---|
| [Gothicvania Patreon's Collection](https://opengameart.org/content/gothicvania-patreons-collection) | the hero (the "Gothic Hero"); the ghost, fire skull, hell hound, wolf, Hell Beast, Nightmare and Demon; the Gothic Castle and Old Dark Castle tilesets and backgrounds |
| [GothicVania Church Pack](https://opengameart.org/content/gothicvania-church-pack) | burning ghoul, dark wizard, fireball, angel, enemy-death effect; the chapel tileset, backgrounds and column |
| [GothicVania Cemetery Pack](https://opengameart.org/content/gothicvania-cemetery-pack) | skeleton, shambling ghoul (zombie), lantern wraith; the graveyard tileset, sky, mountains, trees and gravestones |
| [Gothicvania Town](https://opengameart.org/content/gothicvania-town) | the Burning Village: houses, props, dusk sky and skyline, and the four villagers |
| [Gotthicvania Swamp](https://opengameart.org/content/gotthicvania-swamp) (spelled so on the page) | the Weeping Swamp: ground, backdrop layers, giant trees, ferns; the swamp spider and swamp thing |
| [Mountain at Dusk Background](https://opengameart.org/content/mountain-at-dusk-background) | the mountain ranges behind the burning village |
| [Gothicvania Bridge Expansion Pack 1](https://opengameart.org/content/gothicvania-bridge-expansion-pack-1) | only `Props/castle.png`: the gate of Arx Noctis (dark wall, glowing slit windows, round window, crimson banner), assembled at load time by `src/keepgate.js` |

The cloaked Stranger is the Gothic Hero from the Patreon's Collection. The sword-enchantment arcs are recolours of its slash frames made at load time. So is the Reflection (the boss in the Mirror Room): the same sheets with all 19 colours swapped for silver and violet.

More free art by the author: [Patreon](https://www.patreon.com/cw/ansimuz) and [pixelgameart.org](https://www.pixelgameart.org/).

### Other CC0

| Pack | Author | Used for |
|---|---|---|
| [Haunted Forest Trees](https://opengameart.org/content/haunted-forest-trees) | ETTiNGRiNDER | the gnarled dead trees in the graveyard rooms |
| [Candelabra](https://freegamesprites.com/en/assets/candelabra) and [Candelabra Stand](https://freegamesprites.com/en/assets/candelabra-stand) | FreeGameSprites.com | the room candelabras (`assets/env/cdl_a.png`, `cdl_b.png`), trimmed and shrunk, with the painted flames removed (the flames are drawn by three.js) |
| [Sign Post](https://freegamesprites.com/en/assets/sign-post) | FreeGameSprites.com | the signposts at the crossroads and the doors (`assets/env/signpost.png`), trimmed and shrunk |

FreeGameSprites lists CC0 on each page.

### Free for commercial use

On the authors' own terms, as stated on their pages or in their downloads.

| Pack | Author | Terms | Used for |
|---|---|---|---|
| [Hero's Journey: Moon Graveyard](https://anokolisa.itch.io/moon-graveyard) (the "Final" set) | Anokolisa | "completely free for commercial use"; credit optional, and none owed when shapes or colours are changed (`assets/credits/license-anokolisa-final-note.txt`) | the moonlit graveyard backdrop: moon and clouds, the mausoleum and chapel silhouette, ivy and headstone foliage (drawn at half size) |
| [Old Golem](https://eddies-workshop.itch.io/old-golem) | Eddie's Workshop | "can be used freely and commercially... credits are not required but I would appreciate it" (`assets/credits/license-old-golem.txt`) | the **Boiler Golem**; the steam at its mouth and its explosion were cut out and are three.js effects now |
| [Gothic Vampire Undead Horde](https://assets2d.itch.io/gothic-vampire-horde-pixel-art-2d-character-sprites), the free download (`xxg_4_free.zip`, one sheet) | assets2D | "freely used in both non-commercial fan games and commercial revenue-generating game projects"; may be modified; may **not** be redistributed, resold or repackaged as a standalone asset bundle; credit "highly appreciated", not required | the **Crimson Count**, boss of the Crimson Crypt: the one sheet is cut into six strips (`assets/sprites/vampire_*.png`) and scaled down by the build step |
| [Pixel Platformer Set 1](https://szadiart.itch.io/pixel-platformer-castle) (titled "Pixel Platformer Castle" on itch.io) | Szadi art | public domain, personal or commercial; may be edited, but the pack may not be sold (`assets/credits/license-szadi-pixel-platformer.txt`) | the sickle-fighting **zealot** and the sparkling diamond |
| [Graveyard 400 Assets](https://worldswithoutend.itch.io/graveyard-2d-game-assets) | [Worlds Without End](https://worldswithoutend.itch.io/) | personal and commercial use (`License.pdf` in the download); the original files may not be redistributed, resold, sublicensed or re-packaged. The project owner's reading, which this project follows: pieces cut out and used inside a game are use, not redistribution, or nobody could use the pack at all | eighteen pieces cut from the 128x128 set (`assets/env/gy_*.png`): two headstones, four flowers, a wreath, three iron fences and eight statues, which are the stones the Lady speaks through |
| [The Sidescroller's Dungeon Tileset \[32x32\]](https://inr-1ko.itch.io/the-sidescrollers-dungeon) (`The Sidescroller's Dungeon - Tileset [32x32].zip`) | [Icko](https://inr-1ko.itch.io/) | the author's description: "You may use these assets for both free and commercial projects", "You may modify this asset pack to suit the needs of your projects", "You may not repackage, redistribute, or resell these assets whether they have been modified or not". The page's licence field says CC BY-ND 4.0, which would forbid changes; this project follows the description, as the author's own statement of what is allowed (`assets/credits/license-sidescrollers-dungeon-note.txt`) | pillars, banners, urns, crates, the stone arch, the wooden door and the animated torches |
| [Magic Book pack](https://captainskolot.itch.io/magic-books-pixelart-pixel-art-sprite-grimoire-pack-for-rpg-fantasy) (32 grimoires; `Magic Book by CaptainSkeleto.zip` and `Magic Books interface.zip`) | [CaptainSkolot](https://captainskolot.itch.io/) | the author's description: "We want you to have the freedom to use this asset pack in both your free and commercial projects", "Feel free to modify the assets to suit your unique needs. While credit is not required, we genuinely appreciate any attribution given", "You may not redistribute or resell the assets on their own, that includes NFT/images asset compilations". The page's licence field says CC BY-NC-SA 4.0, which would forbid commercial use; this project follows the description, as the author's own statement of what is allowed (`assets/credits/license-magic-books-note.txt`) | the flying books of the Library of Ages (`assets/sprites/magicbooks.png`), and the open pages they show as they cast (`assets/sprites/bookpages.png`, cut from the interface pack and drawn translucent) |
| [Animated Gears](https://heosphorus.itch.io/animated-gears) | heosphorus | free to use **with credit** (see [Attribution required](#attribution-required)) | five of its ten gear animations (`assets/env/gear_*.png`), faded and slowly turning behind the generated gears of the Orloj Tower and the Clockwork Dungeon |
| [Free City Trader Character Sprite Sheets](https://free-game-assets.itch.io/free-city-trader-character-sprite-sheets-pixel-art) (`Free-City-Trader-Character-Sprite-Sheets-Pixel-Art.zip`), a freebie of [CraftPix.net](https://craftpix.net/freebies/) shared by [Free Game Assets](https://free-game-assets.itch.io/) | CraftPix.net | CraftPix's [file licences](https://craftpix.net/file-licenses/), section 2 "Freebie Products" (the pack's own `Licens.txt` points to that page; read in full on 2026-11-20 and again on 2026-11-21): may be used "in any number of personal and commercial projects", may be modified, "No attribution or link back to this site is required, however any credit will be highly appreciated"; the art files may not be resold or redistributed for others to use, and may not be used to train AI (`assets/credits/license-craftpix-freebie-note.txt`). The itch.io page says "No generative AI was used". The same pack downloaded from CraftPix itself on 2026-11-21 is byte-identical to the itch.io copy (see "Settled" under Open items). | the **Keeper** of the shops (all five): the cloaked vendor with the pack on his back ("Trader_1", 128x128 cells), five of its animations (idle, wave, folded arms, opening his cloak, nodding) cut to one box and shrunk to two thirds by `tools/cut-trader.ps1` into `assets/sprites/trader_*.png`. The other two traders and the PSD files are not used |

### Made for this project

* **The Prague Orloj clock picture** (`assets/sprites/source/orloj.png`) is the project owner's own photograph, taken on a visit to Prague. It is pixelated into `assets/env/orloj.png` by `tools/pixelate-orloj.ps1` and is the dial of the Orloj Tower.
* **The Orloj tower photograph** (`assets/sprites/source/orloj_tower.png`) is the project owner's own photograph too. Only the calendar dial is cut out of it (pixelated into `assets/env/orloj_calendar.png` by `tools/pixelate-orloj-calendar.ps1`); the rest of the street tower is drawn in code (`src/orlojtower.js`).
* **The Stone Bridge Tower** (`src/bridgetower.js`), the gate at the Prague end of the bridge, is drawn in code for this game, after the real Gothic gate tower there (begun in 1357 under Charles IV, designed by Peter Parler; today called the Old Town Bridge Tower). No photograph is used. Its statues are the Graveyard pack's (the knight and the robed saints, listed above), recoloured to sandstone in code.
* **The fifteen portraits** (five expressions each; 75 files in `assets/portraits/`) were made by the project owner with Google Gemini prompts, for their other game, [The Kingdom Marches](https://mortedamos.github.io/Kingdom-Marches/). The files are byte-identical to the ones in that project's `assets/portraits/`. They are the framed pictures on the castle walls and the haunted portraits. The full-size pictures are not shipped: `tools/pixelate-portraits.ps1` shrinks them to 26x33 pixels, gives each person one 32-colour palette and packs them into `assets/portraits/pixel/portraits.png`.
* **Drawn in code**, in `src/procart.js`: the bat, the item icons, the props (candelabra, torch, bookcase, barred window, brazier, altar, tablet, chest, pedestal, spikes, breakable, burnable, crystal and seal tiles), the projectiles, and some creatures.

### Kept but not used

None of the three is shipped (`assets/archive/` and `assets/sprites/source/` are not published).

* **Dark Hooded Warrior**, oliveiramiro2: [itch.io page](https://oliveiramiro2.itch.io/dark-hooded-warrior-pixel-art-player-character-free-2d-sprite). Described as free to use, but the pack came without a formal licence (`assets/archive/hooded-warrior/license-dark-hooded-warrior.txt`). Check the author's page again before any commercial release if it is ever put back.
* **Metroidvania Kit**, CC0 per its page, in `assets/sprites/source/`.
* **[Steampunk Pixel Art Mega Pack v2.1.1](https://gamecrafterik.itch.io/steampunk-pixel-art-mega-pack)**, gamecrafterik (downloaded as `steampunk-pixel-art-mega-pack-assets.zip`, kept in `assets/sprites/source/`). The page says "Royalty-free commercial license" and "No attribution required", and that the art is "Sprixen AI + curation": it is AI-generated. Seven of its 32x32 environment props (pressure tank, steam vent, pipe valve, Victorian clock, lamp post, steam furnace, tesla tower) were once placed in the Clockwork Dungeon, then taken out because they did not suit the place. Their files (`assets/env/sp_*.png`) and the code that loaded them were removed on 2026-11-18, so nothing from the pack ships. It is not in the in-game credits.

## Fonts

The font files are in `assets/fonts/`.

| Font | Author | Licence | Used for |
|---|---|---|---|
| [Pirata One](https://fonts.google.com/specimen/Pirata+One) | Rodrigo Fuenzalida, Nicolas Massi | [SIL OFL 1.1](https://openfontlicense.org/) (`assets/credits/license-pirata-one-OFL.txt`) | the headings of `privacy.html` and `terms.html` (until 2026-11-21 it was also the game's menu, HUD and banner face) |
| [Almendra Bold](https://fonts.google.com/specimen/Almendra) | Ana Sanfelippo | SIL OFL 1.1 (`assets/credits/license-almendra-OFL.txt`) | dialogue, boss exchanges and descriptive text, and the HP, MP and LV labels of the HUD |
| [Elementary Gothic Bookhand](https://www.dafont.com/elementary-gothic-bookhand.font) | [Bill Roach](https://www.dafont.com/bill-roach.d3814), (c) 2012 | SIL OFL 1.1; the download page says "SIL/OFL licensed. Free for commercial and non-commercial use." (`assets/credits/license-elementary-gothic-bookhand-OFL.txt`) | the Stranger's own voice in dialogue and boss exchanges |
| Livingstone | PrimaFont, "American Collection" | free font; the folder may be passed on as often as wanted if nothing in it is changed and no file is missing, which is how it ships (`assets/fonts/livingstone/LIVINGST.TXT`); the project owner confirmed it is fine for commercial use | everyone else who speaks: villagers, the Keeper and the bosses |
| [Morris Roman](https://www.dafont.com/morris-roman.font) (the file `MorrisRomanBlack.ttf`) | William Morris designed it in 1893; digitised and hinted by [Dieter Steffmann](https://www.dafont.com/dieter-steffmann.d253), [steffmann.de](http://www.steffmann.de); the font's own copyright line reads "Typographer Mediengestaltung, 2002. All rights reserved." | dafont lists it as "100% Free"; the download holds no readme, and the font file's own licence field says "have fun and enjoy". dafont's FAQ says the licence shown above a download is only an indication (`assets/credits/license-morris-roman-dafont-note.txt`) | the menus, the HUD, the banners, the names over dialogue boxes and floating text |
| [Blackletter ExtraBold](https://www.dafont.com/blackletter-ds.font) (listed on dafont as "Blackletter") | [Dieter Steffmann](https://www.dafont.com/dieter-steffmann.d253); the font's own copyright line reads "Typographer Mediengestaltung, 2001. All rights reserved." | dafont lists it as "100% Free" (the download holds `BLACEB__.TTF`, which is the file used here). dafont's FAQ says the licence shown above a download is only an indication and the readme in the archive governs (`assets/credits/license-blackletter-dafont-note.txt`) | the game title |
| [Eroded Motta](https://www.1001fonts.com/erodedmotta-font.html) | [Lirkiv](https://www.1001fonts.com/users/Lirkiv/), (c) 2026 (the font file reads "lirkiv AC") | the author's note on 1001Fonts: "it's free for anything you want to do (including commercial)"; the listing says "Free for commercial use" under custom terms (a `Terms.txt` is in the download, which was not kept) and "This font can not be resold or republished" (`assets/credits/license-eroded-motta-note.txt`) | the Lady's words: every gravestone and tablet |

Blackletter ExtraBold was rebuilt from the original `BLACEB__.TTF` so that browsers accept it.

## Sound effects

Only the recorded sounds are listed here; every other sound is synthesized in code. Each recording was trimmed, level-matched and re-encoded as a mono 96 kbps mp3. Pixabay sounds are under the [Pixabay Content License](https://pixabay.com/service/license-summary/): free for commercial use, no credit required, not to be resold or passed on as a sound pack. The table is sorted by file name.

<!-- sfx-table:start -->
135 recordings: 112 CC0, 18 Pixabay Content License, 5 CC BY 4.0.

| File | Sound | By | Source | Licence |
|---|---|---|---|---|
| `ability.mp3` | 36 Bar Chimes Sweep Ascend 01 | loganzsound | [Freesound](https://freesound.org/people/loganzsound/sounds/874685/) | CC0 |
| `back.mp3` | Cancel or No Button Sound | el_boss | [Freesound](https://freesound.org/people/el_boss/sounds/788602/) | CC0 |
| `block.mp3` | Sword_Clash (7).wav | JohnBuhr | [Freesound](https://freesound.org/people/JohnBuhr/sounds/326868/) | CC0 |
| `bone.mp3` | Bones Crack 2.wav | Kane53126 | [Freesound](https://freesound.org/people/Kane53126/sounds/257927/) | CC0 |
| `bone_2.mp3` | Bone Cracking.wav | bewareofkites20 | [Freesound](https://freesound.org/people/bewareofkites20/sounds/147993/) | CC0 |
| `bone_3.mp3` | Bone Crack | cb9382 | [Freesound](https://freesound.org/people/cb9382/sounds/872378/) | CC0 |
| `boom.mp3` | Boom Explosion | BennettFilmTeacher | [Freesound](https://freesound.org/people/BennettFilmTeacher/sounds/523783/) | CC0 |
| `boss_angel.mp3` | Cello harmonics glissando | NikoletB | [Freesound](https://freesound.org/people/NikoletB/sounds/846669/) | CC0 |
| `boss_angel_die.mp3` | angels02.ogg | pennyhatemachine | [Freesound](https://freesound.org/people/pennyhatemachine/sounds/107009/) | CC0 |
| `boss_beast.mp3` | Deep Monster Growl | uagadugu | [Freesound](https://freesound.org/people/uagadugu/sounds/222523/) | CC0 |
| `boss_beast_2.mp3` | Demon_Ghost Growling 1.wav | Osiruswaltz | [Freesound](https://freesound.org/people/Osiruswaltz/sounds/362672/) | CC0 |
| `boss_beast_die.mp3` | Dragons Dying Breath | MickBoere | [Freesound](https://freesound.org/people/MickBoere/sounds/276577/) | CC0 |
| `boss_bramble.mp3` | Monster sound 02 based on plants | rubberduck9999 | [Freesound](https://freesound.org/people/rubberduck9999/sounds/672920/) | CC0 |
| `boss_bramble_2.mp3` | creaturechitter.wav | j1987 | [Freesound](https://freesound.org/people/j1987/sounds/106126/) | CC0 |
| `boss_cinder.mp3` | Sleeping  Monster | szegvari | [Freesound](https://freesound.org/people/szegvari/sounds/546402/) | CC0 |
| `boss_cinder_2.mp3` | Dragon roar 1.wav | AMWD_Mortsel-Edegem-Kontich | [Freesound](https://freesound.org/people/AMWD_Mortsel-Edegem-Kontich/sounds/651817/) | CC0 |
| `boss_cinder_die.mp3` | Sleeping  Monster | szegvari | [Freesound](https://freesound.org/people/szegvari/sounds/546402/) | CC0 |
| `boss_colossus.mp3` | Bycicle grears in reverse.wav | MichelleGrobler | [Freesound](https://freesound.org/people/MichelleGrobler/sounds/410557/) | CC0 |
| `boss_colossus_2.mp3` | clock.wav | Narjara | [Freesound](https://freesound.org/people/Narjara/sounds/527517/) | CC0 |
| `boss_colossus_die.mp3` | Trap Springing Shut | qubodup | [Freesound](https://freesound.org/people/qubodup/sounds/752070/) | CC0 |
| `boss_librarian.mp3` | Creepy Whispering | RaspberryTickle | [Freesound](https://freesound.org/people/RaspberryTickle/sounds/234044/) | CC0 |
| `boss_librarian_2.mp3` | LongWhisper | EvaMusik | [Freesound](https://freesound.org/people/EvaMusik/sounds/832739/) | CC0 |
| `boss_librarian_die.mp3` | Release me - Whispering ROUGH Latin | JoelMcDaniel | [Freesound](https://freesound.org/people/JoelMcDaniel/sounds/851763/) | CC0 |
| `boss_nightmare.mp3` | Horse Whinny Sound Effect | Free Sounds Library | [freesoundslibrary.com](https://www.freesoundslibrary.com/horse-whinny-sound-effect/) | CC BY 4.0 |
| `boss_nightmare_2.mp3` | Horse Neighing Sound Effect | Free Sounds Library | [freesoundslibrary.com](https://www.freesoundslibrary.com/horse-neighing-sound-effect/) | CC BY 4.0 |
| `boss_nightmare_3.mp3` | Horse steps on grass | Luisa_Sanchez | [Freesound](https://freesound.org/people/Luisa_Sanchez/sounds/813383/) | CC0 |
| `boss_nightmare_die.mp3` | Horse_neighing.wav | Lydmakeren | [Freesound](https://freesound.org/people/Lydmakeren/sounds/510903/) | CC0 |
| `boss_rimewyrm.mp3` | Dragon roar 1.wav | AMWD_Mortsel-Edegem-Kontich | [Freesound](https://freesound.org/people/AMWD_Mortsel-Edegem-Kontich/sounds/651817/) | CC0 |
| `boss_rimewyrm_2.mp3` | DRAGON_ROAR.wav | JoelAudio | [Freesound](https://freesound.org/people/JoelAudio/sounds/85568/) | CC0 |
| `boss_rimewyrm_die.mp3` | Dragons Dying Breath | MickBoere | [Freesound](https://freesound.org/people/MickBoere/sounds/276577/) | CC0 |
| `boss_shadow.mp3` | You Are Lost | Hoody468 | [Freesound](https://freesound.org/people/Hoody468/sounds/841521/) | CC0 |
| `boss_shadow_2.mp3` | Deep Evil Laugh | DRFX | [Freesound](https://freesound.org/people/DRFX/sounds/350679/) | CC0 |
| `boss_shadow_3.mp3` | Evil Presence 01.wav | LilMati | [Freesound](https://freesound.org/people/LilMati/sounds/445719/) | CC0 |
| `boss_shadow_die.mp3` | Cthulhu | qubodup | [Freesound](https://freesound.org/people/qubodup/sounds/827668/) | CC0 |
| `break.mp3` | Barrel Break 4.wav | kevinkace | [Freesound](https://freesound.org/people/kevinkace/sounds/66772/) | CC0 |
| `break_2.mp3` | Smash.ogg | egomassive | [Freesound](https://freesound.org/people/egomassive/sounds/536777/) | CC0 |
| `break_3.mp3` | snd_box_smash.wav | gristi | [Freesound](https://freesound.org/people/gristi/sounds/562189/) | CC0 |
| `cast.mp3` | Magic Spell | qubodup | [Freesound](https://freesound.org/people/qubodup/sounds/442774/) | CC0 |
| `click.mp3` | 51 UI sound effects (buttons, switches and clicks) / click4.wav | gopherapps | [OpenGameArt](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks) | CC0 |
| `click_2.mp3` | 51 UI sound effects (buttons, switches and clicks) / click5.wav | gopherapps | [OpenGameArt](https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks) | CC0 |
| `coin.mp3` | Coin Dropped | kermite607 | [Freesound](https://freesound.org/people/kermite607/sounds/368203/) | CC0 |
| `coin_2.mp3` | 50 RPG sound effects / handleCoins.ogg | LunaVR | [OpenGameArt](https://opengameart.org/content/50-rpg-sound-effects) | CC0 |
| `coin_3.mp3` | Coin Collect (3) | Yodguard | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-coin-collect-3-540190/) | Pixabay Content License |
| `crack.mp3` | Hard Glass Impact | deleted_user_3656686 | [Freesound](https://freesound.org/people/deleted_user_3656686/sounds/418194/) | CC0 |
| `crumble.mp3` | Crumble #2 | freesound_community | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-crumble-2-82156/) | Pixabay Content License |
| `dash.mp3` | swoosh.wav | vacuumfan7072 | [Freesound](https://freesound.org/people/vacuumfan7072/sounds/264591/) | CC0 |
| `dash_2.mp3` | Woosh - Plastic perforated steak spatula 7 | Sadiquecat | [Freesound](https://freesound.org/people/Sadiquecat/sounds/742906/) | CC0 |
| `djump.mp3` | Wing Flap (Flag Flapping) 5a | ani_music | [Freesound](https://freesound.org/people/ani_music/sounds/244982/) | CC0 |
| `djump_2.mp3` | Bird Flap B 05.wav | deleted_user_2104797 | [Freesound](https://freesound.org/people/deleted_user_2104797/sounds/330967/) | CC0 |
| `door.mp3` | RPG Audio / doorOpen_1.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `door_2.mp3` | RPG Audio / doorOpen_2.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `enchant.mp3` | Magic Twinkle | Universfield | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-magic-twinkle-244951/) | Pixabay Content License |
| `fire.mp3` | Combust.wav | GrimGrum | [Freesound](https://freesound.org/people/GrimGrum/sounds/412558/) | CC0 |
| `fireball.mp3` | Fire.wav | danielpodlovics | [Freesound](https://freesound.org/people/danielpodlovics/sounds/530355/) | CC0 |
| `flap.mp3` | Wing Flap (Flag Flapping) 5a | ani_music | [Freesound](https://freesound.org/people/ani_music/sounds/244982/) | CC0 |
| `flap_2.mp3` | Wing Flap 2.wav | _stubb | [Freesound](https://freesound.org/people/_stubb/sounds/389633/) | CC0 |
| `flap_3.mp3` | Bird Flap B 05.wav | deleted_user_2104797 | [Freesound](https://freesound.org/people/deleted_user_2104797/sounds/330967/) | CC0 |
| `flap_4.mp3` | bat swoosh | MrGungus | [Freesound](https://freesound.org/people/MrGungus/sounds/766542/) | CC0 |
| `freeze.mp3` | iceSpell.wav | Relenzo2 | [Freesound](https://freesound.org/people/Relenzo2/sounds/160420/) | CC0 |
| `gear.mp3` | LightClunk1.wav | BMacZero | [Freesound](https://freesound.org/people/BMacZero/sounds/94129/) | CC0 |
| `gear_2.mp3` | SqueakyClick1.wav | BMacZero | [Freesound](https://freesound.org/people/BMacZero/sounds/94133/) | CC0 |
| `gear_3.mp3` | Mechanical1.wav | BMacZero | [Freesound](https://freesound.org/people/BMacZero/sounds/94120/) | CC0 |
| `ghost.mp3` | Spectral Ghost Whisper Breeze Whoosh | brktkrgll | [Freesound](https://freesound.org/people/brktkrgll/sounds/856169/) | CC0 |
| `heal.mp3` | Sound Effect: Twinkle/Sparkle | ShidenBeatsMusic | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-sound-effect-twinklesparkle-115095/) | Pixabay Content License |
| `hit.mp3` | 75 CC0 breaking / falling / hit sfx / bfh1_hit_01.ogg | frances | [OpenGameArt](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) | CC0 |
| `hit_2.mp3` | Impact Sounds / impactPunch_heavy_000.ogg | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `hit_3.mp3` | 3 Melee sounds / animal melee sound.wav | Dream2Reality | [OpenGameArt](https://opengameart.org/content/3-melee-sounds) | CC0 |
| `hit_4.mp3` | 3 Melee sounds / melee sound.wav | Dream2Reality | [OpenGameArt](https://opengameart.org/content/3-melee-sounds) | CC0 |
| `hit_5.mp3` | 3 Melee sounds / sword sound.wav | Dream2Reality | [OpenGameArt](https://opengameart.org/content/3-melee-sounds) | CC0 |
| `hurt.mp3` | 80 CC0 creature SFX / hurt_01.ogg | Chasersgaming | [OpenGameArt](https://opengameart.org/content/80-cc0-creature-sfx) | CC0 |
| `hurt_2.mp3` | male_hurt9.ogg | micahlg | [Freesound](https://freesound.org/people/micahlg/sounds/413186/) | CC0 |
| `ink.mp3` | Wet Splat 2.mp3 | nebulasnails | [Freesound](https://freesound.org/people/nebulasnails/sounds/495117/) | CC0 |
| `ink_2.mp3` | Wet Splat 1.mp3 | nebulasnails | [Freesound](https://freesound.org/people/nebulasnails/sounds/495118/) | CC0 |
| `ink_3.mp3` | Splat 3 | sebastientate | [Freesound](https://freesound.org/people/sebastientate/sounds/719131/) | CC0 |
| `item.mp3` | Item Get | Qvantor | [Freesound](https://freesound.org/people/Qvantor/sounds/878616/) | CC0 |
| `jump.mp3` | RPG Audio / cloth2.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `jump_2.mp3` | RPG Audio / cloth3.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `jump_3.mp3` | Jacket/Cloth Rustle 9 | brandondelehoy | [Freesound](https://freesound.org/people/brandondelehoy/sounds/494797/) | CC0 |
| `kill_beast.mp3` | 16_Ratón_chillando.wav | JoseAgudelo | [Freesound](https://freesound.org/people/JoseAgudelo/sounds/472399/) | CC0 |
| `kill_beast_2.mp3` | Rat.ogg | egomassive | [Freesound](https://freesound.org/people/egomassive/sounds/536753/) | CC0 |
| `kill_beast_3.mp3` | mouse squek.mp3 | FairCashew | [Freesound](https://freesound.org/people/FairCashew/sounds/684866/) | CC0 |
| `kill_bone.mp3` | Necksnap_build.wav | danielrutterfilms | [Freesound](https://freesound.org/people/danielrutterfilms/sounds/134025/) | CC0 |
| `kill_bone_2.mp3` | Bone Breaking Effect | DRAGON-STUDIO | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-bone-breaking-effect-393836/) | Pixabay Content License |
| `kill_bone_3.mp3` | Skeleton bones (game).wav | cribbler | [Freesound](https://freesound.org/people/cribbler/sounds/381859/) | CC0 |
| `kill_book.mp3` | RPG Audio / cloth3.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `kill_book_2.mp3` | RPG Audio / cloth2.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `kill_book_3.mp3` | RPG Audio / bookFlip1.ogg | Kenney | [Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `kill_fire.mp3` | Fire Burst Flash | Za-Games | [Freesound](https://freesound.org/people/Za-Games/sounds/539972/) | CC0 |
| `kill_ghost.mp3` | Ghostly Whoosh - Horror Game UI | TommasoMotteran | [Freesound](https://freesound.org/people/TommasoMotteran/sounds/850767/) | CC0 |
| `kill_ice.mp3` | Glass Break | unfa | [Freesound](https://freesound.org/people/unfa/sounds/221528/) | CC0 |
| `kill_ice_2.mp3` | Glass Shatter  4.wav | Greg_Surr | [Freesound](https://freesound.org/people/Greg_Surr/sounds/554566/) | CC0 |
| `kill_ice_3.mp3` | Break the glass | spinopel | [Pixabay](https://pixabay.com/sound-effects/break-the-glass-456388/) | Pixabay Content License |
| `kill_mage.mp3` | Ice Magic Arrow_type 01 | lotteria001 | [Freesound](https://freesound.org/people/lotteria001/sounds/709888/) | CC0 |
| `kill_rot.mp3` | zombie death | dreggsome | [Freesound](https://freesound.org/people/dreggsome/sounds/744096/) | CC0 |
| `kill_rot_2.mp3` | Wet Squelch | Universfield | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-wet-squelch-276679/) | Pixabay Content License |
| `kill_rot_3.mp3` | Monster Growl | DRAGON-STUDIO | [Pixabay](https://pixabay.com/sound-effects/horror-monster-growl-390285/) | Pixabay Content License |
| `kill_rot_4.mp3` | Zombie Noise | Free Sounds Library | [freesoundslibrary.com](https://www.freesoundslibrary.com/zombie-noise/) | CC BY 4.0 |
| `land.mp3` | Impact Sounds / impactSoft_medium_000.ogg | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `land_2.mp3` | Impact Sounds / impactSoft_medium_002.ogg | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `land_3.mp3` | Impact Sounds / impactSoft_medium_001.ogg | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `levelup.mp3` | Ding Level Up | Free Sounds Library | [freesoundslibrary.com](https://www.freesoundslibrary.com/ding-level-up-sound-effect/) | CC BY 4.0 |
| `mana.mp3` | Magic charge mana 2 | FxProSound | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-magic-charge-mana-2-186628/) | Pixabay Content License |
| `page.mp3` | Fast Page Turn - 5 | SpaceJoe | [Freesound](https://freesound.org/people/SpaceJoe/sounds/484911/) | CC0 |
| `page_2.mp3` | One page book flip | freesound_community | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-one-page-book-flip-101928/) | Pixabay Content License |
| `page_3.mp3` | Page flip 1 | OxidVideos | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-page-flip-1-178322/) | Pixabay Content License |
| `page_4.mp3` | Page flip2 | OxidVideos | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-page-flip2-178323/) | Pixabay Content License |
| `page_5.mp3` | Quiet Page Turn - 8 | SpaceJoe | [Freesound](https://freesound.org/people/SpaceJoe/sounds/484968/) | CC0 |
| `pickup.mp3` | Item Pickup (1) | Yodguard | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-item-pickup-1-540174/) | Pixabay Content License |
| `pickup_2.mp3` | Item Pickup (3) | Yodguard | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-item-pickup-3-540193/) | Pixabay Content License |
| `record_scratch.mp3` | record_scratch.wav | simkiott | [Freesound](https://freesound.org/people/simkiott/sounds/43404/) | CC0 |
| `roar.mp3` | Yeti Roar - Skiing Game - Roar SFX Remix (2 of 2) | el_boss | [Freesound](https://freesound.org/people/el_boss/sounds/751713/) | CC0 |
| `save.mp3` | Holy Spell Cast | DRAGON-STUDIO | [Pixabay](https://pixabay.com/sound-effects/musical-holy-spell-cast-450460/) | Pixabay Content License |
| `seal.mp3` | Gates of Hell 2 (Gate Slam 2) | magnuswaker | [Freesound](https://freesound.org/people/magnuswaker/sounds/530061/) | CC0 |
| `select.mp3` | Game UI Confirm Selection Sound #2 | Vadim_Makes_Sound | [Pixabay](https://pixabay.com/sound-effects/technology-game-ui-confirm-selection-sound-2-547852/) | Pixabay Content License |
| `shatter.mp3` | ICEBrk_Break04_InMotionAudio_FREESampleSunday | InMotionAudio | [Freesound](https://freesound.org/people/InMotionAudio/sounds/719973/) | CC0 |
| `shatter_2.mp3` | Glass Shattering Sound Effect | Free Sounds Library | [freesoundslibrary.com](https://www.freesoundslibrary.com/glass-shattering-sound-effect/) | CC BY 4.0 |
| `slash.mp3` | Swishes Sound Pack / swish-11.wav | qubodup | [OpenGameArt](https://opengameart.org/content/swishes-sound-pack) | CC0 |
| `slash_2.mp3` | Swishes Sound Pack / swish-10.wav | qubodup | [OpenGameArt](https://opengameart.org/content/swishes-sound-pack) | CC0 |
| `slash_3.mp3` | Swishes Sound Pack / swish-1.wav | qubodup | [OpenGameArt](https://opengameart.org/content/swishes-sound-pack) | CC0 |
| `slash_4.mp3` | Metallic Whoosh.wav | MissCellany | [Freesound](https://freesound.org/people/MissCellany/sounds/240640/) | CC0 |
| `slash_5.mp3` | Sword Movement Single 1 | deleted_user_6479820 | [Freesound](https://freesound.org/people/deleted_user_6479820/sounds/395266/) | CC0 |
| `slash_6.mp3` | Sword Movement Single 2 | deleted_user_6479820 | [Freesound](https://freesound.org/people/deleted_user_6479820/sounds/395265/) | CC0 |
| `slash_7.mp3` | Sword Movement Single 4 | deleted_user_6479820 | [Freesound](https://freesound.org/people/deleted_user_6479820/sounds/395263/) | CC0 |
| `steam.mp3` | steam_burst.wav | pengo_au | [Freesound](https://freesound.org/people/pengo_au/sounds/90143/) | CC0 |
| `steam_2.mp3` | Steam release sounds / steam hisses - Marker #1.wav | XilliX | [OpenGameArt](https://opengameart.org/content/steam-release-sounds) | CC0 |
| `steam_3.mp3` | Steam release sounds / steam hisses - Marker #3.wav | XilliX | [OpenGameArt](https://opengameart.org/content/steam-release-sounds) | CC0 |
| `steam_4.mp3` | Steam release sounds / steam hisses - Marker #4.wav | XilliX | [OpenGameArt](https://opengameart.org/content/steam-release-sounds) | CC0 |
| `steam_5.mp3` | Steam release sounds / steam hisses - Marker #5.wav | XilliX | [OpenGameArt](https://opengameart.org/content/steam-release-sounds) | CC0 |
| `steam_6.mp3` | Steam Hissing | DRAGON-STUDIO | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-steam-hissing-386157/) | Pixabay Content License |
| `step.mp3` | Impact Sounds / footstep_concrete_000.ogg | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `thunder.mp3` | thunder1.wav | nednednerb | [Freesound](https://freesound.org/people/nednednerb/sounds/38244/) | CC0 |
| `thunder_2.mp3` | Thunder (Kraków, Poland, 20.05.2013) | vonz | [Freesound](https://freesound.org/people/vonz/sounds/188767/) | CC0 |
| `thunder_3.mp3` | strike 3 sec.wav | Littlebrojay | [Freesound](https://freesound.org/people/Littlebrojay/sounds/195439/) | CC0 |
| `toll.mp3` | Church Bell.wav | MVMTech | [Freesound](https://freesound.org/people/MVMTech/sounds/569356/) | CC0 |
| `unseal.mp3` | Unlock stinger | Sunovia | [Pixabay](https://pixabay.com/sound-effects/film-special-effects-unlock-stinger-289722/) | Pixabay Content License |
<!-- sfx-table:end -->

## Music

Made for this game by the project owner; see `music/TRACKLIST.txt` (a working file that is not published; the game reads `music/tracks.txt`). See open item 1 about the terms.

## Code and libraries

* **three.js** r187, MIT licence, (c) 2010-2026 Three.js authors: [threejs.org](https://threejs.org). The licence text is `lib/three/LICENSE`.
* The game code, shaders and level data were written for this project.
* The pixel font is a 5x7 bitmap font defined in `src/font.js`.

## Adding something new

1. Read the licence on the source page and save its text (or a note of it) in `assets/credits/`.
2. Add a row to the right table above, with the author's name, the licence, a link and where it is used.
3. Add a few lines to `credits.txt`, which is what players see.
4. Keep the pack as downloaded out of git, in one of the `source/` folders listed at the top.
5. For recorded sound effects, `node tools/sfx-browser/install.mjs` writes the credit lines and `node tools/credits-sfx.mjs` puts them into the table above.
