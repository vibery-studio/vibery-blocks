// vibery-blocks K-2b proof (run per WordPress version):
//   1. KSES: a page with kit/layer, list/wrap kit/split and core per-viewport visibility saved over REST by an EDITOR
//      on a site with DISALLOW_UNFILTERED_HTML (nobody has unfiltered_html) keeps every new attribute;
//   2. front: layer geometry (badge at the cell's top-right, decorative layer aria-hidden + behind the text),
//      real <ul>/<li> list semantics, wrap row keeps item widths, visibility hides exactly on core's viewports
//      (mobile ≤ 480, tablet ≤ 782, desktop above) — measured at 390 / 768 / 1440;
//   3. real block editor: blocks registered, 0 invalid on the new page AND on pre-K-2b saved shapes
//      (tests/fixtures/k2-emitted/*.html = K-2 emitter output, vibery-blocks 1.0.0 era).
//   PROJ=vblk-k2b71 WP=http://localhost:18521 WP_PASS=... node tests/e2e/k2b.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, login, openEditor, census, WP } from './lib.mjs';
import { wp } from './wpcli.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fail = []; const ok = (c, m) => { if (!c) fail.push(m); };
const ver = wp(['core', 'version']);
wp(['config', 'set', 'DISALLOW_UNFILTERED_HTML', 'true', '--raw']);
wp(['config', 'set', 'WP_ENVIRONMENT_TYPE', 'local']);
wp(['plugin', 'activate', 'vibery-blocks']);
try { wp(['theme', 'activate', 'kit-base']); } catch (e) {}
try { wp(['user', 'delete', 'k2bauthor', '--yes']); } catch (e) {}
wp(['user', 'create', 'k2bauthor', 'k2bauthor@example.com', '--role=editor', '--user_pass=k2b-author-pass-1']);
const apw = wp(['user', 'application-password', 'create', 'k2bauthor', 'e2e', '--porcelain']);
const unfiltered = wp(['eval', 'echo user_can(get_user_by("login","k2bauthor"),"unfiltered_html")?"yes":"no";']);
ok(unfiltered === 'no', 'editor must NOT have unfiltered_html for the KSES proof');

const P = (s) => s.replace(/\n\s*/g, '');
const content = P(`
<!-- wp:kit/band {"uniqueId":"kc-9701","style":{"spacing":{"padding":{"top":"40px","right":"40px","bottom":"40px","left":"40px"}}}} -->
<!-- wp:kit/layer {"x":"20px","y":"10px","width":"300px","height":"120px","z":-1,"decorative":true,"uniqueId":"kc-9702","style":{"color":{"background":"#ffe8a3"},"border":{"radius":"60px"}}} -->
<!-- /wp:kit/layer -->
<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">Layered heading</h1><!-- /wp:heading -->
<!-- wp:paragraph {"metadata":{"blockVisibility":{"viewport":{"mobile":false}}}} --><p>hidden on mobile</p><!-- /wp:paragraph -->
<!-- wp:paragraph {"metadata":{"blockVisibility":{"viewport":{"tablet":false,"desktop":false}}}} --><p>mobile only</p><!-- /wp:paragraph -->
<!-- wp:kit/split {"cols":"1fr 1fr","gap":"24px","stackAt":"","uniqueId":"kc-9703","metadata":{"blockVisibility":{"viewport":{"tablet":false}}}} -->
<!-- wp:kit/cell {"uniqueId":"kc-9704","style":{"color":{"background":"#eeeeee"},"spacing":{"padding":{"top":"20px","right":"20px","bottom":"20px","left":"20px"}}}} -->
<!-- wp:kit/layer {"anchorX":"end","x":"12px","y":"12px","z":2,"uniqueId":"kc-9705","style":{"color":{"background":"#d93025"},"border":{"radius":"12px"},"spacing":{"padding":{"top":"2px","right":"10px","bottom":"2px","left":"10px"}}}} -->
<!-- wp:paragraph --><p>Sale</p><!-- /wp:paragraph -->
<!-- /wp:kit/layer -->
<!-- wp:paragraph --><p>Card with a badge</p><!-- /wp:paragraph -->
<!-- /wp:kit/cell -->
<!-- wp:kit/cell {"uniqueId":"kc-9706"} --><!-- wp:paragraph --><p>Second cell</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- /wp:kit/split -->
<!-- wp:kit/split {"gap":"8px","rowGap":"8px","tagName":"ul","wrap":true,"justify":"center","uniqueId":"kc-9707"} -->
<!-- wp:kit/cell {"uniqueId":"kc-9708","style":{"color":{"background":"#e0e7ff"},"border":{"radius":"16px"},"spacing":{"padding":{"top":"4px","right":"12px","bottom":"4px","left":"12px"}}}} --><!-- wp:paragraph --><p>Short</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- wp:kit/cell {"uniqueId":"kc-9709","style":{"color":{"background":"#e0e7ff"},"border":{"radius":"16px"},"spacing":{"padding":{"top":"4px","right":"12px","bottom":"4px","left":"12px"}}}} --><!-- wp:paragraph --><p>A much longer pill label</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- wp:kit/cell {"uniqueId":"kc-9710","style":{"color":{"background":"#e0e7ff"},"border":{"radius":"16px"},"spacing":{"padding":{"top":"4px","right":"12px","bottom":"4px","left":"12px"}}}} --><!-- wp:paragraph --><p>Mid pill</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- /wp:kit/split -->
<!-- wp:kit/split {"cols":"repeat(auto-fit,minmax(clamp(160px, 10vw + 40px, 260px),1fr))","gap":"16px","stackAt":"","tagName":"ol","uniqueId":"kc-9711"} -->
<!-- wp:kit/cell {"uniqueId":"kc-9712"} --><!-- wp:paragraph --><p>one</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- wp:kit/cell {"uniqueId":"kc-9713"} --><!-- wp:paragraph --><p>two</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- wp:kit/cell {"uniqueId":"kc-9714"} --><!-- wp:paragraph --><p>three</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->
<!-- /wp:kit/split -->
<!-- /wp:kit/band -->`);

