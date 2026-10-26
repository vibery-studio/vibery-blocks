# Changelog

## [Unreleased]

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
