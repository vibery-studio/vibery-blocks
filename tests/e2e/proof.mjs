// vibery-blocks K-3 proof: editor validity, deactivate/reactivate, theme switch, eject. Prints a JSON report.
// Prereq: dev/compose.yml up, WP installed, tests/e2e/setup.sh run (pages s1-index / s1-practice).
import { launch, login, openEditor, census, measure, diff, WP } from './lib.mjs';
import { wp, content, sha, appPassword, rest, useTheme } from './wpcli.mjs';

const PAGES = { index: { id: +wp(['post', 'list', '--post_type=page', '--name=s1-index', '--format=ids']), slug: 's1-index/' },
                practice: { id: +wp(['post', 'list', '--post_type=page', '--name=s1-practice', '--format=ids']), slug: 's1-practice/' } };
const THEMES = (process.env.THEMES || 'kit-base,twentytwentyfive,twentytwentyfour,astra').split(',');
const R = { phases: {} };
const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const { browser, ctx } = await launch();
await login(ctx);
wp(['plugin', 'activate', 'vibery-blocks']);

// ---- A. editor validity on the S1 pages (shape B, produced by kit-blocks 778e4ed) ----------------------
useTheme('twentytwentyfive');
R.phases.editor = {};
for (const [k, p] of Object.entries(PAGES)) {
  const pg = await openEditor(ctx, p.id);
  const c = await census(pg);
  const kitInvalid = c.invalid.filter((b) => b.name.startsWith('kit/'));
  R.phases.editor[k] = { total: c.total, kit: c.kit, invalid: c.invalid.length, invalidKit: kitInvalid.length, invalidCore: c.invalid.map((b) => b.name).join(',') };
  ok(kitInvalid.length === 0, `${k}: kit/* invalid blocks = ${kitInvalid.length}`);
  ok(c.kit > 0, `${k}: no kit blocks loaded`);
  // strict zero: re-serialize through the editor (= "Attempt recovery" on the pre-existing down_convert core mismatches)
  const rec = await pg.evaluate(() => {
    const rebuild = (bs) => bs.map((b) => wp.blocks.createBlock(b.name, b.attributes, rebuild(b.innerBlocks)));
    return wp.blocks.serialize(rebuild(wp.data.select('core/block-editor').getBlocks()));
  });
  const rid = wp(['post', 'create', '-', '--post_type=page', '--post_status=publish', `--post_title=recovered-${k}`, `--post_name=recovered-${k}`, '--porcelain'], rec);
  const pg2 = await openEditor(ctx, +rid);
  const c2 = await census(pg2);
  R.phases.editor[k].recovered = { id: +rid, total: c2.total, invalid: c2.invalid.length };
  ok(c2.invalid.length === 0, `${k}: recovered copy has ${c2.invalid.length} invalid blocks`);
  await pg.close(); await pg2.close();
}

// ---- B. released save shapes: A (E8 static) must migrate, B current, C countdown ----------------------
import fs from 'node:fs';
R.phases.deprecations = {};
for (const f of fs.readdirSync(new URL('../fixtures/legacy', import.meta.url))) {
  if (!f.endsWith('.html')) continue;
  const body = fs.readFileSync(new URL('../fixtures/legacy/' + f, import.meta.url), 'utf8');
  const id = wp(['post', 'create', '-', '--post_type=page', '--post_status=draft', `--post_title=legacy-${f}`, '--porcelain'], body);
  const pg = await openEditor(ctx, +id);
  const c = await census(pg);
  const migrated = await pg.evaluate(() => wp.blocks.serialize(wp.data.select('core/block-editor').getBlocks()));
  const wrapperLeft = /<(section|div)[^>]*class="[^"]*kit-(band|split|cell)\b/.test(migrated);
  R.phases.deprecations[f] = { blocks: c.total, kit: c.kit, invalid: c.invalid.length, migratedToDynamic: !wrapperLeft, uidMinted: /"uniqueId":"kc-\d+"/.test(migrated) };
  ok(c.invalid.length === 0, `legacy ${f}: ${c.invalid.length} invalid`);
  ok(c.kit > 0, `legacy ${f}: no kit blocks`);
  if (f.startsWith('e8-')) { ok(!wrapperLeft, `legacy ${f}: static wrapper survived migration`); ok(/"uniqueId":"kc-\d+"/.test(migrated), `legacy ${f}: no uniqueId minted`); }
  await pg.close();
}

// ---- C. deactivate / reactivate -----------------------------------------------------------------------
R.phases.toggle = {};
useTheme('twentytwentyfive');
for (const [k, p] of Object.entries(PAGES)) {
  const url = WP + '/' + p.slug;
  const on = await measure(ctx, url);
  wp(['plugin', 'deactivate', 'vibery-blocks']);
  const offRes = await fetch(url);
  const off = await measure(ctx, url);
  wp(['plugin', 'activate', 'vibery-blocks']);
  const back = await measure(ctx, url);
  const d = diff(on, back);
  R.phases.toggle[k] = { offStatus: offRes.status, bandsOn: on[1440].bands.length, bandsOff: off[1440].bands.length, docH1440On: on[1440].docH, docH1440Off: off[1440].docH, docH375On: on[375].docH, docH375Off: off[375].docH, reactivateDiff: d };
  ok(offRes.status === 200, `${k}: deactivated page status ${offRes.status}`);
  ok(d.maxDw === 0 && d.maxDh === 0 && d.maxDcell === 0 && d.mismatch.length === 0, `${k}: reactivate changed layout ${JSON.stringify(d)}`);
}

// ---- D. theme switch ----------------------------------------------------------------------------------
R.phases.themes = {};
for (const t of THEMES) {
  useTheme(t);
  const isBlock = wp(['eval', 'echo wp_is_block_theme() ? 1 : 0;']) === '1';
  R.phases.themes[t] = { kind: isBlock ? 'block' : 'classic' };
  for (const [k, p] of Object.entries(PAGES)) {
    const m = await measure(ctx, WP + '/' + p.slug);
    const row = {};
    for (const w of [1440, 768, 375]) {
      const b = m[w].bands;
      row[w] = { bands: b.length, fullBleed: b.every((x) => x.x === 0 && Math.abs(x.w - w) <= 1), overflowX: m[w].overflowX,
                 docH: m[w].docH, totalH: Math.round(b.reduce((a, x) => a + x.h, 0)), firstBand: b[0] && { x: b[0].x, w: b[0].w, h: b[0].h } };
    }
    R.phases.themes[t][k] = row;
    // block themes: bands must break out to the viewport; classic themes: bands stay inside the theme's content
    // container (declared `classic_contained`) but must never overflow.
    for (const w of [1440, 768, 375]) {
      if (isBlock) ok(row[w].fullBleed, `theme ${t} ${k}@${w}: bands not full-bleed`);
      else ok(m[w].bands.every((x) => x.x >= 0 && x.x + x.w <= w + 1), `theme ${t} ${k}@${w}: band outside viewport`);
      ok(!row[w].overflowX, `theme ${t} ${k}@${w}: horizontal overflow`);
    }
  }
  const c = await openEditor(ctx, PAGES.index.id).then(async (pg) => { const r = await census(pg); await pg.close(); return r; });
  R.phases.themes[t].editorInvalidKit = c.invalid.filter((b) => b.name.startsWith('kit/')).length;
  ok(R.phases.themes[t].editorInvalidKit === 0, `theme ${t}: kit invalid in editor`);
}
R.__raw = { themes: undefined };

await browser.close();
R.failures = fail;
console.log(JSON.stringify(R, null, 1));
process.exit(fail.length ? 1 : 0);
