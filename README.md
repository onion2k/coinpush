# Coinpush

A coin pusher, the arcade kind. Drop a coin in at the top and it falls
through a field of pegs onto a platform that slides back and forth; the
coins on the platform are shoved along by a pusher as it comes forward, and
the ones at the front go over the edge and into the bank. There are tiers
of them, a pusher above pushing onto the platform below, and thousands of
coins in the machine at once.

Built on [artshape-render](https://github.com/onion2k/artshape-render) and
[artshape-physics](https://github.com/onion2k/artshape-physics), from
[artshape-game-template](https://github.com/onion2k/artshape-game-template):
a software factory for a browser game that loads fast, draws fast and has
no bugs, with every check in place from the first commit.

## Where it stands

The game is still the template's stub: a sled on a square floor, a dozen
balls and a hole. The coin pusher replaces it one feature at a time,
through `/feature`, every check green at each step.

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

    src/game.ts        the game without the picture
    src/main.ts        the page: events into words, the frame drawn
    src/debug.ts       window.game, the test API
    src/invariants.ts  what must always hold
    src/autopilot.ts   the game played by itself, for the gates
    src/arena.ts       content: the stub's floor, hole and balls, for now
    src/progress.ts    the save, and where it is kept
    src/physics.ts     the game's side of artshape-physics
    src/scene.ts       the scene as it is drawn
    scripts/           the gates, each with its baseline beside it
    test/              unit tests, and a corpus of every save shape
    smoke/             Playwright: boots, drives, plays through, looks right, costs what it should
