// Regenerates tests/fixtures/legacy/e8-*.html: authentic shape-A markup (kit-blocks E8, static save) produced by
// the REAL E8 build in a real editor, not hand-written. Needs the fixture WP up. Side effects: temporarily swaps
// vibery-blocks for the E8 plugin (copied to plugins/kit-blocks-e8) and restores it.
import { launch, login, openEditor } from './lib.mjs';
import { wp } from './wpcli.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dst = 'vblk-k3-wp-1:/var/www/html/wp-content/plugins/kit-blocks-e8';
execFileSync('docker', ['exec', 'vblk-k3-wp-1', 'rm', '-rf', '/var/www/html/wp-content/plugins/kit-blocks-e8']);
execFileSync('docker', ['exec', 'vblk-k3-wp-1', 'mkdir', '-p', '/var/www/html/wp-content/plugins/kit-blocks-e8/build']);
execFileSync('docker', ['cp', ROOT + '/tests/legacy-e8/kit-blocks.php', dst + '/kit-blocks.php']);
for (const b of ['band', 'split', 'cell']) execFileSync('docker', ['cp', ROOT + '/tests/legacy-e8/' + b, dst + '/build/' + b]);
execFileSync('docker', ['exec', 'vblk-k3-wp-1', 'chown', '-R', 'www-data:www-data', '/var/www/html/wp-content/plugins/kit-blocks-e8']);
wp(['plugin', 'deactivate', 'vibery-blocks']);
wp(['plugin', 'activate', 'kit-blocks-e8']);
const { browser, ctx } = await launch();
await login(ctx);
const id = wp(['post', 'create', '--post_type=page', '--post_status=draft', '--post_title=gen-e8', '--post_content=<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->', '--porcelain']);
const pg = await openEditor(ctx, +id);
const build = async (spec) => pg.evaluate((spec) => {
  const mk = (n) => wp.blocks.createBlock(n.name, n.attrs || {}, (n.kids || []).map(mk));
  wp.data.dispatch('core/block-editor').resetBlocks([mk(spec)]);
  return wp.blocks.serialize(wp.data.select('core/block-editor').getBlocks());
}, spec);
const p = (t) => ({ name: 'core/paragraph', attrs: { content: t } });
const out = {
  'e8-default.html': { name: 'kit/band', kids: [{ name: 'kit/split', kids: [{ name: 'kit/cell', kids: [p('left')] }, { name: 'kit/cell', kids: [p('right')] }] }] },
  'e8-attrs.html': { name: 'kit/band', attrs: { tagName: 'header', contentMax: '1100px', minHeight: '420px', overlay: 'linear-gradient(90deg,rgba(0,0,0,.4),rgba(0,0,0,0))', bgImageUrl: 'https://vblk.invalid/img/hero.png', bgPosition: 'top left', bgSize: 'contain', backgroundColor: 'contrast', textColor: 'base', className: 'my-band' },
    kids: [{ name: 'kit/split', attrs: { cols: '1fr 2fr', gap: '32px', rowGap: '16px', stackAt: '900px', stackCols: '1fr', valign: 'center' },
      kids: [{ name: 'kit/cell', attrs: { type: 'cover-image', pad: '24px 32px', justify: 'center' }, kids: [p('a')] }, { name: 'kit/cell', attrs: { justify: 'space-between' }, kids: [p('b')] }] }] },
  'e8-nostack.html': { name: 'kit/split', attrs: { stackAt: '', cols: '1fr 1fr 1fr' }, kids: [{ name: 'kit/cell', kids: [p('1')] }, { name: 'kit/cell', kids: [p('2')] }, { name: 'kit/cell', kids: [p('3')] }] },
};
for (const [f, spec] of Object.entries(out)) {
  const html = await build(spec);
  if (!/<(section|div|header)[^>]*kit-(band|split|cell)/.test(html) || !/--kit-/.test(html)) throw new Error('not shape A: ' + f + '\n' + html);
  fs.writeFileSync(ROOT + '/tests/fixtures/legacy/' + f, html + '\n');
  console.log(f, html.length);
}
await browser.close();
wp(['plugin', 'deactivate', 'kit-blocks-e8']);
wp(['plugin', 'delete', 'kit-blocks-e8']);
wp(['post', 'delete', id, '--force']);
wp(['plugin', 'activate', 'vibery-blocks']);
