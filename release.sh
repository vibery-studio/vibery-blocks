#!/bin/bash
# Build vibery-blocks.zip locally (same file list as the CI release workflow). Usage: ./release.sh [version]
# With a version it bumps the plugin header, VIBERY_BLOCKS_VER, readme.txt Stable tag and CHANGELOG stub first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [ -n "${1:-}" ]; then
  V="$1"
  perl -pi -e "s/^ \* Version:.*/ * Version: $V/; s/define\( 'VIBERY_BLOCKS_VER', '[^']*' \)/define( 'VIBERY_BLOCKS_VER', '$V' )/" vibery-blocks.php
  perl -pi -e "s/^Stable tag:.*/Stable tag: $V/" readme.txt
  grep -q "## \[$V\]" CHANGELOG.md || perl -0pi -e "s/## \[Unreleased\]\n/## [Unreleased]\n\n## [$V] - $(date +%Y-%m-%d)\n/" CHANGELOG.md
fi
V=$(grep -m1 '^ \* Version:' vibery-blocks.php | sed 's/.*Version:[[:space:]]*//' | tr -d '[:space:]')
C=$(grep -m1 "define( 'VIBERY_BLOCKS_VER'" vibery-blocks.php | sed "s/.*'VIBERY_BLOCKS_VER', *'//; s/'.*//")
[ "$V" = "$C" ] || { echo "version drift: header=$V const=$C" >&2; exit 1; }
STAGE=$(mktemp -d)/vibery-blocks; mkdir -p "$STAGE" dist
cp -R vibery-blocks.php uninstall.php includes blocks assets readme.txt README.md CHANGELOG.md LICENSE "$STAGE"/
find "$STAGE" \( -name '.DS_Store' -o -name '*.bak' \) -delete
(cd "$(dirname "$STAGE")" && zip -qr "$OLDPWD/dist/vibery-blocks-$V.zip" vibery-blocks -x '*.DS_Store')
cp "dist/vibery-blocks-$V.zip" dist/vibery-blocks.zip
ls -la "dist/vibery-blocks-$V.zip"
