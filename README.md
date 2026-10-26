# Vibery Blocks

Free (GPL-2.0-or-later) layout blocks for pages built with Vibery: `kit/band`, `kit/split`, `kit/cell`, `kit/countdown`.
Rendering is never licence-gated and makes no network calls. Product page for AI/humans: see `readme.txt`; releases: `RELEASING.md`.

## Layout
- `vibery-blocks.php` boot, `_vibery_build` meta, coexistence with the retired Kit Blocks plugin
- `blocks/<name>/{block.json,index.js,render.php,style-index.css,index.asset.php}` apiVersion 3, dynamic; `deprecated[]` in `index.js`
- `includes/compiler.php` render-time per-page CSS (`.kc-N.kc-N` selectors; cache key `ver:globalStylesHash:postModified`)
- `includes/eject.php` eject / revert REST (`vibery-blocks/v1/*`, alias `md-content/v1/blocks/*`)
- `assets/foreign-theme-compat.css` full-bleed + margin fixes for non-kit-base themes

## Tests (all execute; need Docker + Chrome + Playwright)
```
export KIT_BASE=<wp-builder-kit>/skill/wp-from-screenshot/tools/pipeline/runtime/themes/kit-base VIBERY_CONTENT=<vibery-content checkout>
docker compose -p vblk-k3 -f dev/compose.yml up -d
dev/wp.sh core install --url=http://localhost:18210 --title=VBLK --admin_user=admin --admin_password=vblk-pass-1 --admin_email=a@example.com --skip-email
dev/wp.sh theme install astra; dev/wp.sh config set WP_ENVIRONMENT_TYPE local
tests/e2e/setup.sh                                                   # activates the plugin, uploads placeholders, creates the S1 pages
dev/wp.sh eval-file /var/www/html/wp-content/plugins/vibery-blocks/tests/php/run.php   # compiler/eject/security unit tests (in WP)
node tests/e2e/proof.mjs         # editor validity, deprecation shapes, deactivate/reactivate, theme switch (numbers)
node tests/e2e/eject-proof.mjs   # eject -> deactivate -> same layout; revert byte-identical; guards; permissions
node tests/e2e/coexist.mjs       # with the legacy Kit Blocks plugin active
docker compose -p vblk-k3 -f dev/compose.yml down -v
```
`tests/e2e/gen-legacy-e8.mjs` regenerates the shape-A fixtures from the real E8 build (`tests/legacy-e8`);
`tests/tools/gen-s1-fixtures.py` regenerates the S1 law-firm fixtures from the kit pipeline.
