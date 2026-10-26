import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export function wp(args, input) {
  return execFileSync(path.join(ROOT, 'dev/wp.sh'), args, { input, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
}
export const content = (id) => execFileSync(path.join(ROOT, 'dev/wp.sh'), ['post', 'get', String(id), '--field=post_content'], { encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\n$/, '');
export const sha = async (s) => (await import('node:crypto')).createHash('sha256').update(s).digest('hex').slice(0, 16);
export function appPassword() {
  try { wp(['user', 'application-password', 'delete', 'admin', '--all']); } catch (e) {}
  return wp(['user', 'application-password', 'create', 'admin', 'vblk-e2e', '--porcelain']);
}
export async function rest(base, pw, method, route, body) {
  const r = await fetch(base + '/?rest_route=' + route, {
    method, headers: { Authorization: 'Basic ' + Buffer.from('admin:' + pw).toString('base64'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

/** Activate a theme and give the S1 pages the right template for it (kit-base's full-width template only exists there;
 *  wp-cli's `post update` refuses a page whose stored template the active theme does not have). */
export function useTheme(t) {
  wp(['theme', 'activate', t]);
  for (const slug of ['s1-index', 's1-practice']) {
    const id = wp(['post', 'list', '--post_type=page', `--name=${slug}`, '--format=ids']);
    if (id) wp(['post', 'meta', 'update', id, '_wp_page_template', t === 'kit-base' ? 'page-no-title' : 'default']);
  }
}
