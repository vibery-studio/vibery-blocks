// vibery-blocks eject proof: eject -> deactivate plugin -> layout equivalent; revert restores byte-identical.
import { launch, login, openEditor, census, measure, diff, WP } from './lib.mjs';
import { wp, content, sha, appPassword, rest, useTheme } from './wpcli.mjs';

const THEMES = (process.env.THEMES || 'kit-base,twentytwentyfive,astra').split(',');
const PAGE = +wp(['post', 'list', '--post_type=page', '--name=s1-index', '--format=ids']);
const R = { themes: {} }; const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const { browser, ctx } = await launch();
await login(ctx);
const pw = appPassword();
const URL_ = WP + '/s1-index/';
const customCss = () => wp(['eval', 'echo wp_get_custom_css();']);
const sumH = (m, w) => Math.round(m[w].bands.reduce((a, b) => a + b.h, 0));

for (const t of THEMES) {
  useTheme(t); wp(['plugin', 'activate', 'vibery-blocks']);
  const r = (R.themes[t] = {});
  const original = content(PAGE); const h0 = await sha(original);
  const pre = await measure(ctx, URL_);

  const dry = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: PAGE, dry_run: true });
  r.dry = { status: dry.status, body: dry.body && { status: dry.body.status, converted: dry.body.converted, css_bytes: dry.body.css_bytes } };
  ok(dry.status === 200 && dry.body.status === 'dry_run', `${t}: dry run ${dry.status}`);
  ok(content(PAGE) === original, `${t}: dry run changed content`);

  const ej = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: PAGE });
  r.eject = { status: ej.status, body: ej.body && { status: ej.body.status, converted: ej.body.converted, css_bytes: ej.body.css_bytes, stylesheet: ej.body.stylesheet } };
  ok(ej.status === 200 && ej.body.status === 'ejected', `${t}: eject ${ej.status} ${JSON.stringify(ej.body).slice(0, 200)}`);
  const after = content(PAGE);
  ok(!after.includes('wp:kit/'), `${t}: kit blocks remain after eject`);
  const css = customCss();
  ok(css.includes('vibery-blocks:eject:post-' + PAGE + ':begin') && css.includes('vibery-blocks:eject:base:begin'), `${t}: baked CSS sections missing`);

  const onM = await measure(ctx, URL_);                      // plugin active, content ejected
  wp(['plugin', 'deactivate', 'vibery-blocks']);
  const offM = await measure(ctx, URL_);                     // plugin gone
  const pg = await openEditor(ctx, PAGE); const cOff = await census(pg); await pg.close();
  wp(['plugin', 'activate', 'vibery-blocks']);
  const dOn = diff(pre, onM), dOff = diff(pre, offM);
  const worstH = (() => { let w = 0; for (const k of Object.keys(pre)) pre[k].bands.forEach((b, i) => { const o = offM[k].bands[i]; if (o) w = Math.max(w, Math.abs(o.h - b.h) / b.h); }); return Math.round(w * 1000) / 10; })();
  r.numbers = { pre1440: { bands: pre[1440].bands.length, sumH: sumH(pre, 1440), docH: pre[1440].docH }, ejectedPluginOn: dOn, ejectedPluginOff: dOff, worstBandHeightDeltaPctOff: worstH,
                off: { sumH1440: sumH(offM, 1440), sumH375: sumH(offM, 375), docH1440: offM[1440].docH, overflow: [1440, 768, 375].map((w) => offM[w].overflowX) }, editorOffInvalid: cOff.invalid.length, editorOffInvalidNames: [...new Set(cOff.invalid.map((b) => b.name))].join(',') };
  const classic = wp(['eval', 'echo wp_is_block_theme() ? 0 : 1;']) === '1';
  r.numbers.themeKind = classic ? 'classic' : 'block';
  r.eject.warnings = ej.body && ej.body.warnings;
  ok(dOff.mismatch.length === 0, `${t}: plugin-off structure mismatch ${dOff.mismatch}`);
  // block themes: baked layout must be EXACT with the plugin gone; classic: widths exact, band heights within 10%.
  ok(dOff.maxDw === 0 && dOff.maxDx === 0 && dOff.maxDcell === 0, `${t}: plugin-off widths/cells moved ${JSON.stringify(dOff)}`);
  if (!classic) ok(dOff.maxDh === 0, `${t}: plugin-off heights moved ${dOff.maxDh}`);
  else { ok(worstH <= 10, `${t}: classic plugin-off height delta ${worstH}% > 10%`); ok(r.eject.warnings && r.eject.warnings.length === 1, `${t}: classic eject must warn`); }
  ok(dOn.mismatch.length === 0, `${t}: plugin-on structure mismatch ${dOn.mismatch}`);
  ok(cOff.invalid.every((b) => !b.name.startsWith('core/group')) , `${t}: ejected core/group invalid in editor`);
  ok(cOff.invalid.length <= 7, `${t}: ${cOff.invalid.length} invalid blocks after eject (baseline 7 from down_convert core children)`);

  // idempotent + guarded
  const again = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: PAGE });
  ok(again.body.status === 'noop' && again.body.reason === 'already_ejected', `${t}: second eject not noop`);

  // revert
  wp(['post', 'update', String(PAGE), '-'], after + '<!-- wp:paragraph --><p>edit</p><!-- /wp:paragraph -->');
  const guard = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject/revert', { post_id: PAGE });
  ok(guard.status === 409 && guard.body.code === 'modified_since_eject', `${t}: revert did not guard edited page (${guard.status})`);
  wp(['post', 'update', String(PAGE), '-'], after);
  const rv = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject/revert', { post_id: PAGE });
  ok(rv.status === 200 && rv.body.status === 'reverted', `${t}: revert ${rv.status}`);
  const restored = content(PAGE);
  r.revert = { status: rv.body && rv.body.status, byteIdentical: restored === original, sha: h0 === (await sha(restored)), cssLeft: /vibery-blocks:eject/.test(customCss()) };
  ok(restored === original, `${t}: revert not byte-identical`);
  ok(!r.revert.cssLeft, `${t}: eject CSS left behind after revert`);
  const back = await measure(ctx, URL_);
  const dBack = diff(pre, back); r.revert.layoutDiff = dBack;
  ok(dBack.maxDw === 0 && dBack.maxDh === 0 && dBack.mismatch.length === 0, `${t}: layout differs after revert ${JSON.stringify(dBack)}`);
}

