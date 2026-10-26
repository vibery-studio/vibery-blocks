// WP-version matrix check: kit/split must render side-by-side when the page was saved by a user WITHOUT unfiltered_html
// (KSES then filters post_content; WP 6.9 also strips `display` from style attrs). The layout must come from the
// compiler's class-keyed CSS, never from inline styles surviving KSES.
//   PROJ=vblk-69 WP=http://localhost:18211 node tests/e2e/wpver.mjs
import { launch, login, openEditor, census, WP } from './lib.mjs';
import { wp, rest } from './wpcli.mjs';
const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const ver = wp(['core', 'version']);
wp(['config', 'set', 'DISALLOW_UNFILTERED_HTML', 'true', '--raw']);   // nobody (even admin) has unfiltered_html
wp(['config', 'set', 'WP_ENVIRONMENT_TYPE', 'local']);
wp(['plugin', 'activate', 'vibery-blocks']);
try { wp(['user', 'delete', 'k3author', '--yes']); } catch (e) {}
wp(['user', 'create', 'k3author', 'k3author@example.com', '--role=editor', '--user_pass=k3-author-pass-1']);
const pw = wp(['user', 'application-password', 'create', 'k3author', 'e2e', '--porcelain']);
const content = `<!-- wp:kit/band {"uniqueId":"kc-9501"} --><!-- wp:kit/split {"cols":"1fr 1fr","gap":"24px","uniqueId":"kc-9502"} --><!-- wp:kit/cell {"pad":"16px","uniqueId":"kc-9503"} --><!-- wp:paragraph --><p>left</p><!-- /wp:paragraph --><!-- /wp:kit/cell --><!-- wp:kit/cell {"justify":"center","uniqueId":"kc-9504"} --><!-- wp:paragraph --><p>right</p><!-- /wp:paragraph --><!-- /wp:kit/cell --><!-- /wp:kit/split --><!-- /wp:kit/band -->`;
const base = WP;
const r = await fetch(base + '/?rest_route=/wp/v2/pages', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from('k3author:' + pw).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'wpver', content, status: 'publish' }) });
const page = await r.json();
ok(r.status === 201, 'author create page ' + r.status + JSON.stringify(page).slice(0, 200));
if (r.status !== 201) { console.log(JSON.stringify({ wp: ver, failures: fail })); process.exit(1); }
const caps = wp(['eval', 'echo json_encode(["unfiltered"=>user_can(get_user_by("login","k3author"),"unfiltered_html")]);']);
const { browser, ctx } = await launch();
const pg = await ctx.newPage();
const res = {};
for (const w of [1440, 375]) {
  await pg.setViewportSize({ width: w, height: 900 });
  await pg.goto(page.link, { waitUntil: 'load' });
  res[w] = await pg.evaluate(() => { const s = document.querySelector('.kit-split'); const c = [...document.querySelectorAll('.kit-split > .kit-cell')].map((e) => e.getBoundingClientRect());
    return { display: getComputedStyle(s).display, cols: getComputedStyle(s).gridTemplateColumns, sideBySide: c.length === 2 && Math.abs(c[0].top - c[1].top) < 2 && c[1].left > c[0].left + 20, xs: c.map((e) => Math.round(e.left)), ys: c.map((e) => Math.round(e.top)), hasInlineStyleAttr: !!document.querySelector('.kit-split[style]') }; });
}
ok(res[1440].display === 'grid' && res[1440].sideBySide, `${ver}: kit/split not side-by-side @1440 ${JSON.stringify(res[1440])}`);
ok(!res[375].sideBySide, `${ver}: kit/split should stack @375 ${JSON.stringify(res[375])}`);
// editor: blocks registered + 0 invalid (admin session; the saved markup is the same)
await login(ctx);
const ed = await openEditor(ctx, page.id);
const reg = await ed.evaluate(() => ['kit/band', 'kit/split', 'kit/cell', 'kit/countdown'].map((n) => !!wp.blocks.getBlockType(n)));
const c = await census(ed);
ok(reg.every(Boolean), `${ver}: kit blocks not registered in the editor ${reg}`);
ok(c.invalid.length === 0 && c.kit === 4, `${ver}: editor invalid=${c.invalid.length} kit=${c.kit}`);
await browser.close();
console.log(JSON.stringify({ wp: ver, editor: { registered: reg, kit: c.kit, invalid: c.invalid.length }, authorHasUnfilteredHtml: caps, saved: r.status, w1440: res[1440], w375: res[375], failures: fail }));
wp(['post', 'delete', String(page.id), '--force']); wp(['user', 'delete', 'k3author', '--yes']);
process.exit(fail.length ? 1 : 0);
