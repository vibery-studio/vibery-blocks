# Releasing

The tag is the release trigger.

```
./release.sh 1.0.1        # bumps header + VIBERY_BLOCKS_VER + readme Stable tag + CHANGELOG stanza, builds dist/*.zip
git commit -am "release 1.0.1" && git tag v1.0.1 && git push origin main v1.0.1
   -> .github/workflows/release.yml verifies tag == header == constant, builds vibery-blocks-1.0.1.zip + vibery-blocks.zip
   -> publishes both as GitHub Release assets
```

`https://github.com/vibery-studio/vibery-blocks/releases/latest/download/vibery-blocks.zip` is the stable URL Site Manager's
`build_info` hands out (`SITE_MANAGER_BLOCKS_ZIP_URL` overrides it). Unlike vibery-content there is NO Sellkit mirror and
NO licence: the plugin is free and rendering must never depend on a subscription.

Before tagging: `tests/php/run.php` (in a WP), `tests/e2e/proof.mjs`, `tests/e2e/eject-proof.mjs`, `tests/e2e/coexist.mjs`
against the `dev/compose.yml` fixture (see README). Save-shape changes need a `deprecated[]` entry + a fixture under
`tests/fixtures/legacy/` — the e2e deprecation phase fails otherwise.

## Not done yet (founder/driver)
No GitHub repo exists. Create `vibery-studio/vibery-blocks`, push `main`, then tag. Optionally submit to wordpress.org
(then set `SITE_MANAGER_BLOCKS_ON_WPORG=1` so `build_info` points connected sites at `wp_connections_install_plugin`).
