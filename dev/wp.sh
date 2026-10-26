#!/bin/sh
# wp-cli inside a vblk fixture:  [PROJ=vblk-k3] dev/wp.sh <wp args>
exec docker exec -i "${PROJ:-vblk-k3}-cli-1" wp "$@"
