// SAVE CODES: the saved game written out as a line of text, to keep somewhere safe and bring back later, or on another device.
// Why: the save lives in the browser's own storage, and Safari on an iPhone or iPad erases a website's storage after about a week without a visit (a game added to the Home Screen is spared,
// but it starts with storage of its own, apart from Safari's).  A code carries a game across any of those gaps: copy it into Notes, a message or a file, and paste it back.
// The code is the save's JSON, deflated (CompressionStream) and written in URL-safe base64:  ARX1.<data>.   (a browser that cannot deflate writes ARX0.<the JSON in base64>. instead)
// A code is found anywhere in what is pasted, and spaces and line breaks inside it are ignored, so a code that a mail program has wrapped, or that has words around it, still reads.
// The panel is HTML laid over the game (like the touch controls), not drawn in the canvas: the system's own copy, paste and share work only from real page elements.
import { fmtTime } from './util.js';
import { Audio_ as A } from './audio.js';
import { PWA, isIOS, isStandalone } from './pwa.js';

const zip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function encodeSave(json) {
  const raw = new TextEncoder().encode(json);
  if (zip) { try { return 'ARX1.' + b64(await pipe(raw, new CompressionStream('deflate'))) + '.'; } catch { /* written plain below */ } }
  return 'ARX0.' + b64(raw) + '.';
}
// -> the save object; throws an Error whose message is shown to the player
export async function decodeSave(text) {
  const m = /ARX([01])\.([A-Za-z0-9_\-\s]+)/.exec(String(text || ''));
  if (!m) throw new Error('No save code found here. A code begins with ARX1.');
  let bytes; try { bytes = unb64(m[2].replace(/\s+/g, '')); } catch { throw new Error('That code is damaged.'); }
  if (m[1] === '1') {
    if (!zip) throw new Error('This browser is too old to read save codes.');
    try { bytes = await pipe(bytes, new DecompressionStream('deflate')); } catch { throw new Error('That code is damaged or cut short: copy all of it.'); }
  }
  let s; try { s = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('That code is damaged or cut short: copy all of it.'); }
  if (!s || s.v !== 1 || typeof s.seed !== 'number' || typeof s.room !== 'string' || !s.flags || typeof s.flags !== 'object') throw new Error('That code is not an ARX NOCTIS save.');
  return s;
}
export function describeSave(s) {
  const slain = Object.keys(s.flags).filter(k => k.startsWith('boss_') && s.flags[k]).length;
  return `seed ${s.seed}, level ${s.level || 1}, ${slain} ${slain === 1 ? 'master' : 'masters'} slain, ${fmtTime(s.time || 0)} played`;
}

const CSS = `
#savecode { position: fixed; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: rgba(4,2,7,0.86);
  padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  font: 14px/1.4 Georgia, 'Times New Roman', serif; color: #e8dcc0; -webkit-touch-callout: default; touch-action: manipulation; }
#savecode .box { width: min(620px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 12px 16px; background: #0b0714; border: 1px solid #b8913f; box-shadow: inset 0 0 0 2px #2a1e10, 0 0 40px #000; }
#savecode h2 { margin: 0 0 4px; text-align: center; color: #e8b84a; font-size: 20px; letter-spacing: 5px; font-weight: normal; }
#savecode p { margin: 0 0 7px; color: #b9ab8e; font-size: 13px; }
#savecode p.now { text-align: center; color: #e8dcc0; }
#savecode p.warn { color: #e6c27a; border-left: 2px solid #b8913f; padding-left: 8px; }
#savecode textarea { display: block; width: 100%; box-sizing: border-box; height: 4.6em; resize: none; margin: 0; background: #05030a; color: #e8dcc0; border: 1px solid #4a3a2a; border-radius: 3px; padding: 5px 7px;
  font: 16px/1.3 ui-monospace, Menlo, Consolas, monospace; word-break: break-all; -webkit-user-select: text; user-select: text; }
#savecode .row { display: flex; flex-wrap: wrap; gap: 7px; margin: 8px 0 2px; justify-content: center; }
#savecode button { font: 13px Georgia, 'Times New Roman', serif; letter-spacing: 1px; color: #f0dcae; background: linear-gradient(#2c1a22, #150b13); border: 1px solid rgba(214,166,80,0.7); border-radius: 4px;
  padding: 6px 12px; min-height: 34px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#savecode button:hover, #savecode button:focus-visible { border-color: #e8b84a; color: #fff; outline: none; }
#savecode button.main { border-color: #e8b84a; background: linear-gradient(#5a3418, #2a140c); }
#savecode button[disabled] { opacity: 0.4; cursor: default; }
#savecode .msg { min-height: 1.4em; margin-top: 6px; text-align: center; color: #e6c27a; font-size: 13px; }
#savecode .msg.bad { color: #ec7a62; }
@media (max-height: 430px) { #savecode .box { padding: 8px 14px; } #savecode h2 { font-size: 17px; } #savecode p { font-size: 12px; margin-bottom: 5px; } #savecode textarea { height: 3.4em; } #savecode .row { margin-top: 6px; } #savecode button { min-height: 32px; padding: 4px 11px; } }
`;

