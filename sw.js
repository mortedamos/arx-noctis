// THE SERVICE WORKER (registered by src/pwa.js).  It lets ARX NOCTIS be added to a phone's Home Screen as an app, and keeps what the game has downloaded:
//   * SOUND - the music and the recorded effects, about 60 MB and most of the game's weight - is kept once it has been fetched and is played from here on every later visit, not downloaded
//     again.  Each file is checked against the server at most twice a day, with a HEAD request (a few hundred bytes): when its size has changed (a new track, a new effect chosen in the Sound
//     Browser) it is fetched afresh.  The size, not the ETag: GitHub Pages gives every file a new ETag on every publish, which would download all the music again after each push.
//     The game's lists of files (music/files.json, assets/sfx/files.json) also let go of stored sounds that are no longer listed (renamed or removed);
//   * EVERYTHING ELSE (the page, the code, the pictures, the text files) comes from the network exactly as before, so a new build is seen at once.  The copy kept here is used only when the
//     network fails: the game still starts offline, with whatever it has already fetched.  A file is passed on only once ALL of it has arrived, and is asked for again if it did not: a
//     connection that dropped half way through one script used to stop the whole game from starting ("error loading dynamically imported module").
// Nothing is downloaded in advance: the background loader (src/loader.js) still decides what to fetch and when, so a phone on mobile data fetches no more than before.
const CACHE = 'arx-noctis-1';          // (change the number to throw away everything stored, on every player's device)
const AUDIO = /\.(mp3|ogg|wav|m4a|flac|opus)$/i;
// The page, the code, the lists and the text files: asked about EVERY time (a tiny "unchanged" answer when they are), because GitHub Pages tells the browser to keep any file for ten minutes
// (Cache-Control: max-age=600), and a plain fetch() here obeys that - so a returning player kept the old build (and the old build date on the title screen) for up to ten minutes after a publish.
// Pictures and fonts are left to the browser's own cache: they change rarely, and there are hundreds of them.
const REVALIDATE = /(\.(html|js|mjs|css|json|txt|webmanifest)|\/)$/i;
const TRIES = 3;                  // how often a file is asked for before giving up on the network
const RECHECK = 12 * 3600e3;          // ms between two checks of the same sound
const LISTS = [[/\/(music\/files\.json|__music)$/, 'music/'], [/\/(assets\/sfx\/files\.json|__sfx)$/, 'assets/sfx/']];          // (a list of files -> the folder it lists)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('arx-noctis') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  const key = url.origin + url.pathname;          // (a file is stored without its query: ?retry=1, ?nopause ... are not part of what it is)
  e.respondWith(AUDIO.test(url.pathname) ? sound(e, req, key) : fresh(e, req, key, url));
});

// the network first (the whole file, asked for again if it breaks off); the stored copy when the network fails
async function fresh(e, req, key, url) {
  let failed, hit = null;
  for (let go = 0; go < TRIES; go++) {
    try {
      const res = await fetch(req, REVALIDATE.test(url.pathname) ? { cache: 'no-cache' } : undefined);          // ('no-cache' = check with the server first, whatever max-age says)
      if (res.status !== 200 || res.type !== 'basic') return res;
      const whole = await complete(res);          // (throws if the transfer breaks off)
      keep(e, store(key, whole.clone()));
      const list = LISTS.find(([re]) => re.test(url.pathname)); if (list) keep(e, prune(whole.clone(), list[1]));
      return whole;
    } catch (err) {
      failed = err;
      if (!go) hit = await stored(req, key);
      if ((hit && go) || self.navigator.onLine === false) break;          // (with a copy kept here: one more go, straight away, and then that - so starting offline is hardly slower)
      if (!hit && go < TRIES - 1) await new Promise(r => setTimeout(r, 400 * (go + 1)));
    }
  }
  hit ||= await stored(req, key);
  if (hit) return hit; throw failed;
}
async function stored(req, key) {
  const c = await caches.open(CACHE);
  return (await c.match(key)) || (req.mode === 'navigate' ? (await c.match(self.registration.scope)) || (await c.match(self.registration.scope + 'index.html')) : null) || null;
}
// the same answer, with every byte of it already here.  (What arrived is already unpacked, so the headers that describe how it travelled are put right.)
async function complete(res) {
  const body = await res.arrayBuffer(), headers = new Headers(res.headers);
  headers.delete('Content-Encoding'); headers.set('Content-Length', String(body.byteLength));
  return new Response(body, { status: res.status, statusText: res.statusText, headers });
}
// (a copy is written only when it differs from the one already kept: a file published again unchanged keeps its stored copy)
async function store(key, res) {
  try {
    const c = await caches.open(CACHE), old = await c.match(key), h = r => [r.headers.get('ETag'), r.headers.get('Last-Modified'), r.headers.get('Content-Length')].join('|');
    if (old && h(old) === h(res) && (res.headers.get('ETag') || res.headers.get('Last-Modified'))) { if (res.body) res.body.cancel(); return; }
    await c.put(key, res);
  } catch { /* storage full: the game simply runs from the network */ }
}

