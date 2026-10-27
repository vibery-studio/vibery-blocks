# Changelog

## [1.1.0] - 2026-10-27

Build-layer vocabulary (Site Manager K-2b). All blocks stay dynamic (`save()` = InnerBlocks.Content), so no saved shape changed and no `deprecated[]` entry is needed: content written by 1.0.0 (incl. pages emitted by the K-2 builder) opens with 0 invalid blocks on WP 6.9.4 and 7.1.3 (`tests/e2e/k2b.mjs`, fixtures `tests/fixtures/k2-emitted/`).

### Added
- `kit/layer`: an absolutely positioned layer (badge on a card, decorative shape, text over media) inside the nearest band / split / cell. Bounded attributes only — `anchorX`/`anchorY` (start|center|end), one offset per axis (`x`, `y`; fluid `clamp()` allowed), optional `width`/`height`, `z` (-1…10, -1 = behind the host's content), `decorative` (renders `aria-hidden="true"`, `pointer-events:none`). Content layers stay where they sit in the block tree, so their text keeps reading order. Eject converts layers to `core/group` with the same hooks.
- `kit/split`: `tagName` (`div`|`ul`|`ol`) renders a real list (its cells render `<li>` via block context `kit/listTag`; theme list chrome reset), `wrap` (a horizontal row whose items keep their own width and wrap — pills, chips, logo rows) with `justify` (start|center|end|space-between). Splits and cells are now positioning/stacking contexts (`position:relative; isolation:isolate`) for their layers. `kit/layer` is an allowed split child.
- Per-viewport visibility = WordPress 7.0+ core's own `metadata.blockVisibility.viewport` (`{"mobile":false,…}`, core breakpoints mobile ≤ 480px, tablet ≤ 782px, desktop above). On WP 6.3–6.9 the plugin applies the identical `wp-block-hidden-<viewport>` classes and rules (`includes/visibility.php`); on 7.0+ it does nothing (core renders it and its editor edits it natively). Works on every block, core and kit.
- `kit/band` `clipX`: clips horizontal overflow (`overflow-x:clip`; vertical stays visible) — set by the builder on bands holding layers, so a decoration hanging past the viewport never scrolls the page (references clip theirs).
- Eject warnings `list_semantics_lost` (core/group cannot be a list) and `viewport_visibility_needs_wp7` (WP < 7.0: per-viewport hiding is this plugin's polyfill).

### Fixed
- `vibery_blocks_v_length_list` rejected `+`, silently dropping every `clamp(a, b vw + c, d)` in `cols`/`stackCols`/`pad`/`bgPosition`. The grammar now allows the calc operators `+ - * /` and is still whitelist-only (no comments, quotes, braces, `;`, `@`, `\`, `url(`, `expression`, unbalanced parentheses). Regression assertions in `tests/php/run.php`.

## [1.0.0]

First release. The Kit Blocks runtime (wp-builder-kit `kit-blocks` @ 778e4ed) productized as a free GPL-2.0-or-later plugin.

### Added
- `kit/band`, `kit/split`, `kit/cell`, `kit/countdown` (apiVersion 3, dynamic render). Block names unchanged from Kit Blocks on purpose: pages baked into hosted bundles and the template gallery carry `<!-- wp:kit/band -->`.
- `deprecated[]` for the one released static-save shape (Kit Blocks E8: wrapper + inline `--kit-*` custom props) on band/split/cell; migration mints the `.kc-N` uniqueId the compiler keys on. Fixtures in `tests/fixtures/legacy/` are generated from the real E8 build.
- Eject: `POST /wp-json/vibery-blocks/v1/eject` (+ `/eject/revert`, `/status`; aliased under `md-content/v1/blocks/*` for Site Manager): converts kit blocks to core/group, bakes compiled CSS into the theme's Additional CSS, reversible byte-for-byte. Refuses (409, nothing changed) pages with `kit/countdown` or synced patterns containing kit blocks.
- Post meta `_vibery_build` `{emitter_ver, conformance_ver, ir_id}` registered (writers arrive with the build layer).
- Compiler cache key `pluginVer:globalStylesHash:postModified` (meta `_vibery_blocks_css`).
- Coexistence: steps aside (admin notice) while the retired "Kit Blocks" plugin is active.

### Changed (vs Kit Blocks 1.0.1)
- **WordPress floor 6.3** (was declared 6.6 without evidence): apiVersion 3 / iframe editor ship in 6.3; proven on 6.3.2, 6.6.2, 6.9.4, 7.1.3 (`tests/e2e/wpver.mjs`, `wpver-eject.mjs`, `tests/php/run.php`). Lower is untested. PHP floor 7.4 lint-checked on php:7.4.
- **WP 6.9 stripped `display` (and other layout properties) from the compiled CSS** — core's style engine re-filters every declaration and 6.9's default allow-list omits them, so kit/split rendered stacked. The extra-property list now names every property the compiler emits; `tests/php/run.php` asserts each survives on the running core. Side-by-side proven for a page saved by a user WITHOUT `unfiltered_html` (editor role, `DISALLOW_UNFILTERED_HTML`) on 6.3–7.1: layout comes from class-keyed compiler CSS, never from inline styles.
- KSES allow-list widening is scoped to the compiler's own calls (was a site-wide `safe_style_css` filter) and now also covers `content` — the band overlay `::before` was silently losing `content:''` and never painted.
- `kitCss` residue passes a property/value whitelist (layout, box, type, colour; no `url()`, `@`, `\`, `!important`, `position:fixed`) on top of KSES.
- Foreign-theme compat: top-level bands break out of a `has-global-padding` host with `!important` negative margins (core's constrained layout pins children with `margin-inline:auto !important`); previously bands stayed inset on Twenty Twenty-Five.
- `index.asset.php` version follows the plugin version.
