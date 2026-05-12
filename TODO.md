# TODO

## Layout: very short screens (iPhone SE / max-height ≤ ~720px)

On 375×667, the play area overflows: hand row gets pushed below the Play button
and only one card is visible. Vertical budget eaters, in priority order:

- 112px forecast/damage placeholder (`min-h-[7rem]`) reserved even when empty.
  Drop to ~0 when nothing is selected; accept the reflow on first selection.
- "Played this battle" row. Collapse to a small inline chip (e.g. `Played: 3♥ 7♣`)
  on short screens.
- Cumulative padding/gaps on header, stats strip, phase strip, InfoSlot.

Gate on `@media (max-height: 720px)` so desktop and taller phones are untouched.

## Daily mode: leaderboard

Today's daily mode is local-only — every device tracks its own attempt and there is no
cross-player ranking. To turn it into a real Wordle-style leaderboard:

- Backend submission endpoint accepting `{ dailyDate, outcome, turns, elapsedMs, royalsDefeated, attemptCount, tutorial, ... }`.
- Anti-cheat: sign each daily run server-side (HMAC over the seed + startedAt) and require
  the signature on submission. Reject runs whose claimed seed doesn't match `seedFor(date)`.
- Server-side anti-replay: only honour the *first* submission per (player, dailyDate). Retries
  may still be allowed locally, but the leaderboard freezes the original attempt.
- Some kind of player identity — anonymous device key for v1, sign-in for cross-device.
- Display: top-N for today on the Setup card, your own placement, and a small "yesterday's
  results" view so people who play late aren't left out.
