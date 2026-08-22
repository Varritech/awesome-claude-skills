#!/usr/bin/env bash
# framecheck.sh — build a source-vs-render comparison strip for the verify loop.
#
# Usage:
#   framecheck.sh <source.mp4> <render.mp4> <out.png> <t1> <t2> ... <tN>
#
#   <source>  reference ad
#   <render>  our out/mobile.mp4 (run again for out/desktop.mp4)
#   <out.png> strip path, e.g. /tmp/STRIP_mobile.png
#   <t..>     ONE timestamp (seconds) per scene — its MIDPOINT. Pass all scene mids.
#
# Output: a strip — column per scene, SOURCE frame on top, RENDER frame on bottom,
#         opened in Preview. Then Read it and score each column:
#         composition / type scale / motion feel / color / transition.
#
# GOTCHA the script handles for you (do not re-learn these the hard way):
#  - Scene MIDPOINT sampling can still land on a phrase-start instant where a
#    word-pop/karaoke caption's first word is mid-pop (tiny) and looks broken
#    when it is fine 5 frames later. If a caption looks tiny/single-word, RE-RUN
#    this with that scene's t shifted +1..2s OFF the boundary before "fixing"
#    anything. Real fix (if the OPENING is genuinely illegible): raise word-pop
#    scale FLOOR 0.3->0.7, pop 8->5fr, stagger 4->3, in BOTH Video.tsx AND
#    VideoDesktop.tsx. See SKILL.md "Verify loop" + memory
#    reference_framecheck_phrase_boundary_sampling.
#  - Source frame fps is whatever the SOURCE is, not an assumption. This script
#    seeks the real video by time (-ss <t>) so you never hand-map frame numbers.
set -euo pipefail

SRC="${1:?source video required}"
REN="${2:?render video required}"
OUT="${3:?out strip png required}"
shift 3
[ "$#" -ge 1 ] || { echo "need >=1 scene-midpoint timestamp"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mids=("$@")            # array — quote it; bare $@ in a for-loop concatenates
inputs=()
i=0
for t in "${mids[@]}"; do
  i=$((i+1))
  ffmpeg -ss "$t" -i "$SRC" -frames:v 1 -y "$TMP/s_${i}.png" -loglevel error
  ffmpeg -ss "$t" -i "$REN" -frames:v 1 -y "$TMP/r_${i}.png" -loglevel error
  # source on top, render on bottom, same width so verticals align
  ffmpeg -i "$TMP/s_${i}.png" -i "$TMP/r_${i}.png" \
    -filter_complex "[0:v]scale=300:-1[a];[1:v]scale=300:-1[b];[a][b]vstack" \
    -y "$TMP/pair_${i}.png" -loglevel error
  inputs+=("-i" "$TMP/pair_${i}.png")
done

# hstack every scene-pair into one strip (build the filtergraph dynamically)
labels=""
for ((j=0;j<i;j++)); do labels+="[$j]"; done
ffmpeg "${inputs[@]}" -filter_complex "${labels}hstack=${i}" -y "$OUT" -loglevel error

echo "strip: $OUT  (top=SOURCE, bottom=RENDER, left->right = scenes 1..$i)"
command -v open >/dev/null && open "$OUT" || true
echo "Now Read $OUT and score each column: composition / type scale / motion / color / transition."
echo "If a caption looks tiny/single-word, re-run with that t shifted +1-2s (phrase-boundary; see header)."
