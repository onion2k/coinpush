# Coinpush

[![Pages](https://github.com/onion2k/coinpush/actions/workflows/pages.yml/badge.svg)](https://github.com/onion2k/coinpush/actions/workflows/pages.yml)

A coin pusher, the arcade kind. Drop a coin in at the top and it falls
through a field of pegs onto a platform that slides back and forth; the
coins on the platform are shoved along by a pusher as it comes forward, and
the ones at the front go over the edge and into the bank. There are tiers
of them, a pusher above pushing onto the platform below, and thousands of
coins in the machine at once.

Played at **https://onion2k.github.io/coinpush/**, in a browser with WebGPU:
current Chrome, Edge and Safari have it, and the boot screen says so if
yours does not.

Built on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics), from
[artshape-game-template](https://github.com/onion2k/artshape-game-template):
a software factory for a browser game that loads fast, draws fast and has
no bugs, with every check in place from the first commit.

## How it plays

You start with a hundred coins in hand. Move the mouse, or a finger, to
slide the funnel along the top of the board, and tap, click or press space
to drop a coin; hold it down for one after another. The coin falls through
the pins and lands somewhere along the top tier, where the pusher carries
it forward and the step face behind sweeps it off into the bed. Each bed is
pushed toward its edge a little for every coin that joins it, and what goes
over lands on the tier below, and from the bottom tier into the chute,
where it is yours again. The machine is primed with about fifteen hundred
coins and holds four thousand; when your hand is empty it gives you
twenty-five more. Drag to look round it, wheel to zoom.

## Running it

    npm install
    npm run dev            the game at http://localhost:5196

Node 22 or later. The smoke tests, and `look` and `perf` with them, run in
Playwright's Chromium on the machine's own GPU; it is installed once with
`npx playwright install chromium`.

## Deploying

Every push to `main` builds the game and puts it on GitHub Pages, by the
workflow in `.github/workflows/pages.yml`. The quick check runs first, so a
push that breaks it never reaches the page. The page is served under the
repository's name, so the build is given that as its base path; to build
and see the same thing here:

    npm run build -- --base=/coinpush/
    npm run preview -- --base=/coinpush/     http://localhost:4173/coinpush/

The gates that need a GPU stay local: a runner's WebGPU is a software one,
and nothing measured on it would be true of a player's machine.

## The checks

    npm run check:quick    formatting, types, lint, unit tests (the pre-commit hook)
    npm run fuzz           a monkey plays it, and the rules are checked
    npm run determinism    the same seed played twice, hashed
    npm run leaks          a long game, watching what must stay bounded
    npm run pace:check     how it plays, held to a baseline both ways
    npm run bench          what the physics costs a frame, held to a baseline
    npm run perf           boot time, a frame's cost and the download, held to a budget and a baseline
    npm run smoke          the real thing in headless Chromium on the GPU
    npm run look           what it looks like, held to a picture
    npm run check          all of it

`CLAUDE.md` says how the code is laid out, what the gates hold, the budgets,
and the edge cases a new thing has to meet.

## Layout

    src/game.ts            the game without the picture
    src/main.ts            the page: events into words, the frame drawn
    src/debug.ts           window.game, the test API
    src/invariants.ts      what must always hold
    src/autopilot.ts       the machine fed by itself, for the gates
    src/machine.ts         content: the tiers, the pushers' stroke, the board, the coin, the fill
    src/board.ts           the backboard's own small physics: coins among pins
    src/pushers.ts         the pushers' stroke, each a box the physics shoves with
    src/input.ts           the pointer and the keyboard
    src/progress.ts        the save, and where it is kept
    src/random.ts          chance, from one seeded source
    src/physics.ts         the game's side of artshape-physics
    src/scene.ts           the machine as it is drawn
    src/meshes.ts          the few shapes it is drawn with
    src/matrix.ts          placements, as WebGPU reads them
    src/frame-cost.ts      what a frame costs to draw, measured
    scripts/               the gates, each with its baseline beside it
    test/                  unit tests, and a corpus of every save shape
    smoke/                 Playwright: boots, drops, plays through, looks right, costs what it should
    .github/workflows/     the build put on GitHub Pages, on every push to main
