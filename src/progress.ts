/**
 * What the player has, and where it is kept: the coins in hand, what has
 * been won, what the machine has given, and every coin in the machine and
 * on the board, in the browser's storage or, for the game run without a
 * page, anywhere. Old saves must still load: a field a save does not have
 * takes its default, and a field it has that the game no longer knows is
 * left alone.
 */
import { HAND0, TOP_UP } from './machine';

export interface Save {
  /** Coins the player can drop. */
  hand: number;
  /** Coins that have come out of the chute, ever. */
  banked: number;
  /** Coins the machine has handed the player, ever: the starting hand, and every top-up. */
  given: number;
  /** Every coin in the machine: x, y, z, three numbers each. */
  coins: number[];
  /** Every coin on the board: x, how far down, and its speed both ways, four numbers each. */
  flight: number[];
}

/** Where the save is kept. */
export interface SaveStore {
  load(): string | null;
  store(json: string): void;
  clear(): void;
}

export const KEY = 'coinpush-save-v1';

/** The browser's storage, and nothing at all where there is none, or it will not be written. */
export function browserStore(key = KEY): SaveStore {
  return {
    load() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    store(json) {
      try {
        localStorage.setItem(key, json);
      } catch {
        /* fine */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing to remove */
      }
    },
  };
}

/** A save kept in memory, starting from `json` if given: for the game run without a page. */
export function memoryStore(json: string | null = null): SaveStore & { json: string | null } {
  return {
    json,
    load() {
      return this.json;
    },
    store(next) {
      this.json = next;
    },
    clear() {
      this.json = null;
    },
  };
}

const fresh = (): Save => ({ hand: HAND0, banked: 0, given: HAND0, coins: [], flight: [] });

/** A number from a save, or the default where it is missing or not a number. */
function number(from: Record<string, unknown>, key: string, or: number): number {
  const v = from[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : or;
}

/** A list of numbers from a save in groups of `stride`, or none: a group with anything not a number in it ends the list. */
function numbers(from: Record<string, unknown>, key: string, stride: number): number[] {
  const v = from[key];
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (let i = 0; i + stride <= v.length; i += stride) {
    const group = v.slice(i, i + stride) as unknown[];
    if (!group.every((n) => typeof n === 'number' && Number.isFinite(n))) break;
    out.push(...(group as number[]));
  }
  return out;
}

export class Progress {
  readonly save: Save;

  /** Loaded from the store; loading alone never writes. */
  constructor(private readonly saves: SaveStore = browserStore()) {
    this.save = fresh();
    const json = saves.load();
    if (json === null) return;
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return;
    }
    if (typeof raw !== 'object' || raw === null) return;
    const from = raw as Record<string, unknown>;
    const d = fresh();
    this.save.hand = number(from, 'hand', d.hand);
    this.save.banked = number(from, 'banked', d.banked);
    this.save.given = number(from, 'given', d.given);
    this.save.coins = numbers(from, 'coins', 3);
    this.save.flight = numbers(from, 'flight', 4);
  }

  get hand() {
    return this.save.hand;
  }

  /** A coin out of the hand; false if there is none. */
  spend(): boolean {
    if (this.save.hand <= 0) return false;
    this.save.hand--;
    return true;
  }

  /** A coin back to the hand, unspent. */
  refund() {
    this.save.hand++;
  }

  /** Coins out of the chute: into the hand, and counted for good. */
  win(n: number) {
    this.save.hand += n;
    this.save.banked += n;
  }

  /** The machine's gift to an empty hand, counted. */
  topUp(): number {
    this.save.hand += TOP_UP;
    this.save.given += TOP_UP;
    return TOP_UP;
  }

  persist() {
    this.saves.store(JSON.stringify(this.save));
  }

  /** Start over: the save wiped, in memory and in the store. */
  reset() {
    Object.assign(this.save, fresh());
    this.saves.clear();
  }
}
