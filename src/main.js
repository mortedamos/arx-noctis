import { loadAll } from './assets.js';
import './pwa.js';          // (the service worker, and the Home Screen install: see pwa.js)

const q = new URLSearchParams(location.search);
const setBar = f => { const b = document.getElementById('barfill'); if (b) b.style.width = Math.round(f * 100) + '%'; };

async function boot() {
  await loadAll(setBar);
  if (q.has('viewer')) { (await import('./viewer.js')).runViewer(q.get('viewer')); return; }
  const game = await import('./game.js');
  await game.start();
  document.getElementById('boot').classList.add('done');
}
// A file of the game that did not arrive (a connection that dropped) stops the start, and a script that failed once cannot be asked for again in the same page: so load the page afresh, once,
// by itself - and if that fails too, say so and offer to try again.
boot().then(() => { try { sessionStorage.removeItem('arx-reloaded'); } catch {} }).catch(e => {
  console.error(e);
  const text = String((e && e.message) || e), lost = /dynamically imported module|module script|failed to fetch|failed to load|load failed|networkerror/i.test(text);
  try { if (lost && !sessionStorage.getItem('arx-reloaded')) { sessionStorage.setItem('arx-reloaded', '1'); setTimeout(() => location.reload(), 800); return; } } catch {}          // (no storage to remember that it tried: it must not reload for ever)
  const m = document.getElementById('bootmsg'); if (!m) return;
  m.innerHTML = 'Failed to start:<br><code></code>' + (lost ? '<br><br><button type="button">TRY AGAIN</button>' : '');
  m.querySelector('code').textContent = text; const b = m.querySelector('button'); if (b) b.onclick = () => location.reload();
});
