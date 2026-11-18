// SAVE FILES: the saved game written to a file (ending .ArxN) to keep anywhere, and read back from one.
// Why: the quick save lives in the browser's own storage, and Safari on an iPhone or iPad erases a website's storage after about a week without a visit (a game added to the Home Screen is spared,
// but it starts with storage of its own, apart from Safari's).  A file carries a game across any of those gaps, and from one device to another.
// The file is the save's JSON, gzipped (CompressionStream), nothing else - so it also opens in any tool that reads .gz when renamed.  A browser that cannot gzip writes the JSON as it is;
// reading accepts both (a gzip file starts with the bytes 1F 8B).
// The panels are HTML laid over the game (like the touch controls), not drawn in the canvas: a download, a share sheet and a file chooser are only allowed from a real tap on a real page element.
import { fmtTime } from './util.js';
import { Audio_ as A } from './audio.js';
import { PWA, isIOS, isStandalone } from './pwa.js';

export const EXT = '.ArxN';
const zip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function packSave(json) {
  const raw = new TextEncoder().encode(json);
  if (zip) { try { return await pipe(raw, new CompressionStream('gzip')); } catch { /* written plain below */ } }
  return raw;
}
const NUMS = ['seed', 'spawnX', 'spawnY', 'hp', 'maxHp', 'mp', 'maxMp', 'atk'], OBJS = ['flags', 'abilities', 'visited'];
const isSave = s => !!s && typeof s === 'object' && s.v === 1 && typeof s.room === 'string' && NUMS.every(k => Number.isFinite(s[k])) && OBJS.every(k => s[k] && typeof s[k] === 'object');
// -> the save object; throws an Error whose message is shown to the player
export async function unpackSave(bytes) {
  if (!bytes.length || bytes.length > 1e6) throw new Error('That is not an ARX NOCTIS save file.');
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (!zip) throw new Error('This browser is too old to read save files.');
    try { bytes = await pipe(bytes, new DecompressionStream('gzip')); } catch { throw new Error('That file is damaged or cut short.'); }
  }
  let s; try { s = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('That is not an ARX NOCTIS save file.'); }
  if (!isSave(s)) throw new Error('That is not an ARX NOCTIS save file.');
  return s;
}
export function describeSave(s) {
  const slain = Object.keys(s.flags).filter(k => k.startsWith('boss_') && s.flags[k]).length;
  return `seed ${s.seed}, level ${s.level || 1}, ${slain} ${slain === 1 ? 'master' : 'masters'} slain, ${fmtTime(s.time || 0)} played`;
}
export const saveFileName = s => 'arx-noctis-seed' + s.seed + '-lv' + (s.level || 1) + EXT;

const CSS = `
#arxfile { position: fixed; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; box-sizing: border-box; background: rgba(4,2,7,0.86);
  padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  font: 14px/1.4 Georgia, 'Times New Roman', serif; color: #e8dcc0; touch-action: manipulation; }
#arxfile .box { width: min(560px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 12px 16px; background: #0b0714; border: 1px solid #b8913f; box-shadow: inset 0 0 0 2px #2a1e10, 0 0 40px #000; }
#arxfile h2 { margin: 0 0 6px; text-align: center; color: #e8b84a; font-size: 20px; letter-spacing: 5px; font-weight: normal; }
#arxfile p { margin: 0 0 7px; color: #b9ab8e; font-size: 13px; }
#arxfile p.now { text-align: center; color: #e8dcc0; font-size: 14px; }
#arxfile p.warn { color: #e6c27a; border-left: 2px solid #b8913f; padding-left: 8px; }
#arxfile .row { display: flex; flex-wrap: wrap; gap: 7px; margin: 9px 0 2px; justify-content: center; }
#arxfile button { font: 13px Georgia, 'Times New Roman', serif; letter-spacing: 1px; color: #f0dcae; background: linear-gradient(#2c1a22, #150b13); border: 1px solid rgba(214,166,80,0.7); border-radius: 4px;
  padding: 6px 14px; min-height: 36px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#arxfile button:hover, #arxfile button:focus-visible { border-color: #e8b84a; color: #fff; outline: none; }
#arxfile button.main { border-color: #e8b84a; background: linear-gradient(#5a3418, #2a140c); }
#arxfile button[disabled] { opacity: 0.4; cursor: default; }
#arxfile .msg { min-height: 1.4em; margin-top: 6px; text-align: center; color: #e6c27a; font-size: 13px; }
#arxfile .msg.bad { color: #ec7a62; }
@media (max-height: 430px) { #arxfile .box { padding: 8px 14px; } #arxfile h2 { font-size: 17px; margin-bottom: 4px; } #arxfile p { font-size: 12px; margin-bottom: 5px; } #arxfile .row { margin-top: 6px; } #arxfile button { min-height: 32px; padding: 4px 11px; } }
`;

// an empty panel with a title; done(ok) runs once when it is closed (ESC or the CLOSE button, ok = false; or close(true) when the job is done)
function makePanel(title, done) {
  if (!document.getElementById('arxfile-css')) { const st = document.createElement('style'); st.id = 'arxfile-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = (tag, cls, txt, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; if (parent) parent.appendChild(e); return e; };
  const root = el('div'); root.id = 'arxfile'; root.setAttribute('data-own-keys', '');          // (the game's own keys are not read while this is up: see input.js)
  const box = el('div', 'box', '', root); el('h2', '', title, box);
  let closed = false, msg = null;
  const P = {
    el: (tag, cls, txt) => el(tag, cls, txt, box), row: () => el('div', 'row', '', box),
    btn: (row, label, fn, cls) => { const b = el('button', cls, label, row); b.type = 'button'; b.addEventListener('click', fn); return b; },
    say: (t, bad = false) => { if (!msg) msg = el('div', 'msg', '', box); msg.textContent = t; msg.classList.toggle('bad', bad); msg.scrollIntoView({ block: 'nearest' }); },          // (a small phone may have to scroll the panel to show it)
    close: ok => {
      if (closed) return; closed = true; removeEventListener('keydown', keys, true); root.remove();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      if (!ok) A.sfx('back'); done(ok);
    },
  };
  const keys = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); P.close(false); } };          // (stopPropagation: the same key must not also back out of the menu underneath)
  addEventListener('keydown', keys, true); document.body.appendChild(root);
  return P;
}
const download = file => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
};

