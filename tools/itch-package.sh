#!/usr/bin/env bash
# Build the itch.io upload. Produces dist/paper-crowns-itch.zip with index.html
# at the root of the archive, which is what itch expects for an HTML5 game.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/dist"
stage="$out/stage"
zipfile="$out/paper-crowns-itch.zip"

cd "$root"

# A result shared from the itch build should send people to the itch page, not
# to the self-hosted copy. src/lib/share.ts falls back to the self-hosted URL
# when this is unset, which is what the ktn deploy wants.
export VITE_SHARE_URL="${VITE_SHARE_URL:-https://kautiontape.itch.io/paper-crowns}"
echo "share URL: $VITE_SHARE_URL"

npm run build

[ -f build/index.html ] || { echo 'no build/index.html — did adapter-static run?' >&2; exit 1; }

rm -rf "$stage"
mkdir -p "$stage"
cp -r build/. "$stage/"

# itch serves the game from html.itch.zone/html/<build id>/index.html, so
# the absolute /_app/ URLs SvelteKit writes resolve against the CDN root and 404
# into a blank page. adapter-static emits the SPA entry as a *fallback* page, and
# fallback pages are always absolute no matter what paths.relative says, so this
# is the one place left to fix it. Only the archive copy is rewritten; build/ is
# what nginx serves from the domain root, where absolute is correct.
#
# Rewriting index.html is enough on its own: chunk-to-chunk imports inside the
# bundles are ES module specifiers resolved against the importing module's own
# URL, so they follow the entry wherever it lands.
sed -i 's|\(["(]\)/_app/|\1./_app/|g' "$stage/index.html"

if grep -q '"/_app/' "$stage/index.html"; then
  echo 'absolute /_app/ URLs survived the rewrite — the itch build would be blank' >&2
  exit 1
fi

mkdir -p "$out"
rm -f "$zipfile"

# Zip from inside the stage so index.html lands at the archive root rather than
# under a directory, which itch would serve as an empty game.
cd "$stage"
zip -r -q "$zipfile" .
cd "$root"
rm -rf "$stage"

echo "$zipfile"
unzip -l "$zipfile" | tail -1