// unsupported content (countdown) -> 409 with the blocks named, nothing written
useTheme('twentytwentyfive');
const cdBody = '<!-- wp:kit/band {"uniqueId":"kc-5"} --><!-- wp:paragraph --><p>x</p><!-- /wp:paragraph --><!-- /wp:kit/band --><!-- wp:kit/countdown {"uniqueId":"kc-6"} /-->';
const cd = wp(['post', 'create', '-', '--post_type=page', '--post_status=publish', '--post_title=cd', '--porcelain'], cdBody);
const bad = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: +cd });
R.unsupported = { status: bad.status, code: bad.body.code, unsupported: bad.body.data && bad.body.data.unsupported };
ok(bad.status === 409 && bad.body.code === 'eject_unsupported', 'countdown page not refused');
ok(content(+cd) === cdBody, 'countdown page content changed by refused eject');
// no kit blocks -> noop
const plain = wp(['post', 'create', '-', '--post_type=page', '--post_status=publish', '--post_title=plain', '--porcelain'], '<!-- wp:paragraph --><p>hi</p><!-- /wp:paragraph -->');
const np = await rest(WP, pw, 'POST', '/vibery-blocks/v1/eject', { post_id: +plain });
ok(np.body.status === 'noop' && np.body.reason === 'no_kit_blocks', 'plain page not noop');
// permissions: an editor (edit_post yes, edit_css no) and an unauthenticated caller are refused
try { wp(['user', 'delete', 'k3editor', '--yes']); } catch (e) {}
wp(['user', 'create', 'k3editor', 'k3editor@example.com', '--role=editor', '--user_pass=k3-editor-pass-1']);
const epw = wp(['user', 'application-password', 'create', 'k3editor', 'e2e', '--porcelain']);
const rawEd = await fetch(WP + '/?rest_route=/vibery-blocks/v1/eject', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from('k3editor:' + epw).toString('base64'), 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: PAGE }) });
const anon = await fetch(WP + '/?rest_route=/vibery-blocks/v1/eject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post_id: PAGE }) });
R.permissions = { editor: rawEd.status, anonymous: anon.status };
ok(rawEd.status === 403, `editor without edit_css got ${rawEd.status}`);
ok(anon.status === 401 || anon.status === 403, `anonymous got ${anon.status}`);
ok(content(PAGE).includes('wp:kit/'), 'permission test mutated content');
wp(['user', 'delete', 'k3editor', '--yes']);
wp(['post', 'delete', cd, plain, '--force']);
await browser.close();
R.failures = fail;
console.log(JSON.stringify(R, null, 1));
process.exit(fail.length ? 1 : 0);