// SAVE GAME: writes `save` (a save object) to a file.  `note` (optional) is a line of explanation shown above the buttons.  onClose() runs when the panel is closed.
export function openSavePanel(g, save, onClose, note = '') {
  const P = makePanel('SAVE GAME', () => onClose());
  P.el('p', 'now', 'Saved: ' + describeSave(save) + '.');
  if (note) P.el('p', 'warn', note);
  P.el('p', '', 'This writes your game to a file ending in ' + EXT + '. Keep it anywhere you like: LOAD GAME (on the title screen, or in the pause menu) brings the game back, here or on another device.');
  if (isIOS() && !isStandalone()) P.el('p', 'warn', 'On an iPhone or iPad, Safari erases a website\'s quick saves after about a week without a visit. A save file is safe. A game added to your Home Screen (Share, then Add to Home Screen) keeps its saves, but they are kept apart from Safari\'s: carry a game across with a save file.');
  const row = P.row(); let file = null;
  const preferShare = isIOS() && isStandalone();          // (a Home Screen game on an iPhone cannot be trusted to download a file: the share sheet has Save to Files)
  const saveB = P.btn(row, 'SAVE FILE', () => { if (!file) return; download(file); A.sfx('select'); P.say('Saved as ' + file.name + '. Look in your Downloads folder, and keep the file somewhere safe.'); }, preferShare ? '' : 'main');
  const shareB = navigator.share ? P.btn(row, 'SHARE FILE', async () => {
    try { await navigator.share({ files: [file], title: 'ARX NOCTIS save' }); P.say('Shared. Choose Save to Files (or a cloud folder) to keep it.'); }
    catch (e) { if (e && e.name !== 'AbortError') P.say('Could not share: use SAVE FILE instead.', true); }
  }, preferShare ? 'main' : '') : null;
  if (shareB) { shareB.hidden = true; if (preferShare) row.insertBefore(shareB, saveB); }
  if (PWA.install) P.btn(row, 'INSTALL THE GAME', async () => {
    try { await PWA.install.prompt(); const c = await PWA.install.userChoice; if (c && c.outcome === 'accepted') { PWA.install = null; P.say('Installed.'); } } catch { P.say('Use the browser\'s menu to install the game.', true); }
  });
  P.btn(row, 'CLOSE', () => P.close(false));
  saveB.disabled = true;
  packSave(JSON.stringify(save)).then(bytes => {
    file = new File([bytes], saveFileName(save), { type: 'application/octet-stream' });          // (octet-stream: the browser must not add .txt or .gz to the name)
    saveB.disabled = false; if (shareB && navigator.canShare && navigator.canShare({ files: [file] })) shareB.hidden = false;
    (preferShare && !shareB.hidden ? shareB : saveB).focus({ preventScroll: true });
  });
}

// LOAD GAME: asks for a save file.  Once one is chosen and checked the player presses LOAD AND PLAY, which stores it as the game saved in this browser (g.restoreSave) and closes with ok = true.
export function openLoadPanel(g, onClose) {
  const P = makePanel('LOAD GAME', ok => onClose(ok));
  P.el('p', '', 'Choose a save file made by SAVE GAME (its name ends in ' + EXT + ').');
  const mine = g.loadSave(); let found = null;
  const now = P.el('p', 'now'), warn = P.el('p', 'warn'); warn.hidden = true;
  const row = P.row();
  const pick = document.createElement('input'); pick.type = 'file'; pick.style.display = 'none'; row.appendChild(pick);
  if (!isIOS() && matchMedia('(pointer: fine)').matches) pick.accept = EXT.toLowerCase();          // (a phone's file picker greys out a file whose kind it does not know: no filter there)
  const playB = P.btn(row, 'LOAD AND PLAY', () => {
    if (!found) return;
    try { g.restoreSave(found); } catch { P.say('The browser would not store the save (is it in private browsing?).', true); return; }
    A.sfx('select'); P.close(true);
  }, 'main'); playB.disabled = true;
  const chooseB = P.btn(row, 'CHOOSE FILE', () => pick.click()); row.insertBefore(chooseB, playB);
  P.btn(row, 'CLOSE', () => P.close(false));
  pick.addEventListener('change', async () => {
    const f = pick.files && pick.files[0]; pick.value = ''; if (!f) return;
    found = null; playB.disabled = true; now.textContent = ''; warn.hidden = true;
    let s; try { if (f.size > 1e6) throw new Error('That is not an ARX NOCTIS save file.'); s = await unpackSave(new Uint8Array(await f.arrayBuffer())); } catch (e) { P.say(e && e.message ? e.message : 'Could not read that file.', true); A.sfx('back'); return; }
    found = s; now.textContent = f.name + ': ' + describeSave(s) + '.';
    if (mine && JSON.stringify(mine) !== JSON.stringify(s)) { warn.textContent = 'This replaces the quick save in this browser (' + describeSave(mine) + ').'; warn.hidden = false; }
    P.say('Press LOAD AND PLAY to begin from this save.'); playB.disabled = false; playB.focus({ preventScroll: true });
  });
  chooseB.focus({ preventScroll: true });
}
