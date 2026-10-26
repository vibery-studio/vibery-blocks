// Shared helpers for the vibery-blocks e2e proofs (headless Chrome via playwright).
// env: WP=http://localhost:18210  WP_USER=admin WP_PASS=vblk-pass-1  CHROME=/Applications/Google Chrome.app/...
//      PW=path to playwright's index.mjs (default ~/.canary/node_modules/playwright/index.mjs)
import { pathToFileURL } from 'node:url';
import os from 'node:os';

export const WP = process.env.WP || 'http://localhost:18210';
const PW = process.env.PW || os.homedir() + '/.canary/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch() {
  const { chromium } = await import(pathToFileURL(PW).href);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  return { browser, ctx };
}

export async function login(ctx) {
  const pg = await ctx.newPage();
  await pg.goto(WP + '/wp-login.php', { waitUntil: 'domcontentloaded' });
  await pg.fill('#user_login', process.env.WP_USER || 'admin');
  await pg.fill('#user_pass', process.env.WP_PASS || 'vblk-pass-1');
  await pg.click('#wp-submit');
  await pg.waitForLoadState('domcontentloaded');
  await pg.close();
}

/** Open the block editor on a post; resolve with the page once the block store is populated. */
export async function openEditor(ctx, postId) {
  const pg = await ctx.newPage();
  const logs = [];
  pg.on('console', (m) => { const t = m.text(); if (/validation failed|invalid|deprecat/i.test(t)) logs.push(t.slice(0, 300)); });
  await pg.goto(`${WP}/wp-admin/post.php?post=${postId}&action=edit`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.wp && wp.data && wp.data.select('core/block-editor') && wp.data.select('core/block-editor').getBlocks().length > 0, null, { timeout: 60000 });
  await pg.evaluate(() => {
    try { wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false); } catch (e) {}
    try { wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuideTemplate', false); } catch (e) {}
  });
  await pg.waitForTimeout(2500);
  pg.__logs = logs;
  return pg;
}

/** Recursive block census from the editor data store. */
export function census(pg) {
  return pg.evaluate(() => {
    const out = { total: 0, invalid: [], names: {}, kit: 0 };
    const walk = (bs) => bs.forEach((b) => {
      out.total++;
      out.names[b.name] = (out.names[b.name] || 0) + 1;
      if (b.name.startsWith('kit/')) out.kit++;
      if (b.isValid === false) out.invalid.push({ name: b.name, cls: (b.attributes && b.attributes.className) || '' });
      if (b.innerBlocks && b.innerBlocks.length) walk(b.innerBlocks);
    });
    walk(wp.data.select('core/block-editor').getBlocks());
    out.warnEls = document.querySelectorAll('.block-editor-warning').length;
    return out;
  });
}

/** Structural numbers on the FRONT of a page: per .kit-band {x,w,h} and its split cells' widths. */
export async function measure(ctx, url, widths = [1440, 768, 375]) {
  const pg = await ctx.newPage();
  const res = {};
  for (const w of widths) {
    await pg.setViewportSize({ width: w, height: 1000 });
    await pg.goto(url, { waitUntil: 'load' });
    await pg.waitForTimeout(600);
    res[w] = await pg.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; };
      const bands = [...document.querySelectorAll('.kit-band')].map((b) => ({
        ...r(b),
        cells: [...b.querySelectorAll('.kit-split > .kit-cell')].map((c) => r(c).w),
        splitCols: [...b.querySelectorAll('.kit-split')].map((s) => getComputedStyle(s).gridTemplateColumns),
        display: [...b.querySelectorAll('.kit-split')].map((s) => getComputedStyle(s).display),
      }));
      return { bands, docH: Math.round(document.documentElement.scrollHeight), docW: document.documentElement.scrollWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
  }
  await pg.close();
  return res;
}

/** max |a-b| over comparable numbers of two measure() results; returns {maxDw,maxDh,maxDcell,n,mismatch[]} */
export function diff(a, b) {
  const out = { maxDx: 0, maxDw: 0, maxDh: 0, maxDcell: 0, bands: 0, mismatch: [] };
  for (const w of Object.keys(a)) {
    const A = a[w].bands, B = b[w].bands;
    if (A.length !== B.length) { out.mismatch.push(`${w}: band count ${A.length} vs ${B.length}`); continue; }
    A.forEach((x, i) => {
      out.bands++;
      out.maxDx = Math.max(out.maxDx, Math.abs(x.x - B[i].x));
      out.maxDw = Math.max(out.maxDw, Math.abs(x.w - B[i].w));
      out.maxDh = Math.max(out.maxDh, Math.abs(x.h - B[i].h));
      if (x.cells.length !== B[i].cells.length) out.mismatch.push(`${w} band${i}: cells ${x.cells.length} vs ${B[i].cells.length}`);
      else x.cells.forEach((c, j) => { out.maxDcell = Math.max(out.maxDcell, Math.abs(c - B[i].cells[j])); });
    });
  }
  return out;
}
