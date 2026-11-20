// SECRETS: how many hidden things this castle holds, and how many the hero has found.  A secret is a chest or an upgrade made with { secret: true } (see levelgen's SECRETS: the hoards behind cracked
// walls, and the story pages).  The Astrolabe leaves them off the map; the map's footer and the end of the game count them.
export function secretStats(g) {
  const S = g.save, rooms = Object.values(g.world.rooms); let total = 0, found = 0;
  for (const r of rooms) for (const sp of r.spawns || []) { const o = sp.o || {}; if (!o.secret) continue; total++; if (S.flags[o.id] || S.flags[o.id + '_u']) found++; }
  return { total, found };
}
