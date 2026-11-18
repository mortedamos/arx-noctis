// KEEPING THE GAME ON A PHONE.  Three things that protect a player's save and spare the download:
//   * the service worker (sw.js) keeps the music and the recorded sounds once they are fetched (about 60 MB: most of the game's weight), and lets the game be added to the Home Screen as an app.
//     It is registered everywhere except localhost (a stored sound would hide a sound just replaced with the Sound Browser): ?sw=1 turns it on there for testing, ?sw=0 turns it off anywhere
//     (and either way off removes it, with what it had stored);
//   * keepStorage() asks the browser to keep the game's storage for good (navigator.storage.persist): asked once a visit, when the game first saves;
//   * the install prompt of Chrome / Edge is kept (PWA.install) so the SAVE GAME panel can offer an INSTALL button.  iPhones have no such prompt: the player is told to use Share > Add to Home Screen.
// Why it matters on an iPhone: Safari erases a website's storage (the save!) after about a week without a visit, but not a game added to the Home Screen.  See savefile.js for the other half.
export const PWA = { install: null, persisted: null, sw: false };

const q = new URLSearchParams(location.search), local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const want = q.get('sw') === '1' || (!local && q.get('sw') !== '0');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const reg = () => navigator.serviceWorker.register('./sw.js').then(() => { PWA.sw = true; }).catch(e => console.warn('service worker not registered:', e.message));
  if (want) { if (document.readyState === 'complete') reg(); else addEventListener('load', reg); }          // (after the page has loaded: it must not slow the start)
  else {          // (off: the worker goes, and what it stored - on every visit, since a worker just removed still serves the page that removed it, and may store a little more)
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if (self.caches) caches.keys().then(ks => ks.filter(k => k.startsWith('arx-noctis')).forEach(k => caches.delete(k))).catch(() => {});
  }
}
addEventListener('beforeinstallprompt', e => { PWA.install = e; });          // (not cancelled: the browser may still offer the game itself)
addEventListener('appinstalled', () => { PWA.install = null; });

let asked = false;
export function keepStorage() {
  if (asked) return; asked = true;
  try { const s = navigator.storage; if (s && s.persist) s.persisted().then(p => p || s.persist()).then(ok => { PWA.persisted = !!ok; }).catch(() => {}); } catch {}
}
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);          // (an iPad says it is a Mac)
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;          // (opened from the Home Screen)
