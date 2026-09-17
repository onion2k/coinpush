/**
 * The page: the game drawn, and what the player does to it. Everything that
 * happens in the machine happens in `game.ts`; this turns its events into
 * words on the screen and draws the frame, on the game path of
 * artshape-render. There is no game logic here.
 */
import { createContext } from 'artshape-render/gpu/context';
import { Orbit } from 'artshape-render/gpu/camera';
import { bakeEnvironment } from 'artshape-render/render/env';
import { LightPool } from 'artshape-render/game/lights';
import { GameRenderer } from 'artshape-render/game/renderer';
import { createApi } from './debug';
import { frameCost } from './frame-cost';
import { Game, type GameEvents } from './game';
import { Input } from './input';
import { BOARD, FRONT, TIER, TIERS } from './machine';
import { Progress } from './progress';
import { seeded } from './random';
import { MACHINE_BOX, Scene } from './scene';

/** How many millimetres a world unit is: the renderer fixes a few real sizes by it. */
const MM_PER_UNIT = 100;
const LIGHT_CAPACITY = 16,
  EFFECT_CAPACITY = 16,
  PARTICLE_CAPACITY = 1024;
/** How many of the game's events the test API keeps, before the oldest go. */
const EVENTS_KEPT = 500;
/** Where the camera looks from to begin with: round to the player's side, and down from above. */
const VIEW = { azimuth: -Math.PI / 2, polar: 0.98 };

const canvas = document.getElementById('view') as HTMLCanvasElement;
const boot = document.getElementById('boot')!;
const bootMsg = document.getElementById('bootMsg')!;
const handPanel = document.getElementById('hand')!;
const handText = handPanel.querySelector('b')!;
const wonText = document.getElementById('won')!;
const stats = document.getElementById('stats')!;
const help = document.getElementById('help')!;

main().catch((err: unknown) => {
  bootMsg.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
});