const r = await fetch(WP + '/?rest_route=/wp/v2/pages', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from('k2bauthor:' + apw).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'k2b', content, status: 'publish', template: '' }) });
const page = await r.json();
ok(r.status === 201, 'editor create page ' + r.status + JSON.stringify(page).slice(0, 200));
if (r.status !== 201) { console.log(JSON.stringify({ wp: ver, failures: fail })); process.exit(1); }
try { wp(['post', 'meta', 'update', String(page.id), '_wp_page_template', 'page-no-title']); } catch (e) {}

// 1. KSES: saved post_content keeps every K-2b attribute (block comments) and every core block's markup
const saved = wp(['post', 'get', String(page.id), '--field=post_content']);
for (const needle of ['"metadata":{"blockVisibility":{"viewport":{"mobile":false}}}', '"viewport":{"tablet":false,"desktop":false}', 'wp:kit/layer {"anchorX":"end"',
  '"decorative":true', '"z":-1', '"tagName":"ul","wrap":true,"justify":"center"', '"tagName":"ol"', 'clamp(160px, 10vw + 40px, 260px)']) {
  ok(saved.includes(needle), `${ver}: KSES (editor, no unfiltered_html) lost ${needle}`);
}

// 2. front
const { browser, ctx } = await launch();
const pg = await ctx.newPage();
const front = {};
for (const w of [1440, 768, 390]) {
  await pg.setViewportSize({ width: w, height: 1000 });
  await pg.goto(page.link, { waitUntil: 'load' });
  front[w] = await pg.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const shown = (txt) => [...document.querySelectorAll('p')].some((p) => p.textContent === txt && p.offsetParent !== null);
    const cell = q('.kc-9704'), badge = q('.kc-9705'), deco = q('.kc-9702'), h1 = q('h1');
    return {
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      cell: box(cell), badge: box(badge), deco: box(deco), h1: box(h1),
      badgePos: badge && getComputedStyle(badge).position, decoZ: deco && getComputedStyle(deco).zIndex, decoAria: deco && deco.getAttribute('aria-hidden'),
      badgeAria: badge && badge.getAttribute('aria-hidden'),
      h1Top: h1 && document.elementFromPoint(h1.getBoundingClientRect().left + 5, h1.getBoundingClientRect().top + 5) === h1,
      ulTag: q('.kc-9707') && q('.kc-9707').tagName, liCount: document.querySelectorAll('ul.kc-9707 > li.kit-cell').length,
      olTag: q('.kc-9711') && q('.kc-9711').tagName, olLi: document.querySelectorAll('ol.kc-9711 > li').length,
      listStyle: q('.kc-9707') && getComputedStyle(q('.kc-9707')).listStyleType,
      pills: [...document.querySelectorAll('ul.kc-9707 > li')].map(box),
      hiddenMobile: shown('hidden on mobile'), mobileOnly: shown('mobile only'), splitShown: !!(q('.kc-9703') && q('.kc-9703').offsetParent),
    };
  });
}
const F = front[1440];
ok(!front[1440].overflowX && !front[768].overflowX && !front[390].overflowX, `${ver}: horizontal overflow`);
ok(F.badgePos === 'absolute' && Math.abs((F.cell.x + F.cell.w) - (F.badge.x + F.badge.w) - 12) <= 1 && Math.abs(F.badge.y - F.cell.y - 12) <= 1, `${ver}: badge not 12px from the cell's top-right: ${JSON.stringify([F.cell, F.badge])}`);
ok(F.badgeAria === null, `${ver}: content layer must not be aria-hidden`);
ok(F.decoAria === 'true' && F.decoZ === '-1' && F.deco.w === 300 && F.deco.h === 120, `${ver}: decorative layer ${JSON.stringify([F.deco, F.decoAria, F.decoZ])}`);
ok(F.h1Top, `${ver}: heading must paint above the decorative layer behind it`);
ok(F.ulTag === 'UL' && F.liCount === 3 && F.olTag === 'OL' && F.olLi === 3 && F.listStyle === 'none', `${ver}: list semantics ${JSON.stringify([F.ulTag, F.liCount, F.olTag, F.olLi, F.listStyle])}`);
const pw = F.pills.map((p) => p.w);
ok(new Set(pw).size === 3 && F.pills.every((p) => p.y === F.pills[0].y), `${ver}: wrap row should keep 3 different widths on one row: ${JSON.stringify(F.pills)}`);
// visibility on core's viewports
ok(front[1440].hiddenMobile && front[768].hiddenMobile && !front[390].hiddenMobile, `${ver}: "hidden on mobile" shown ${[1440, 768, 390].map((w) => front[w].hiddenMobile)}`);
ok(!front[1440].mobileOnly && !front[768].mobileOnly && front[390].mobileOnly, `${ver}: "mobile only" shown ${[1440, 768, 390].map((w) => front[w].mobileOnly)}`);
ok(front[1440].splitShown && !front[768].splitShown && front[390].splitShown, `${ver}: kit/split hidden on tablet only: ${[1440, 768, 390].map((w) => front[w].splitShown)}`);

