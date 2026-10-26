// Eject on a given WP version: eject -> plugin OFF -> kit/split still side-by-side -> revert byte-identical.
//   PROJ=vblk-69 WP=http://localhost:18211 node tests/e2e/wpver-eject.mjs   (run after wpver.mjs; resets DISALLOW_UNFILTERED_HTML)
import { launch, WP } from './lib.mjs';
import { wp, rest, appPassword, content } from './wpcli.mjs';
try { wp(['config', 'delete', 'DISALLOW_UNFILTERED_HTML']); } catch (e) {}
wp(['plugin', 'activate', 'vibery-blocks']);
const ver = wp(['core', 'version']); const fail = [];
const body = `<!-- wp:kit/band {"uniqueId":"kc-9601"} --><!-- wp:kit/split {"cols":"1fr 1fr","gap":"24px","uniqueId":"kc-9602"} --><!-- wp:kit/cell {"pad":"16px","uniqueId":"kc-9603"} --><!-- wp:paragraph --><p>left</p><!-- /wp:paragraph --><!-- /wp:kit/cell --><!-- wp:kit/cell {"uniqueId":"kc-9604"} --><!-- wp:paragraph --><p>right</p><!-- /wp:paragraph --><!-- /wp:kit/cell --><!-- /wp:kit/split --><!-- /wp:kit/band -->`;
const id = wp(['post', 'create', '-', '--post_type=page', '--post_status=publish', '--post_title=ej', '--porcelain'], body);
const original = content(id);
const pw = appPassword();
const link = wp(['post', 'get', id, '--field=url']);
const { browser, ctx } = await launch(); const pg = await ctx.newPage();
const sbs = async () => { await pg.setViewportSize({ width: 1440, height: 900 }); await pg.goto(link, { waitUntil: 'load' });
  return pg.evaluate(() => { const c = [...document.querySelectorAll('.kit-split > .kit-cell')].map((e) => e.getBoundingClientRect()); return c.length === 2 && Math.abs(c[0].top - c[1].top) < 2 && c[1].left > c[0].left + 20 ? [Math.round(c[0].width), Math.round(c[1].width)] : false; }); };
const before = await sbs();
const ej = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: +id });
if (ej.body.status !== 'ejected') fail.push('eject ' + JSON.stringify(ej.body).slice(0, 200));
wp(['plugin', 'deactivate', 'vibery-blocks']);
const off = await sbs();
wp(['plugin', 'activate', 'vibery-blocks']);
const rv = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject/revert', { post_id: +id });
if (JSON.stringify(before) !== JSON.stringify(off) || !before) fail.push(`ejected+plugin off ${JSON.stringify(off)} vs original ${JSON.stringify(before)}`);
if (rv.body.status !== 'reverted' || content(id) !== original) fail.push('revert not byte-identical');
await browser.close(); wp(['post', 'delete', id, '--force']);
console.log(JSON.stringify({ wp: ver, cellWidthsOriginal: before, cellWidthsEjectedPluginOff: off, revertByteIdentical: content === undefined ? null : rv.body.status === 'reverted', failures: fail }));
process.exit(fail.length ? 1 : 0);