async function main() {
  // ---- the renderer ----

  const ctx = await createContext(canvas);
  bootMsg.textContent = 'compiling shaders…';
  const renderer = new GameRenderer(ctx, LIGHT_CAPACITY, EFFECT_CAPACITY, PARTICLE_CAPACITY, MM_PER_UNIT);
  renderer.look = {
    ...renderer.look,
    sunDir: [0.25, -0.45, 0.86],
    sunColour: [1, 0.95, 0.88],
    exposure: 1.15,
    ambient: 0.55,
    background: [0.04, 0.04, 0.05],
  };
  const env = bakeEnvironment(ctx, 'studio', { size: 128, mips: 6 });
  renderer.setEnvironment(env.specular, env.brdf, env.mips);
  renderer.camera.fov = 38;
  renderer.camera.near = 2;
  renderer.camera.far = 600;
  renderer.setSunShadow(MACHINE_BOX);

  // ---- the game, and what it says has happened ----

  const query = new URLSearchParams(location.search);
  const progress = new Progress();
  const input = new Input(canvas);
  /** What has happened, a line each, for the test API. */
  const eventLog: string[] = [];
  const log = (line: string) => {
    eventLog.push(line);
    if (eventLog.length > EVENTS_KEPT) eventLog.splice(0, eventLog.length - EVENTS_KEPT);
  };
  const showHand = () => {
    handText.textContent = String(progress.save.hand);
    wonText.textContent = String(progress.save.banked);
  };
  const events: GameEvents = {
    dropped(x) {
      log(`dropped ${x.toFixed(1)}`);
      showHand();
    },
    landed(x, y) {
      log(`landed ${x.toFixed(1)},${y.toFixed(1)}`);
    },
    banked(x, y) {
      log(`banked ${x.toFixed(1)},${y.toFixed(1)}`);
      showHand();
    },
    returned() {
      log('returned');
      showHand();
    },
    refused() {
      log('refused');
    },
    topUp(n) {
      log(`topUp ${n}`);
      showHand();
    },
  };
  // ?seed=N makes chance the same from before the machine is primed, for a test that wants the same machine every run
  const seed = query.get('seed');
  const game = new Game(progress, events, seed !== null ? { random: seeded(+seed) } : {});
  const { world, board } = game;
  // the save written when the page goes away, so what was won is not lost to a closed tab
  addEventListener('pagehide', () => game.persist());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.persist();
  });

  // ---- the scene ----

  const scene = new Scene();
  renderer.setStatic(scene.static());
  renderer.setDynamic(scene.dynamic(+(query.get('detail') ?? 0)));
  const lights = new LightPool(LIGHT_CAPACITY);
  lights.add({ position: [0, TIER[0].back - 6, BOARD.foot + 12], radius: 60, colour: [1, 0.9, 0.7], intensity: 40 });
  lights.add({ position: [0, FRONT + 4, 16], radius: 40, colour: [1, 0.85, 0.6], intensity: 25 });
  renderer.setLights(lights);

  const cam = renderer.camera;
  // looking at the middle of the machine, from the player's side and above
  const at: [number, number, number] = [
    0,
    (MACHINE_BOX.min[1] + MACHINE_BOX.max[1]) / 2 + 3,
    (MACHINE_BOX.max[2] + MACHINE_BOX.min[2]) / 2 - 2,
  ];
  cam.target = at;
  cam.position = [
    at[0] + 90 * Math.sin(VIEW.polar) * Math.cos(VIEW.azimuth),
    at[1] + 90 * Math.sin(VIEW.polar) * Math.sin(VIEW.azimuth),
    at[2] + 90 * Math.cos(VIEW.polar),
  ];
  const orbit = new Orbit(cam, {
    element: canvas,
    minPolar: 0.3,
    maxPolar: 1.35,
    minDistance: 30,
    maxDistance: 260,
    rotateSpeed: 0.4,
    zoomSpeed: 0.8,
    panSpeed: 0,
    inertia: 0.5,
  });

  let width = 1,
    height = 1;
  /** The whole machine in the frame, however the screen is shaped: as far back as its height or its width needs. */
  const fit = () => {
    const half = Math.tan((cam.fov * Math.PI) / 360);
    const tall =
      (MACHINE_BOX.max[2] - MACHINE_BOX.min[2]) * Math.sin(VIEW.polar) +
      (MACHINE_BOX.max[1] - MACHINE_BOX.min[1]) * Math.cos(VIEW.polar);
    const wide = MACHINE_BOX.max[0] - MACHINE_BOX.min[0] + 4;
    orbit.setSpherical({ radius: Math.max((tall * 0.55) / half, (wide * 0.55) / (half * cam.aspect)) });
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    cam.aspect = width / height;
    renderer.resize(width, height);
    fit();
  };
  addEventListener('resize', resize);
  resize();

  function upload() {
    const placed = scene.write(game);
    renderer.move(0, scene.coins, placed.coins);
    renderer.move(1, scene.flying, placed.flying);
    renderer.move(2, scene.pushers, TIERS);
    renderer.move(3, scene.funnel, 1);
  }

  /** What a frame of the scene as it stands costs, drawn to a texture of our own rather than the canvas, so no wait to be shown is counted. */
  async function measureFrame(): Promise<number> {
    const target = ctx.device.createTexture({
      label: 'measuring target',
      size: [width, height],
      format: ctx.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const view = target.createView();
    const cost = await frameCost(
      () => {
        upload();
        return renderer.frame(view, 'redraw', 1 / 60);
      },
      () => ctx.device.queue.onSubmittedWorkDone(),
    );
    target.destroy();
    return cost;
  }

  await renderer.ready;
  boot.classList.add('gone');
  handPanel.hidden = false;
  stats.hidden = false;
  help.hidden = false;
  showHand();

  // ---- each frame ----

  let frames = 0;
  let smoothed = 0;
  function simulate(dt: number) {
    frames++;
    game.step(dt, input.read(dt));
  }
  function draw(dt: number) {
    orbit.update();
    cam.update();
    upload();
    const t = performance.now();
    renderer.frame(ctx.context.getCurrentTexture().createView(), 'redraw', dt);
    smoothed += (performance.now() - t - smoothed) * 0.05;
    if (frames % 30 === 0)
      stats.textContent = `${smoothed.toFixed(1)} ms · ${world.live} coins · ${board.count} falling`;
  }

  // ---- the test API, and the frame loop ----

  // ?paused=1 starts the game stopped where it was built, so a test sees the
  // same machine every run: no frame of its own has run, and every one after
  // is the test's, of a length it chose
  let paused = query.has('paused');
  let ready = false;
  let bootMs = 0;
  window.game = createApi({
    game,
    ready: () => ready,
    bootMs: () => bootMs,
    paused: () => paused,
    setPaused: (p) => {
      paused = p;
    },
    simulate,
    draw,
    frame: () => frames,
    setControls: (c) => {
      input.override = c;
    },
    look(x, y, z, view) {
      cam.target = [x, y, z];
      orbit.setSpherical(view);
      for (let i = 0; i < 400; i++) orbit.update();
    },
    measureFrame,
    events: eventLog,
  });

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    if (paused) {
      draw(0);
      return;
    }
    simulate(dt);
    draw(dt);
  };
  ready = true;
  bootMs = performance.now();
  requestAnimationFrame(frame);
}
