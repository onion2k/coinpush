/**
 * The player's hands: the pointer slides the funnel along the board as it
 * moves across the screen, a tap, a click or the space bar drops a coin,
 * held down for one after another, and the arrow keys slide the funnel
 * too. A drag is the camera's, not a drop. Something other than a person,
 * a test say, can hold the controls instead.
 */
import type { Controls } from './game';

/** A pointer that moves less than this before it lifts, within this long, is a tap. */
const TAP_PIXELS = 8,
  TAP_MS = 500;
/** How much of the funnel's reach the arrow keys cross in a second. */
const KEY_SPEED = 0.7;
/** The keys that drop a coin. */
const DROP_KEYS = [' ', 'enter', 'w', 'arrowup'];

export class Input {
  private readonly down = new Set<string>();
  /** Where the funnel is being put, as a share of its reach, or nowhere in particular. */
  private funnel: number | null = null;
  private tapped = false;
  private pressed: { x: number; y: number; at: number } | null = null;
  /** The controls held by something other than a person: read before anything else while it is set. */
  override: Controls | null = null;

  constructor(private readonly element: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.down.add(k);
      // a press is a drop even if the key is up again before the next frame looks
      if (DROP_KEYS.includes(k)) this.tapped = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.down.clear());
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.pressed = { x: e.clientX, y: e.clientY, at: performance.now() };
      this.slideTo(e.clientX);
    });
    element.addEventListener('pointermove', (e) => {
      // sliding follows the pointer when nothing is pressed, or a press that has not become a drag
      if (!this.pressed) this.slideTo(e.clientX);
      else if (Math.hypot(e.clientX - this.pressed.x, e.clientY - this.pressed.y) < TAP_PIXELS) this.slideTo(e.clientX);
    });
    const lift = (e: PointerEvent) => {
      const p = this.pressed;
      this.pressed = null;
      if (!p) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < TAP_PIXELS && performance.now() - p.at < TAP_MS)
        this.tapped = true;
    };
    addEventListener('pointerup', lift);
    addEventListener('pointercancel', lift);
  }

  private slideTo(clientX: number) {
    const r = this.element.getBoundingClientRect();
    this.funnel = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
  }

  private is(...keys: string[]) {
    return keys.some((k) => this.down.has(k));
  }

  /** What the player is doing this frame of `dt` seconds. */
  read(dt: number): Controls {
    if (this.override) return this.override;
    const slide = (this.is('d', 'arrowright') ? 1 : 0) - (this.is('a', 'arrowleft') ? 1 : 0);
    if (slide) this.funnel = Math.max(0, Math.min(1, (this.funnel ?? 0.5) + slide * KEY_SPEED * dt));
    const drop = this.tapped || this.is(...DROP_KEYS);
    this.tapped = false;
    return { funnel: this.funnel, drop };
  }
}
