#!/usr/bin/env bash
set -euo pipefail

MAX_EDGE="${MAX_EDGE:-1600}"
QUALITY="${QUALITY:-82}"

if ! command -v convert >/dev/null 2>&1 || ! command -v identify >/dev/null 2>&1; then
  echo "ImageMagick 'convert' and 'identify' are required." >&2
  exit 1
fi

declare -a SEARCH_ROOTS
if [ "$#" -gt 0 ]; then
  SEARCH_ROOTS=("$@")
else
  SEARCH_ROOTS=("public/images")
fi

processed=0
updated=0
skipped=0

compress_file() {
  local file="$1"
  local ext lower dims width height resize_needed=0 tmp new_size old_size
  ext="${file##*.}"
  lower="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
  dims="$(identify -format '%w %h' "$file" 2>/dev/null || true)"
  if [ -z "$dims" ]; then
    echo "skip  $file (unable to read dimensions)"
    skipped=$((skipped + 1))
    return
  fi

  width="${dims%% *}"
  height="${dims##* }"
  if [ "$width" -gt "$MAX_EDGE" ] || [ "$height" -gt "$MAX_EDGE" ]; then
    resize_needed=1
  fi

  tmp="$(mktemp "${TMPDIR:-/tmp}/compress-image.XXXXXX.${lower}")"

  case "$lower" in
    jpg|jpeg)
      convert "$file" \
        -auto-orient \
        -strip \
        -resize "${MAX_EDGE}x${MAX_EDGE}>" \
        -sampling-factor 4:2:0 \
        -interlace Plane \
        -quality "$QUALITY" \
        "$tmp"
      ;;
    png)
      convert "$file" \
        -auto-orient \
        -strip \
        -resize "${MAX_EDGE}x${MAX_EDGE}>" \
        -define png:compression-level=9 \
        -define png:compression-strategy=1 \
        "$tmp"
      ;;
    webp)
      convert "$file" \
        -auto-orient \
        -strip \
        -resize "${MAX_EDGE}x${MAX_EDGE}>" \
        -quality "$QUALITY" \
        "$tmp"
      ;;
    *)
      rm -f "$tmp"
      return
      ;;
  esac

  old_size="$(wc -c < "$file")"
  new_size="$(wc -c < "$tmp")"
  processed=$((processed + 1))

  if [ "$resize_needed" -eq 1 ] || [ "$new_size" -lt "$old_size" ]; then
    mv "$tmp" "$file"
    updated=$((updated + 1))
    echo "write $file (${width}x${height}, ${old_size} -> ${new_size} bytes)"
  else
    rm -f "$tmp"
    skipped=$((skipped + 1))
    echo "keep  $file (${width}x${height}, ${old_size} -> ${new_size} bytes)"
  fi
}

for root in "${SEARCH_ROOTS[@]}"; do
  if [ ! -e "$root" ]; then
    echo "skip  $root (not found)"
    continue
  fi
  while IFS= read -r file; do
    compress_file "$file"
  done < <(find "$root" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | sort)
done

echo
echo "processed=$processed updated=$updated skipped=$skipped max_edge=$MAX_EDGE quality=$QUALITY"
