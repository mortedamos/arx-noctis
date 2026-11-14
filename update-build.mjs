// Writes src/build.js: the build number (the number of the commit about to be made) and the date and time, shown small at the bottom right of the title screen.
//   node update-build.mjs        (run it just before each commit)
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
let n = 1; try { n = parseInt(execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10) + 1; } catch {}
const d = new Date(), p = v => String(v).padStart(2, '0');
const when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'src', 'build.js'), `// (written by update-build.mjs before each commit - do not edit)\nexport const BUILD = { n: ${n}, when: '${when}' };\n`);
console.log('build ' + n + '  ' + when);
