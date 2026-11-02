import type { Note } from '../core/take';

// layout() is the deterministic half of rendering: notes + a time in, a flat
// list of shapes out. It reads no clock and no randomness, so the live view,
// the preview and a frame-by-frame video export all draw the same thing for
// the same t.

export type Mode =
  // Notes rise away from the keyboard after they are played; the future is unknown.
  | 'live'
  // Notes fall onto the keyboard and land when they sound; the whole take is known.
  | 'video';

export type Hand = 'left' | 'right';

export interface LayoutOptions {
  width: number;
  height: number;
  mode: Mode;
  lowNote: number;
  highNote: number;
  keyboardHeight: number;
  // How many seconds of notes fit between the top edge and the keyboard.
  secondsVisible: number;
  // Notes below this are drawn as the left hand.
  splitNote: number;
}

export interface Key {
  note: number;
  black: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  pressed: boolean;
  velocity: number;
  hand: Hand;
}

export interface Bar {
  note: number;
  x: number;
  y: number;
  w: number;
  h: number;
  velocity: number;
  hand: Hand;
}

export interface Scene {
  width: number;
  height: number;
  keys: Key[];
  bars: Bar[];
}

export function defaultLayoutOptions(width: number, height: number, mode: Mode): LayoutOptions {
  return {
    width,
    height,
    mode,
    lowNote: 21, // A0
    highNote: 108, // C8
    keyboardHeight: Math.round(height * 0.18),
    secondsVisible: 4,
    splitNote: 60, // middle C
  };
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function isBlack(note: number): boolean {
  return BLACK_PITCH_CLASSES.has(((note % 12) + 12) % 12);
}

export interface KeyGeometry {
  note: number;
  black: boolean;
  x: number;
  w: number;
}

export function keyboardGeometry(lowNote: number, highNote: number, width: number): KeyGeometry[] {
  let whites = 0;
  for (let n = lowNote; n <= highNote; n++) if (!isBlack(n)) whites++;
  const ww = width / whites;
  const bw = ww * 0.58;
  const keys: KeyGeometry[] = [];
  let wi = 0;
  for (let n = lowNote; n <= highNote; n++) {
    if (isBlack(n)) {
      // Centred on the boundary between the white keys either side.
      keys.push({ note: n, black: true, x: wi * ww - bw / 2, w: bw });
    } else {
      keys.push({ note: n, black: false, x: wi * ww, w: ww });
      wi++;
    }
  }
  return keys;
}

const MIN_BAR_HEIGHT = 2;

export function layout(notes: readonly Note[], t: number, o: LayoutOptions): Scene {
  const geometry = keyboardGeometry(o.lowNote, o.highNote, o.width);
  const byNote = new Map(geometry.map((g) => [g.note, g]));
  const kbTop = o.height - o.keyboardHeight;
  const pps = kbTop / o.secondsVisible;
  const handOf = (note: number): Hand => (note < o.splitNote ? 'left' : 'right');

  const pressed = new Map<number, number>(); // note -> velocity
  const bars: Bar[] = [];
  for (const n of notes) {
    const g = byNote.get(n.note);
    if (!g) continue;
    const end = n.end ?? t;
    if (n.start <= t && (n.end === null || t < n.end)) pressed.set(n.note, n.velocity);

    let top: number;
    let bottom: number;
    if (o.mode === 'live') {
      if (n.start > t) continue;
      top = kbTop - (t - n.start) * pps;
      bottom = kbTop - (t - Math.min(end, t)) * pps;
    } else {
      top = kbTop - (end - t) * pps;
      bottom = Math.min(kbTop - (n.start - t) * pps, kbTop);
    }
    if (bottom <= 0 || top >= kbTop) continue;

    const inset = g.black ? 0 : g.w * 0.08;
    bars.push({
      note: n.note,
      x: g.x + inset,
      y: top,
      w: g.w - inset * 2,
      h: Math.max(bottom - top, MIN_BAR_HEIGHT),
      velocity: n.velocity,
      hand: handOf(n.note),
    });
  }

  const keys: Key[] = geometry.map((g) => ({
    note: g.note,
    black: g.black,
    x: g.x,
    y: kbTop,
    w: g.w,
    h: g.black ? o.keyboardHeight * 0.62 : o.keyboardHeight,
    pressed: pressed.has(g.note),
    velocity: pressed.get(g.note) ?? 0,
    hand: handOf(g.note),
  }));

  return { width: o.width, height: o.height, keys, bars };
}
