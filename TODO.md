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
