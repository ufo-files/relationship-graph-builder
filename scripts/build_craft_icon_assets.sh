#!/bin/sh
set -eu

source_dir="assets/craft-icons/source"
mkdir -p assets/craft-icons/high assets/craft-icons/medium assets/craft-icons/low

while IFS=: read -r source_name class_id; do
  source="$source_dir/$source_name.svg"
  test -f "$source"

  for tone in high medium low; do
    case "$tone" in
      high) ink="#111111" ;;
      medium) ink="#555555" ;;
      low) ink="#777777" ;;
    esac

    # Preserve the supplied vector geometry exactly. Only the solid monochrome
    # ink token changes so prominence never depends on opacity.
    sed \
      -e "s/fill=\"black\"/fill=\"$ink\"/g" \
      -e "s/stroke=\"black\"/stroke=\"$ink\"/g" \
      "$source" > "assets/craft-icons/$tone/$class_id.svg"
  done
done <<'ICONS'
blob:skywatcher_blob
boomerang:boomerang
bright-star:skywatcher_bright_star
beam:skywatcher_beam
cigar:cigar
cube:cube
diamond:diamond
disc:disc
egg:egg
jellyfish:skywatcher_jellyfish
manta:skywatcher_manta_ray
hornet:skywatcher_hornet
orb:orb
pyramid:pyramid
saucer:saucer
tetra:skywatcher_tetra
tictac:tic_tac
triangle:triangle
unknown:unknown
ICONS
