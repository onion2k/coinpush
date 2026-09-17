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
yours does not. What is there today is the stub described below, not the
pusher yet.

Built on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics), from
[artshape-game-template](https://github.com/onion2k/artshape-game-template):
a software factory for a browser game that loads fast, draws fast and has
no bugs, with every check in place from the first commit.

## Where it stands

The game is still the template's stub: a sled on a square floor, a dozen
balls and a hole. Drive the sled with W A S D or the arrows and shove the
balls into the hole; drag to orbit the camera, and wheel to zoom. Running
it, here or on the page, shows that and not a coin pusher. The pusher
replaces it one feature at a time, through `/feature`, every check green at
each step; the content in `src/arena.ts` usually goes first.

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
    src/autopilot.ts       the game played by itself, for the gates
    src/arena.ts           content: the stub's floor, hole and balls, for now
    src/sled.ts            the stub's sled, the player's machine, for now
    src/input.ts           the keyboard
    src/progress.ts        the save, and where it is kept
    src/random.ts          chance, from one seeded source
    src/physics.ts         the game's side of artshape-physics
    src/scene.ts           the scene as it is drawn
    src/meshes.ts          the few shapes it is drawn with
    src/matrix.ts          placements, as WebGPU reads them
    src/frame-cost.ts      what a frame costs to draw, measured
    scripts/               the gates, each with its baseline beside it
    test/                  unit tests, and a corpus of every save shape
    smoke/                 Playwright: boots, drives, plays through, looks right, costs what it should
    .github/workflows/     the build put on GitHub Pages, on every push to main
