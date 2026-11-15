// Makes a castle on a second thread, so the title screen (and anything else) never stutters while the rooms are generated and proved passable.  Game.ensureWorld starts it; the finished world is
// handed back as plain data (rooms of tiles and lists) and adopted by levelgen.js's cache.  The generator only needs to know how big the scenery pictures are, which the page tells it.
import { buildWorld } from './levelgen.js';
import { IMG } from './assets.js';

onmessage = e => {
  const { seed, sizes } = e.data;
  for (const [name, [width, height]] of Object.entries(sizes || {})) IMG[name] = { width, height };          // (stand-ins: only width and height are read - see fitScenery in rooms.js)
  try { postMessage({ seed, world: buildWorld(seed, { fresh: true }) }); }
  catch (err) { postMessage({ seed, error: String((err && err.message) || err) }); }
};
