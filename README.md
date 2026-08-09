# Paper Crowns

A solo card game for a standard 52-card deck, played in the browser. Twelve
royals, four suit powers, two Jesters, and no one to help.

An unofficial solo adaptation of [Regicide](https://www.badgersfrommars.com/regicide)
by Paul Abrahams, published by Badgers from Mars. Not affiliated with them —
see [NOTICE.md](NOTICE.md), and buy a copy of the real thing.

## Developing

    npm install
    npm run dev

    npm test          # vitest, engine + rules suites
    npm run check     # svelte-check

## Deploying

Two targets, two triggers:

| Target | Trigger | Workflow |
|---|---|---|
| ktn (`regicide.kautiontape.com`) | every push to `main` | `.github/workflows/deploy.yml` |
| itch.io | a `v*` tag | `.github/workflows/itch.yml` |

    npm version 1.2.0 && git push --follow-tags

[docs/itch.md](docs/itch.md) covers the store page: settings, copy, assets, and
why the itch build needs hash routing and a path rewrite that the ktn build
doesn't.

## Licence

The code in this repository is [MIT](LICENSE). That covers this implementation
only — it says nothing about Regicide itself, which belongs to its designer and
publisher. See [NOTICE.md](NOTICE.md).

## Layout

    src/lib/engine/     rules, combat maths, and the game state machine — no UI
    src/lib/ui/         Svelte components
    src/lib/            store, history, daily challenge, share text
    docs/               store screenshots and the publishing guide
    press/              logo, icons and social art (sources in press/src)
    tools/              itch packaging and deploy scripts
