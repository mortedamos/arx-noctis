// THE ANDROID APP.  The game is also packed into an Android app with Capacitor (tools/android/): the very same files, kept inside the app and shown in the phone's WebView - no network needed.
// Everything that differs in there is here.  On the web (and in a Home Screen app) every function does nothing and no plugin is asked for.
//   * isNative(): are we inside that app?  (Capacitor injects its bridge into the page before any script runs.)
//   * saveFileNative(file): SAVE GAME.  A WebView cannot download a blob, so Android's own "save as" screen asks where to put the file (Downloads, any folder, a cloud drive).
//   * shareFileNative(file): SHARE FILE.  The file is written to the app's cache folder and handed to Android's share sheet (mail, Drive, a nearby device ...).
//   * the phone's BACK button opens the pause menu (as Esc does, and steps back through the menus); on the title screen's first menu it leaves the game.
//   * the service worker is not used inside the app (see pwa.js): the files are in the app already, so there is nothing to keep.
// The plugins (Filesystem, Share, App, and the app's own SaveFile: SaveFilePlugin.java) are the ones the injected bridge lists in Capacitor.Plugins, so no bundler is needed: the game stays plain ES modules.
// (Capacitor.registerPlugin is NOT there: it belongs to the @capacitor/core library, which the game does not load.)
export const isNative = () => { try { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); } catch { return false; } };
const plugin = name => window.Capacitor.Plugins[name];
const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(file); });

// -> the name the file was saved under, or null when the player backed out
export async function saveFileNative(file) {
  const r = await plugin('SaveFile').save({ name: file.name, data: await toBase64(file) });
  return r.saved ? r.name || file.name : null;
}

export async function shareFileNative(file) {
  const data = await toBase64(file);
  const { uri } = await plugin('Filesystem').writeFile({ path: file.name, data, directory: 'CACHE' });          // (no encoding given = the data is base64)
  await plugin('Share').share({ title: 'ARX NOCTIS save', dialogTitle: 'Keep your ARX NOCTIS save', files: [uri] });
}

if (isNative()) {
  // sent to the focused element and left to bubble, as a real key is: a save file panel can then keep it (sent to window itself, the same press also backed out of the menu underneath)
  const esc = type => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent(type, { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
  try {
    plugin('App').addListener('backButton', () => {
      const g = window.game;
      if (g && g.state === 'title' && g.title && g.title.mode === 'main') { plugin('App').exitApp(); return; }
      esc('keydown'); setTimeout(() => esc('keyup'), 60);
    });
  } catch (e) { console.warn('back button not wired:', e); }
}
