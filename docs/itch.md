# Publishing to itch.io

## The name

The game is **Paper Crowns**. "Regicide" belongs in the tagline and the
description, in a sentence that says whose game it is — never in the title
field, the page URL, or the tags.

The split isn't about how often the word appears, it's about which slot it sits
in. In a sentence it reads as a reference to someone else's game, which is what
it is. In the title field it reads as the name of this one. Badgers from Mars
sell Regicide and ship their own Regicide Companion app, so a listing called
Regicide competes with them under their own name.

This is the opposite call from the `pacman` rule in blinkman, and deliberately
so. There the name is pure liability and the discovery comes from `arcade` and
`maze`. Here the credit is the point — the game is worth naming and worth
buying, and saying so is both the honest move and the thing that makes the page
make sense.

One loose end. `SHARE_URL` in `src/lib/share.ts` is per-build now:
`tools/itch-package.sh` sets `VITE_SHARE_URL` so the itch archive advertises
the itch page, and anything else falls back to the self-hosted domain. That
fallback is still `regicide.kautiontape.com` — a live host with the old name in
it. Point a `paper-crowns` host at the same build and change the default; a
domain is a stronger name slot than body text. It's left working rather than
renamed blind, because a share line to a domain that doesn't resolve yet is a
worse trade than an old name.

## Releasing

    npm version 1.2.0 && git push --follow-tags

`npm version` bumps `package.json`, commits, and tags in one step. The tag
triggers `.github/workflows/itch.yml`, which asserts the tag matches
`package.json`, runs the suite, packages the zip, pushes it to the `html`
channel and cuts a GitHub release.

The workflow needs one secret. Generate a key at
<https://itch.io/user/settings/api-keys> and add it to the repository as
`BUTLER_API_KEY`, under Settings → Secrets and variables → Actions.

butler updates the playable build and nothing else. Everything below — title,
description, tags, screenshots — has no API and stays manual.

`.github/workflows/deploy.yml` is separate and unchanged: it pushes to ktn on
every commit to main. itch only moves on a tag.

## Building by hand

    ./tools/itch-package.sh

