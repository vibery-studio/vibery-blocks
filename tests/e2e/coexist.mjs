// Legacy "Kit Blocks" (shipped in older hosted bundles) and vibery-blocks active together: no fatal, we step aside, admin is told.
import { launch, login, WP } from './lib.mjs';
import { wp } from './wpcli.mjs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const P = '/var/www/html/wp-content/plugins/kit-blocks-e8';
const d = (...a) => execFileSync('docker', a);
d('exec', (process.env.PROJ || 'vblk-k3') + '-wp-1', 'sh', '-c', `rm -rf ${P} && mkdir -p ${P}/build`);
d('cp', ROOT + '/tests/legacy-e8/kit-blocks.php', (process.env.PROJ || 'vblk-k3') + '-wp-1:' + P + '/kit-blocks.php');
for (const b of ['band', 'split', 'cell']) d('cp', ROOT + '/tests/legacy-e8/' + b, `${process.env.PROJ || 'vblk-k3'}-wp-1:${P}/build/${b}`);
d('exec', (process.env.PROJ || 'vblk-k3') + '-wp-1', 'chown', '-R', 'www-data:www-data', P);
const fail = [];
try {
  wp(['plugin', 'activate', 'kit-blocks-e8', 'vibery-blocks']);
  const front = await fetch(WP + '/?s1=1'); 
  if (front.status !== 200) fail.push('front status ' + front.status);
  const { browser, ctx } = await launch(); await login(ctx);
  const pg = await ctx.newPage();
  const r = await pg.goto(WP + '/wp-admin/plugins.php');
  const txt = await pg.content();
  if (r.status() !== 200) fail.push('plugins.php ' + r.status());
  if (!/older "Kit Blocks" plugin is still active/.test(txt) && !/older &quot;Kit Blocks&quot; plugin is still active/.test(txt)) fail.push('admin notice missing');
  const registered = wp(['eval', 'echo defined("VIBERY_BLOCKS_VER") ? "vibery-loaded" : "vibery-stepped-aside";']);
  if (registered !== 'vibery-stepped-aside') fail.push('vibery-blocks did not step aside: ' + registered);
  await browser.close();
  console.log(JSON.stringify({ coexist: { front: front.status, steppedAside: registered, noticeShown: !fail.includes('admin notice missing') }, failures: fail }));
} finally {
  try { wp(['plugin', 'deactivate', 'kit-blocks-e8']); wp(['plugin', 'delete', 'kit-blocks-e8']); } catch (e) {}
  wp(['plugin', 'activate', 'vibery-blocks']);
}
process.exit(fail.length ? 1 : 0);