// sound: the stored copy first (and a quiet check now and then); a byte range of it for an <audio> element that streams
async function sound(e, req, key) {
  const c = await caches.open(CACHE), hit = await c.match(key), range = req.headers.get('Range');
  if (hit) { keep(e, recheck(c, key, hit)); return range ? slice(hit, range) : hit; }
  if (range) return fetch(req);          // (a track streaming before it is stored: straight from the network; the loader's own fetch of it is what gets stored)
  const res = await fetch(req);
  if (res.status === 200 && res.type === 'basic') keep(e, c.put(key, res.clone()).then(() => mark(c, key)).catch(() => {}));
  return res;
}
// (work that goes on after the answer has been given; it runs even if a browser will not wait for it)
function keep(e, p) { try { e.waitUntil(p); } catch { /* the promise still runs */ } }
async function slice(res, range) {
  const blob = await res.blob(), size = blob.size, m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) return new Response(blob, { status: 200, headers: res.headers });
  let a, b;
  if (m[1] === '') { a = Math.max(0, size - +m[2]); b = size - 1; } else { a = +m[1]; b = m[2] === '' ? size - 1 : Math.min(+m[2], size - 1); }
  if (a >= size || a > b) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(a, b + 1), { status: 206, statusText: 'Partial Content', headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(b - a + 1), 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes' } });
}

// when each stored sound was last checked: kept in the cache itself, as one small JSON file
const CHECKS = () => self.registration.scope + '__sw-checks.json';
let checks = null, writing = null;
async function loadChecks(c) { if (!checks) { try { const r = await c.match(CHECKS()); checks = r ? await r.json() : {}; } catch { checks = {}; } } return checks; }
function saveChecks(c) {
  return writing ||= new Promise(r => setTimeout(r, 1500)).then(() => { writing = null; return c.put(CHECKS(), new Response(JSON.stringify(checks), { headers: { 'Content-Type': 'application/json' } })); }).catch(() => {});
}
async function mark(c, key) { (await loadChecks(c))[key] = Date.now(); return saveChecks(c); }
async function recheck(c, key, hit) {
  const ch = await loadChecks(c); if (Date.now() - (ch[key] || 0) < RECHECK) return; ch[key] = Date.now();
  try {
    const had = hit.headers.get('Content-Length'), h = await fetch(key, { method: 'HEAD', cache: 'no-store' }), now = h.headers.get('Content-Length');
    if (h.ok && now && had && now !== had) { const r = await fetch(key, { cache: 'no-store' }); if (r.status === 200) await c.put(key, r); }
  } catch { /* offline: checked another time */ }
  return saveChecks(c);
}
// a list of files has come: stored sounds of that folder that it no longer names are let go
async function prune(res, dir) {
  try {
    const names = new Set(await res.json()); if (!names.size) return;
    const c = await caches.open(CACHE), base = self.registration.scope + dir;
    for (const r of await c.keys()) {
      if (!r.url.startsWith(base) || !AUDIO.test(r.url)) continue;
      const name = decodeURIComponent(r.url.slice(base.length)); if (!name.includes('/') && !names.has(name)) await c.delete(r);
    }
  } catch { /* not a list after all */ }
}