Writes `dist/paper-crowns-itch.zip` (~215 KB) with `index.html` at the archive
root. Push it with [butler](https://itch.io/docs/butler/), which needs
`butler login` once:

    ./tools/itch-deploy.sh

### Why the build is shaped the way it is

itch serves an HTML game from `html.itch.zone/html/<build id>/`, not
from a domain root, and that breaks a stock SvelteKit static build twice over.
Three things in combination fix it, and removing any one of them ships a blank
page:

| Setting | Where | Without it |
|---|---|---|
| `paths.relative` | `svelte.config.js` | `/_app/…` resolves against the CDN root |
| `router.type: 'hash'` | `svelte.config.js` | the client router matches `/html/<id>/index.html` against the route table and renders its own 404 |
| the `sed` over `index.html` | `tools/itch-package.sh` | adapter-static writes the SPA entry as a *fallback* page, and fallback pages are absolute whatever `paths.relative` says |

Hash routing is also why `src/routes/+layout.ts` exports nothing: SvelteKit
rejects `ssr` / `prerender` page options under it. The build fails loudly if
you add them back.

The rewrite only touches the archive copy. `build/` keeps absolute paths,
because that's what's correct at the domain root nginx serves.

To check a change to any of this before uploading, unpack the zip into a
nested directory and serve the parent:

    mkdir -p /tmp/itchsim/html/1 && unzip -q dist/paper-crowns-itch.zip -d /tmp/itchsim/html/1
    (cd /tmp/itchsim && python3 -m http.server 4321)

Then open `http://localhost:4321/html/1/index.html`. A blank page or a "404" in
the `<h1>` is the failure this reproduces; the real thing gives you the menu.

### Sharing inside the embed

itch drops the game into a cross-origin iframe carrying:

    allow="autoplay; fullscreen *; geolocation; microphone; camera; midi;
           monetization; xr-spatial-tracking; gamepad; gyroscope;
           accelerometer; xr; cross-origin-isolated; web-share"

`web-share` is granted; `clipboard-write` is not. So `navigator.share` works
wherever the browser implements Web Share — Android, Windows, macOS, ChromeOS —
and `navigator.clipboard.writeText` throws `NotAllowedError` everywhere. On
desktop Linux and in Firefox, where `navigator.share` doesn't exist at all,
that combination left the share button doing nothing.

`legacyCopy` in `src/lib/share.ts` is the third tier that fixes it:
`execCommand('copy')` is gated on user activation rather than a
permissions-policy feature, so it still works in the embed. It's deprecated and
it stays anyway — nothing else copies inside an itch iframe.

Reproduce the constraint by embedding the local subpath copy in an iframe from
a different port with that exact `allow` string. Without the third tier the
toast reads "Could not share"; with it, "Copied to clipboard".

## Project settings

| Field | Value |
|---|---|
| Kind of project | HTML |
| Upload | `paper-crowns-itch.zip`, tick **This file will be played in the browser** |
| Viewport | 1280 x 800 |
| Fullscreen button | on |
| Mobile friendly | on |
| Genre | Card Game |
| Tags | `cards`, `card-game`, `singleplayer`, `solo`, `strategy`, `minimalist`, `turn-based` |

No `regicide` tag. A tag is metadata, not a sentence — it's the one place the
word would sit as a bare keyword with nothing around it saying whose game it
is, and it's what a trademark search looks for. The tagline already carries the
discovery.

The board scales to the space it gets, so the viewport is a starting point
rather than a constraint. Mobile friendly is on: the layout has real small-screen
handling and the tutorial swaps to touch wording.

Players have to click the game once before the keyboard reaches it. That's
normal for itch embeds and worth a line in the description if anyone asks.

## Copy

Tagline:

> Solo. Twelve royals. One deck. An unofficial adaptation of Regicide.

Description:

> Twelve royals stand between you and an empty castle deck. You get a standard
> 52-card deck and nobody to help.
>
> Play a card to attack. Its suit fires a power — hearts shuffle the discard
> back under the tavern, diamonds draw, clubs double the damage, spades blunt
> the royal's attack for the rest of the fight. Then the royal hits back, and
> you pay for it in cards out of your hand.
>
> Royals are immune to their own suit, so the power you want is usually the one
> you can't use. Two Jesters are your only outs: each one dumps your hand and
> deals a fresh eight. Win without spending either for a Gold victory.
>
> There's a daily challenge too — same deal for everyone, with a spoiler-free
> result you can paste anywhere.
>
> Paper Crowns is an unofficial solo adaptation of Regicide, designed by Paul
> Abrahams and published by Badgers from Mars. It isn't affiliated with them.
> The physical game is better than this one — go buy a copy.

Keep the last paragraph. It's the credit, the disclaimer and the thing that
makes the tagline's use of the name obviously a reference.

## Assets

| File | Use | Size |
|---|---|---|
| `cover.png` (repo root) | Cover image, already the size itch wants | 630x500 |
| `docs/screenshot.png` | Turn 21 against a King, shield stacked, log filled in | 1600x1000 |
| `docs/guidance.png` | A royal down and the suit-immunity explainer firing | 1600x1000 |
| `docs/menu.png` | The opening screen | 1600x1000 |
| `docs/banner.png` | Page banner | 1860x465 |

Upload order matters a little: itch shows them in the order given and the first
does the most work. `screenshot.png` then `guidance.png` reads best — the first
shows a game deep in trouble, the second shows the game explaining itself.

The screenshots come from `chromium` driven by Playwright against
`npx vite preview`, with the save in localStorage wound forward to a King fight
— the bot can't beat solo Regicide, and turn 3 against a full-health Jack is a
poor advert for a game about grinding down twelve royals. Every state shown is
reachable in normal play. Retaking them means driving the app again; there's no
generator checked in.

## Press art

`press/` holds the art that goes anywhere other than itch — storefront forms,
link cards, anywhere asking for a logo.

| File | Use | Size |
|---|---|---|
| `press/social.png` | `og:image`. The 1.91:1 card Twitter, Facebook, Slack and Discord crop to | 1200x630 |
| `press/cover-wide.png` | 16:9 key image | 1920x1080 |
| `press/logo.png` | Transparent horizontal logo, one file for any background | 1900x340 |
| `press/favicon.svg` | Copy of the app's icon, source for every raster icon beside it | 32x32 |
| `press/favicon.ico` | Bundles 16, 32 and 48 | — |
| `press/favicon-32.png`, `-180`, `-192`, `-512`, `apple-touch-icon.png` | Whatever size a form demands | — |

`press/src/*.svg` are the sources. Nothing serves any of this — the icon
browsers show is the bundled `src/lib/assets/favicon.svg`, and
`press/src/favicon.svg` is a copy of it, so change one and change the other.

Re-render after editing a source:

    rsvg-convert -w 1900 -h 340  press/src/logo.svg       -o press/logo.png
    rsvg-convert -w 1200 -h 630  press/src/social.svg     -o press/social.png
    rsvg-convert -w 1920 -h 1080 press/src/cover-wide.svg -o press/cover-wide.png
    rsvg-convert -w 630  -h 500  press/src/cover.svg      -o cover.png
    rsvg-convert -w 1860 -h 465  press/src/banner.svg     -o docs/banner.png
    for s in 32 180 192 512; do rsvg-convert -w $s -h $s press/src/favicon.svg -o press/favicon-$s.png; done
    cp press/favicon-180.png press/apple-touch-icon.png
    magick press/favicon-512.png -define icon:auto-resize=48,32,16 press/favicon.ico

The logo is one file rather than light and dark variants, because the forms
asking for it overlay it on backgrounds they choose and accept a single upload.
Its wordmark is `#d97706`: 3.19:1 on white and 6.59:1 on black, clearing the 3:1
large type needs on both. The app's brighter `#fbbf24` manages 12.58:1 on black
but 1.67:1 on white, so it can't carry a wordmark that lands on either — it stays on
the crown, which survives low contrast because it has a dark keyline and is a
shape rather than a word.
