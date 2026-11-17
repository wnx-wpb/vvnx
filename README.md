# Token Radar

<!-- Submission badges are added when this repository is created on GitHub:
     three live make.fun badges (competition, prize, leaderboard) in the form
     [![...](https://make.fun/api/badges/token-radar-01/...)](https://make.fun/c/token-radar-01),
     plus the repository About website pointing at the competition page and the topic "makefun". -->

The token launch radar: every protocol a sealed snapshot records as pre-token,
ranked by an implied value derived from that same snapshot's figures, with a
farm plan for each — rendered as an offline dashboard that needs no network.

## What it is

- `main.ts` reads one sealed snapshot (`/input/snapshot.json`) and writes
  everything under `/output`: `board.json`, `data.js`, `dashboard/`,
  `screenshots/` and `dossier.json`. It runs twice and writes identical bytes.
- `lib/model.ts` is the model. The base multiple is calibrated from the
  snapshot itself — the median market-cap-to-TVL ratio of the live-token
  protocols in the same file, clamped to 0.05–1.0 — then adjusted by the
  7-day change (clamped, half weight), a saturating maturity curve over age,
  and a small chain-breadth bonus. No protocol name is special-cased.
- `dashboard/` is a plain HTML/CSS/JS page with no network requests: the board
  with search, category, chain, scope and sort controls; a detail view per
  protocol with the value breakdown and the farm plan; and a separate view for
  the live-token protocols that are set aside, never ranked.
- `vendor/makefun-board.ts` is the competition's board module, vendored
  byte-for-byte; it writes `board.json` and `dossier.json`.

## Run it locally

```sh
node main.ts --input /path/to/input   # needs snapshot.json in that directory
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/input
```

Requires Node 22.18 or newer (type stripping). No dependencies, no build step.

## Layout

```
main.ts                  the build
lib/model.ts             the model: calibration, ranking, farm plans
vendor/makefun-board.ts  the vendored board module (do not edit)
dashboard/               the offline page (index.html, app.css, app.js, model.js)
screenshots/             the dashboard's screenshots, captured from the real page
```

## Honesty notes

- Every implied value is the model's estimate from one snapshot's figures, not
  a market price and not a prediction. The dashboard says so on the page.
- Farm plans are estimates derived from each protocol's own record (category,
  chains, TVL, age). Gas costs move; a farm plan is not a promise of an
  airdrop, and only a protocol's own published pages can say whether a token
  or a points programme exists.
- The snapshot is sealed: nothing here fetches live data.

## License

MIT. See `LICENSE`.