// Opens the panel over the title screen; onClose(restored) runs when it is closed.
export function openSavePanel(g, onClose) {
  if (!document.getElementById('savecode-css')) { const st = document.createElement('style'); st.id = 'savecode-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = (tag, cls, txt, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; if (parent) parent.appendChild(e); return e; };
  const root = el('div'); root.id = 'savecode'; root.setAttribute('data-own-keys', '');          // (the game's own keys are not read while typing here: see input.js)
  const box = el('div', 'box', '', root);
  el('h2', '', 'SAVE CODE', box);
  const now = el('p', 'now', '', box);
  el('p', '', 'Your saved game, written out as a code. Keep a copy somewhere safe (in Notes, or in a message to yourself): the code brings the game back here or on another device.', box);
  if (isIOS() && !isStandalone()) el('p', 'warn', 'On an iPhone or iPad, Safari erases a website\'s saves after about a week without a visit. To keep them, add the game to your Home Screen (Share, then Add to Home Screen), copy this code first and paste it there: the Home Screen game has a save of its own.', box);
  const area = el('textarea', '', '', box); area.spellcheck = false; area.autocomplete = 'off'; area.setAttribute('autocapitalize', 'off'); area.setAttribute('autocorrect', 'off'); area.placeholder = 'Paste a save code here';
  const row1 = el('div', 'row', '', box), row2 = el('div', 'row', '', box), msg = el('div', 'msg', '', box);
  const btn = (row, label, fn, cls) => { const b = el('button', cls, label, row); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const say = (t, bad = false) => { msg.textContent = t; msg.classList.toggle('bad', bad); msg.scrollIntoView({ block: 'nearest' }); };          // (a small phone may have to scroll the panel to show it)

  let mine = '', mineSave = null, armed = null, closed = false;
  const refresh = async () => {
    const raw = g.savedText(); mineSave = null; mine = '';
    if (raw) { try { mineSave = JSON.parse(raw); mine = await encodeSave(raw); } catch { mineSave = null; } }
    now.textContent = mineSave ? 'Saved here: ' + describeSave(mineSave) + '.' : 'No game is saved here yet. To bring one back, paste its code below.';
    area.value = mine; sync();
  };
  const code = () => area.value.trim();
  const sync = () => { const has = !!code(); for (const b of [copyB, shareB, fileB]) if (b) b.disabled = !has; restB.disabled = !has || code() === mine; armed = null; };

  const copyB = btn(row1, 'COPY', async () => {
    let ok = false; try { await navigator.clipboard.writeText(code()); ok = true; } catch { area.focus(); area.select(); try { ok = document.execCommand('copy'); } catch {} }
    say(ok ? 'Copied. Paste it somewhere safe.' : 'Could not copy: select the code in the box and copy it by hand.', !ok);
  });
  const shareB = navigator.share ? btn(row1, 'SHARE', async () => {
    try { await navigator.share({ title: 'ARX NOCTIS save', text: 'ARX NOCTIS saved game (' + (mineSave && code() === mine ? describeSave(mineSave) : 'save code') + '):\n' + code() }); say('Shared.'); }
    catch (e) { if (e && e.name !== 'AbortError') say('Could not share: use COPY instead.', true); }
  }) : null;
  const fileB = btn(row1, 'SAVE AS FILE', () => {
    const a = el('a'); a.href = URL.createObjectURL(new Blob([code() + '\n'], { type: 'text/plain' })); a.download = 'arx-noctis-save' + (mineSave && code() === mine ? '-seed' + mineSave.seed : '') + '.txt';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); say('Saved as a file.');
  });
  if (navigator.clipboard && navigator.clipboard.readText) btn(row1, 'PASTE', async () => {
    try { const t = await navigator.clipboard.readText(); if (!t.trim()) { say('There is nothing to paste.', true); return; } area.value = t.trim(); sync(); say('Pasted. Press RESTORE to bring that game back.'); }
    catch { say('Could not paste: press and hold in the box (or right-click it) and choose Paste.', true); }
  });
  const pick = el('input'); pick.type = 'file'; pick.accept = '.txt,text/plain'; pick.style.display = 'none'; box.appendChild(pick);
  pick.addEventListener('change', async () => { const f = pick.files && pick.files[0]; pick.value = ''; if (!f) return; try { area.value = (await f.text()).trim(); sync(); say('Opened. Press RESTORE to bring that game back.'); } catch { say('Could not read that file.', true); } });
  btn(row1, 'OPEN FILE', () => pick.click());
  const restB = btn(row2, 'RESTORE', async () => {
    const text = code(); let s;
    try { s = await decodeSave(text); } catch (e) { say(e.message, true); A.sfx('back'); return; }
    if (mineSave && armed !== text) { armed = text; say('This replaces the game saved here (' + describeSave(mineSave) + '). Press RESTORE again to replace it.', true); return; }
    try { g.restoreSave(s); } catch { say('The browser would not store the save (is it in private browsing?).', true); return; }
    A.sfx('select'); close(true);
  }, 'main');
  if (PWA.install) btn(row2, 'INSTALL THE GAME', async () => {
    try { await PWA.install.prompt(); const c = await PWA.install.userChoice; if (c && c.outcome === 'accepted') { PWA.install = null; say('Installed.'); } } catch { say('Use the browser\'s menu to install the game.', true); }
  });
  btn(row2, 'CLOSE', () => close(false));
  area.addEventListener('input', sync);

  const keys = e => { if (e.key === 'Escape') { e.preventDefault(); close(false); } };
  function close(restored) {
    if (closed) return; closed = true; removeEventListener('keydown', keys, true); root.remove();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (!restored) A.sfx('back'); onClose(restored);
  }
  addEventListener('keydown', keys, true);
  document.body.appendChild(root); refresh(); copyB.focus({ preventScroll: true });
}
