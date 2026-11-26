// THE ANDROID APP.  The game is also packed into an Android app with Capacitor (tools/android/): the very same files, kept inside the app and shown in the phone's WebView - no network needed.
// Everything that differs in there is here.  On the web (and in a Home Screen app) every function does nothing and no plugin is asked for.
//   * isNative(): are we inside that app?  (Capacitor injects its bridge into the page before any script runs.)
//   * shareFileNative(file): SAVE GAME.  A WebView cannot download a blob, so the file is written to the app's cache folder and handed to Android's share sheet (Drive, Files, mail ...).
//   * the phone's BACK button opens the pause menu (as Esc does, and steps back through the menus); on the title screen's first menu it leaves the game.
//   * the service worker is not used inside the app (see pwa.js): the files are in the app already, so there is nothing to keep.
// The plugins (Filesystem, Share, App) are used through Capacitor.registerPlugin(name), which needs no bundler: the game stays plain ES modules.
export const isNative = () => { try { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); } catch { return false; } };
const plugin = name => window.Capacitor.registerPlugin(name);
const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(file); });

export async function shareFileNative(file) {
  const data = await toBase64(file);
  const { uri } = await plugin('Filesystem').writeFile({ path: file.name, data, directory: 'CACHE' });          // (no encoding given = the data is base64)
  await plugin('Share').share({ title: 'ARX NOCTIS save', dialogTitle: 'Keep your ARX NOCTIS save', files: [uri] });
}

if (isNative()) {
  const esc = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Escape', key: 'Escape' }));
  try {
    plugin('App').addListener('backButton', () => {
      const g = window.game;
      if (g && g.state === 'title' && g.title && g.title.mode === 'main') { plugin('App').exitApp(); return; }
      esc('keydown'); setTimeout(() => esc('keyup'), 60);
    });
  } catch (e) { console.warn('back button not wired:', e); }
}
