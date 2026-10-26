#!/bin/sh
# wp-cli inside the vblk-k3 fixture:  dev/wp.sh <wp args>
exec docker exec -i vblk-k3-cli-1 wp "$@"
