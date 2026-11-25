// THE LEVER-AND-CANDLE PUZZLES: a few levers, a few candles, and a chest that unlocks when the candles burn in the right pattern.
// A pattern is a bit mask (bit 0 = the first candle from the left).  Each lever has a RULE, { off, on, flip }: the candles it puts out, the candles it lights, and the candles it toggles.  A lever whose rule is all
// "flip" is a two-position lever (up or down); one that forces candles on or off is on a spring (spec.spring): it swings over and comes back, and can be pulled again.
// CHECK A NEW SET OF RULES WITH solve(): it is easy to write one that cannot be solved.  Levers that each toggle two of three candles never change whether the number lit is odd or even; and if every lever forces
// some candle to the wrong state, whichever was pulled last has spoiled the pattern.  tools/test-world.mjs proves, in every castle, that each puzzle can be solved from wherever the player can get it to.
export const maskOf = list => (list || []).reduce((m, k) => m | 1 << k, 0);
export const pull = (rule, c) => ((c & ~maskOf(rule.off)) | maskOf(rule.on)) ^ maskOf(rule.flip);

// every pattern that can be reached from `from`
export function reachable(rules, from) {
  const seen = new Set([from]), todo = [from];
  while (todo.length) { const c = todo.pop(); for (const rule of rules) { const n = pull(rule, c); if (!seen.has(n)) { seen.add(n); todo.push(n); } } }
  return seen;
}

// the fewest pulls that turn `from` into `goal`: a list of lever numbers, or null if it cannot be done
export function solve(rules, from, goal) {
  const seen = new Set([from]), todo = [[from, []]];
  while (todo.length) { const [c, path] = todo.shift(); if (c === goal) return path; rules.forEach((rule, i) => { const n = pull(rule, c); if (!seen.has(n)) { seen.add(n); todo.push([n, [...path, i]]); } }); }
  return null;
}

// a puzzle as a castle sets it.  spec: { count (candles), rules, goal: [the candles lit when solved], start: [lit at the start - left out: any pattern at all], hardest (start only where the most pulls are needed),
// spring, look }.  r = the room's random numbers.
// Two-position levers start anywhere; the candles start in the spec's pattern, or, if there is none (or it cannot be solved), in one picked from those that can be - and never already solved.
export function makePuzzle(spec, r) {
  const goal = maskOf(spec.goal), fair = c => c !== goal && !!solve(spec.rules, c, goal), given = spec.start && maskOf(spec.start);
  let any = [...Array(1 << spec.count).keys()].filter(fair);
  if (spec.hardest) { const need = c => solve(spec.rules, c, goal).length, most = Math.max(...any.map(need)); any = any.filter(c => need(c) === most); }
  const start = spec.start && fair(given) ? given : r.pick(any);
  return { rules: spec.rules, goal, start, levers: r.i(0, (1 << spec.rules.length) - 1), spring: !!spec.spring, look: spec.look || 'candelabra' };
}

// how the candles burn now (save flag 'pzc_<room>'; until a lever is pulled, as they started)
export const candlesNow = (flags, pz) => flags['pzc_' + pz.id] ?? pz.start;
