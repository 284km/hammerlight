import { describe, expect, it } from 'vitest';
import type { MidiEvent } from '../src/core/midi';
import { Take } from '../src/core/take';
import { defaultLayoutOptions, isBlack, keyboardGeometry, layout } from '../src/render/layout';

// C major arpeggio in the right hand over a held low C, then a chord.
const EVENTS: MidiEvent[] = [
  { kind: 'noteOn', t: 0.0, channel: 0, note: 48, velocity: 70 },
  { kind: 'noteOn', t: 0.0, channel: 0, note: 60, velocity: 90 },
  { kind: 'noteOff', t: 0.25, channel: 0, note: 60 },
  { kind: 'noteOn', t: 0.25, channel: 0, note: 64, velocity: 85 },
  { kind: 'noteOff', t: 0.5, channel: 0, note: 64 },
  { kind: 'noteOn', t: 0.5, channel: 0, note: 67, velocity: 100 },
  { kind: 'noteOff', t: 0.75, channel: 0, note: 67 },
  { kind: 'noteOff', t: 1.0, channel: 0, note: 48 },
  { kind: 'noteOn', t: 1.0, channel: 0, note: 61, velocity: 60 },
  { kind: 'noteOn', t: 1.0, channel: 0, note: 66, velocity: 60 },
  { kind: 'noteOff', t: 1.5, channel: 0, note: 61 },
  { kind: 'noteOff', t: 1.5, channel: 0, note: 66 },
];

describe('keyboardGeometry', () => {
  it('lays out 88 keys with 52 white keys across the full width', () => {
    const keys = keyboardGeometry(21, 108, 1040);
    expect(keys).toHaveLength(88);
    const whites = keys.filter((k) => !k.black);
    expect(whites).toHaveLength(52);
    expect(whites[0].x).toBe(0);
    expect(whites[51].x + whites[51].w).toBeCloseTo(1040);
  });

  it('centres each black key on the boundary of its white neighbours', () => {
    const keys = keyboardGeometry(60, 72, 800);
    const cSharp = keys.find((k) => k.note === 61)!;
    const d = keys.find((k) => k.note === 62)!;
    expect(cSharp.x + cSharp.w / 2).toBeCloseTo(d.x);
  });

  it('knows the black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlack)).toEqual([false, true, false, true, false, false, true]);
  });
});

describe('layout', () => {
  const take = Take.from(EVENTS);

  it('in live mode shows nothing before a note is played and lights held keys', () => {
    const o = defaultLayoutOptions(1280, 400, 'live');
    const held = Take.from([{ kind: 'noteOn', t: 1, channel: 0, note: 60, velocity: 64 }]);
    expect(layout(held.notes, 0.5, o).bars).toHaveLength(0);
    const scene = layout(held.notes, 1.5, o);
    expect(scene.bars).toHaveLength(1);
    expect(scene.keys.find((k) => k.note === 60)!.pressed).toBe(true);
    // Held for 0.5 s, so the bar reaches from the keyboard up 0.5 s worth of pixels.
    const kbTop = 400 - o.keyboardHeight;
    expect(scene.bars[0].y + scene.bars[0].h).toBeCloseTo(kbTop);
    expect(scene.bars[0].h).toBeCloseTo((0.5 * kbTop) / o.secondsVisible);
  });

  it('in video mode shows notes before they sound, landing on the keyboard', () => {
    const o = defaultLayoutOptions(1280, 400, 'video');
    const kbTop = 400 - o.keyboardHeight;
    const scene = layout(take.notes, -1, o);
    expect(scene.keys.some((k) => k.pressed)).toBe(false);
    const first = scene.bars.find((b) => b.note === 60)!;
    // One second before it sounds, its bottom edge is one second above the keyboard.
    expect(first.y + first.h).toBeCloseTo(kbTop - kbTop / o.secondsVisible);
  });

  it('splits hands at middle C', () => {
    const scene = layout(take.notes, 0.1, defaultLayoutOptions(1280, 400, 'live'));
    expect(scene.bars.map((b) => [b.note, b.hand])).toEqual([[48, 'left'], [60, 'right']]);
  });

  it('draws the same scene for the same input', () => {
    const o = defaultLayoutOptions(1280, 400, 'video');
    expect(layout(take.notes, 0.6, o)).toEqual(layout(Take.from(EVENTS).notes, 0.6, o));
  });

  // Golden scenes: any change to what gets drawn shows up as a diff here.
  for (const [mode, t] of [['live', 1.2], ['video', 0.6]] as const) {
    it(`matches the golden ${mode} scene at t=${t}`, async () => {
      const scene = layout(take.notes, t, defaultLayoutOptions(1280, 400, mode));
      const drawn = { bars: scene.bars, pressed: scene.keys.filter((k) => k.pressed).map((k) => k.note) };
      await expect(JSON.stringify(drawn, null, 1) + '\n').toMatchFileSnapshot(`./golden/scene-${mode}.json`);
    });
  }
});
