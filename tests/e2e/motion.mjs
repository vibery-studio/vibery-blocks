// Motion proof: reveal / stagger / hover / reduced-motion / no-JS / failsafe / CLS / hostile attrs / editor.
// env: WP (default http://localhost:18210), MOTION_PAGE (slug, default motion-demo), MOTION_POST (id, for the editor phase)
import { launch, login, openEditor, census, WP } from './lib.mjs';
const SLUG = process.env.MOTION_PAGE || 'motion-demo';
const POST = process.env.MOTION_POST;
const URL_ = `${WP}/${SLUG}/`;
const res = []; const ok = (c, m, extra = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + m + (extra ? '  ' + extra : '')); };
const { browser, ctx } = await launch();

// A. no JS: nothing may stay hidden
{
  const c = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); await p.goto(URL_);
  const r = await p.evaluate(() => [...document.querySelectorAll('.vb-m')].map((e) => +getComputedStyle(e).opacity));
  ok(r.length >= 6 && r.every((o) => o === 1), 'A no-JS: every .vb-m visible (opacity 1)', `n=${r.length}`);
  await c.close();
}
// B. reveal + stagger + CLS + hover
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  await p.goto(URL_); await p.waitForTimeout(300);
  const st = await p.evaluate(() => {
    const g = document.querySelector('.demo-stagger');
    return { js: document.documentElement.classList.contains('vb-js'), op: +getComputedStyle(g.children[0]).opacity, inview: g.classList.contains('vb-in'), h1: document.querySelector('h1.vb-m').classList.contains('vb-in') };
  });
  ok(st.js && st.op === 0 && !st.inview, 'B1 below-fold stagger children hidden before scroll', JSON.stringify(st));
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.querySelector('h1.vb-m').classList.contains('vb-in') && +getComputedStyle(document.querySelector('h1.vb-m')).opacity === 1), 'B2 above-fold h1 revealed on load');
  await p.evaluate(() => document.querySelector('.demo-stagger').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(150);
  const early = await p.evaluate(() => [...document.querySelector('.demo-stagger').children].map((e) => getComputedStyle(e).transitionDelay));
  await p.waitForTimeout(1500);
  const done = await p.evaluate(() => [...document.querySelector('.demo-stagger').children].map((e) => getComputedStyle(e).transitionDelay).join());
  const after = await p.evaluate(() => {
    const g = document.querySelector('.demo-stagger');
    return { inview: g.classList.contains('vb-in'), ops: [...g.children].map((e) => +getComputedStyle(e).opacity), delays: null };
  });
  after.delays = early;
  ok(after.inview && after.ops.every((o) => o === 1), 'B3 stagger group revealed after scroll', JSON.stringify(after.ops));
  ok(after.delays.join() === '0s,0.12s,0.24s', 'B4 stagger delays 0/120/240 ms while revealing', after.delays.join());
  ok(done === '0s,0s,0s', 'B4b delays cleared once revealed (hover is instant afterwards)', done);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  const cls = await p.evaluate(() => window.__cls);
  ok(cls < 0.001, 'B5 CLS across full scroll < 0.001', 'cls=' + cls);
  const card = p.locator('.vb-h-lift').first();
  await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
  await card.hover(); await p.waitForTimeout(900);
  const tr = await card.evaluate((e) => getComputedStyle(e).transform);
  ok(/matrix\(1, 0, 0, 1, 0, -6\)/.test(tr), 'B6 hover lift = translateY(-6px)', tr);
  const props = await p.evaluate(() => [...document.querySelectorAll('.vb-m')].map((e) => getComputedStyle(e).transitionProperty).join(' '));
  ok(!/\b(width|height|top|left|margin|padding)\b/.test(props), 'B7 only transform/opacity/shadow transition (no layout props)');
  ok(await p.evaluate(() => !document.querySelector('script[src*="jquery"]')), 'B8 no jQuery on the page');
  const hostile = await p.evaluate(() => { const e = [...document.querySelectorAll('.vb-m')].find((x) => /Hostile/.test(x.textContent)); return { cls: e.className, style: e.getAttribute('style'), script: !!e.querySelector('script') || /evil/.test(e.outerHTML) }; });
  ok(!hostile.script && /vb-h-lift/.test(hostile.cls) && !/vb-r-/.test(hostile.cls) && /--vb-dur:1500ms/.test(hostile.style), 'B9 hostile attrs sanitised (bad enum dropped, dur clamped)', JSON.stringify(hostile));
  await c.close();
}
// C. reduced motion: not armed, visible, no transitions
{
  const c = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); await p.goto(URL_); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({ js: document.documentElement.classList.contains('vb-js'), ops: [...document.querySelectorAll('.vb-m')].map((e) => +getComputedStyle(e).opacity), tr: [...document.querySelectorAll('.vb-m')].map((e) => getComputedStyle(e).transitionDuration) }));
  ok(!r.js && r.ops.every((o) => o === 1) && r.tr.every((d) => d === '0s'), 'C reduced-motion: no vb-js, all visible, 0s transitions', JSON.stringify({ js: r.js, n: r.ops.length }));
  await c.close();
}
// D. failsafe: motion.js never loads -> after 4 s nothing is left hidden
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage(); await p.route('**/assets/motion/motion.js*', (r) => r.abort());
  await p.goto(URL_); await p.waitForTimeout(4600);
  const r = await p.evaluate(() => ({ js: document.documentElement.classList.contains('vb-js'), ops: [...document.querySelectorAll('.vb-m')].map((e) => +getComputedStyle(e).opacity) }));
  ok(!r.js && r.ops.every((o) => o === 1), 'D failsafe: script blocked -> content visible after 4 s');
  await c.close();
}
// E. editor
if (POST) {
  await login(ctx);
  const pg = await openEditor(ctx, POST);
  const cz = await census(pg);
  ok(cz.invalid.length === 0 && cz.warnEls === 0 && !pg.__logs.some((l) => /validation failed/i.test(l)), 'E1 editor: 0 invalid blocks with motion attrs on core + kit blocks', `total=${cz.total} invalid=${cz.invalid.length}`);
  const kept = await pg.evaluate(() => { const bs = wp.data.select('core/block-editor').getBlocks(); const h = bs.flatMap(function f(b) { return [b, ...b.innerBlocks.flatMap(f)]; }).find((b) => b.name === 'core/heading' && b.attributes.vbMotion); return h && h.attributes.vbMotion; });
  ok(kept && kept.reveal === 'up', 'E2 editor keeps vbMotion on core/heading', JSON.stringify(kept));
  // pick the h1, open Motion panel, change reveal through the UI
  await pg.evaluate(() => { const b = wp.data.select('core/block-editor').getBlocks().flatMap(function f(b) { return [b, ...b.innerBlocks.flatMap(f)]; }).find((x) => x.name === 'core/heading'); wp.data.dispatch('core/block-editor').selectBlock(b.clientId); wp.data.dispatch('core/edit-post').openGeneralSidebar && wp.data.dispatch('core/edit-post').openGeneralSidebar('edit-post/block'); });
  await pg.waitForTimeout(800);
  const panel = pg.getByRole('button', { name: 'Motion', exact: true });
  ok(await panel.count() > 0, 'E3 "Motion" panel present in block inspector');
  if (await panel.count()) {
    if ((await panel.first().getAttribute('aria-expanded')) !== 'true') await panel.first().click();
    await pg.getByLabel('Reveal on scroll').selectOption('zoom'); await pg.waitForTimeout(400);
    const v = await pg.evaluate(() => { const b = wp.data.select('core/block-editor').getSelectedBlock(); return b.attributes.vbMotion; });
    ok(v && v.reveal === 'zoom', 'E4 UI sets vbMotion.reveal', JSON.stringify(v));
    await pg.getByLabel('Preview motion in editor').check(); await pg.waitForTimeout(500);
    const frame = pg.frames().find((f) => f !== pg.mainFrame()) || pg.mainFrame();
    const has = await pg.evaluate(() => !!document.querySelector('iframe[name="editor-canvas"]')?.contentDocument?.querySelector('.vb-m[class*="vb-edit-"]') || !!document.querySelector('.vb-m[class*="vb-edit-"]'));
    ok(has, 'E5 preview toggle animates the block in the canvas (vb-edit-* class)');
    await pg.keyboard.press('Meta+s'); await pg.waitForTimeout(2500);
    const saved = await pg.evaluate(async () => (await wp.apiFetch({ path: `/wp/v2/pages/${wp.data.select('core/editor').getCurrentPostId()}?context=edit` })).content.raw);
    ok(/"vbMotion":\{"reveal":"zoom"/.test(saved), 'E6 saved post_content carries the new attr');
    const cz2 = await census(pg);
    ok(cz2.invalid.length === 0, 'E7 still 0 invalid after the edit + save');
    await pg.getByLabel('Reveal on scroll').selectOption('up'); await pg.keyboard.press('Meta+s'); await pg.waitForTimeout(2000); // restore fixture
  }
}
await browser.close();
const fails = res.filter((x) => !x).length;
console.log(fails ? `FAIL ${fails} of ${res.length}` : `PASS motion e2e (${res.length} checks)`);
process.exit(fails ? 1 : 0);
