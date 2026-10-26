#!/bin/sh
# Seed the vblk-k3 fixture: activate vibery-blocks, upload placeholder images, create the S1 pages.
# usage: tests/e2e/setup.sh   (run from the repo root; needs dev/compose.yml up + WP installed)
set -e
W=./dev/wp.sh
$W plugin activate vibery-blocks >/dev/null
$W rewrite structure '/%postname%/' >/dev/null 2>&1 || true
D=/tmp/vblk-img; rm -rf $D; mkdir -p $D
python3 - <<'PY'
import zlib,struct
def png(path,w,h,rgb):
    raw=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h))
    def ch(t,d): c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
for k,c in {'hero':(40,60,90),'p1':(120,120,130),'p2':(130,120,120),'p3':(120,130,120),'p4':(130,130,110)}.items():
    png('/tmp/vblk-img/%s.png'%k,1600 if k=='hero' else 400,900 if k=='hero' else 500,c)
PY
docker cp $D vblk-k3-cli-1:/tmp/vblk-img >/dev/null 2>&1 || true
i=9001
for k in hero p1 p2 p3 p4; do
  id=$($W media import /tmp/vblk-img/$k.png --porcelain | tail -1)
  url=$($W post get $id --field=guid)
  for p in index practice; do
    f=tests/fixtures/s1-law-firm/$p.page.html
    [ -f /tmp/vblk-$p.html ] || cp $f /tmp/vblk-$p.html
    perl -pi -e "s#https://vblk.invalid/img/$k.png#$url#g; s#\"id\":$i\\b#\"id\":$id#g; s#wp-image-$i\\b#wp-image-$id#g" /tmp/vblk-$p.html
  done
  i=$((i+1))
done
for p in index practice; do
  $W post delete $($W post list --post_type=page --name=s1-$p --format=ids) --force >/dev/null 2>&1 || true
  docker cp /tmp/vblk-$p.html vblk-k3-cli-1:/tmp/vblk-$p.html
  pid=$($W post create /tmp/vblk-$p.html --post_type=page --post_status=publish --post_title="S1 $p" --post_name="s1-$p" --porcelain)
  $W post meta update $pid _wp_page_template page-no-title >/dev/null  # kit-base full-width template; other themes fall back to their page template
  echo "page $p = $pid"
done