// 3. editor: registered + 0 invalid on the new page and on every pre-K-2b fixture
await login(ctx);
const ed = await openEditor(ctx, page.id);
const reg = await ed.evaluate(() => ['kit/band', 'kit/split', 'kit/cell', 'kit/layer', 'kit/countdown'].map((n) => !!wp.blocks.getBlockType(n)));
const c = await census(ed);
ok(reg.every(Boolean), `${ver}: blocks not registered ${reg}`);
ok(c.invalid.length === 0 && c.names['kit/layer'] === 2, `${ver}: editor invalid=${JSON.stringify(c.invalid)} layers=${c.names['kit/layer']}`);
// the editor keeps the new attributes when it re-serialises the page (what a save would write)
const reser = await ed.evaluate(() => wp.blocks.serialize(wp.data.select('core/block-editor').getBlocks()));
for (const needle of ['"blockVisibility":{"viewport":{"mobile":false}}', '"tagName":"ul"', '"wrap":true', 'wp:kit/layer']) ok(reser.includes(needle), `${ver}: editor re-serialise lost ${needle}`);
await ed.close();
const fx = path.join(HERE, '../fixtures/k2-emitted');
const pre = {};
for (const f of fs.readdirSync(fx).filter((f) => f.endsWith('.html')).sort()) {
  const id = wp(['post', 'create', '-', '--post_type=page', '--post_status=draft', `--post_title=pre-k2b-${f}`, '--porcelain'], fs.readFileSync(path.join(fx, f), 'utf8'));
  const p2 = await openEditor(ctx, +id);
  const c2 = await census(p2);
  pre[f] = { total: c2.total, kit: c2.kit, invalid: c2.invalid.length };
  ok(c2.invalid.length === 0 && c2.kit > 0, `${ver}: pre-K-2b fixture ${f} invalid=${JSON.stringify(c2.invalid)}`);
  await p2.close();
}
await browser.close();
wp(['config', 'delete', 'DISALLOW_UNFILTERED_HTML']);
console.log(JSON.stringify({ wp: ver, page: page.id, editor: { total: c.total, kit: c.kit, invalid: c.invalid.length }, pre, front, failures: fail }));
process.exit(fail.length ? 1 : 0);
