import { describe, expect, it } from 'vitest';
import { parseMidiMessage } from '../src/core/midi';
import { Take } from '../src/core/take';

describe('parseMidiMessage', () => {
  it('reads note-on, note-off and the channel', () => {
    expect(parseMidiMessage([0x93, 60, 100], 1.5)).toEqual({ kind: 'noteOn', t: 1.5, channel: 3, note: 60, velocity: 100 });
    expect(parseMidiMessage([0x80, 60, 64], 2)).toEqual({ kind: 'noteOff', t: 2, channel: 0, note: 60 });
  });

  it('treats note-on with velocity 0 as note-off', () => {
    expect(parseMidiMessage([0x90, 60, 0], 2)).toEqual({ kind: 'noteOff', t: 2, channel: 0, note: 60 });
  });

  it('keeps the three pedals and drops other controllers and short messages', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 0)).toEqual({ kind: 'pedal', t: 0, channel: 0, controller: 64, value: 127 });
    expect(parseMidiMessage([0xb0, 66, 0], 0)?.kind).toBe('pedal');
    expect(parseMidiMessage([0xb0, 67, 0], 0)?.kind).toBe('pedal');
    expect(parseMidiMessage([0xb0, 7, 100], 0)).toBeNull();
    expect(parseMidiMessage([0xc0, 1], 0)).toBeNull();
    expect(parseMidiMessage([0xfe], 0)).toBeNull();
  });
});

describe('Take', () => {
  it('pairs note-on with note-off and leaves held notes open', () => {
    const take = Take.from([
      { kind: 'noteOn', t: 0, channel: 0, note: 60, velocity: 80 },
      { kind: 'noteOn', t: 0.1, channel: 0, note: 64, velocity: 90 },
      { kind: 'noteOff', t: 0.5, channel: 0, note: 60 },
    ]);
    expect(take.notes).toEqual([
      { channel: 0, note: 60, velocity: 80, start: 0, end: 0.5 },
      { channel: 0, note: 64, velocity: 90, start: 0.1, end: null },
    ]);
  });

  it('ends a note when the same key is struck again without a note-off', () => {
    const take = Take.from([
      { kind: 'noteOn', t: 0, channel: 0, note: 60, velocity: 80 },
      { kind: 'noteOn', t: 0.3, channel: 0, note: 60, velocity: 70 },
      { kind: 'noteOff', t: 0.6, channel: 0, note: 60 },
    ]);
    expect(take.notes.map((n) => [n.start, n.end])).toEqual([[0, 0.3], [0.3, 0.6]]);
  });

  it('keeps the same note on different channels apart', () => {
    const take = Take.from([
      { kind: 'noteOn', t: 0, channel: 0, note: 60, velocity: 80 },
      { kind: 'noteOn', t: 0.1, channel: 1, note: 60, velocity: 80 },
      { kind: 'noteOff', t: 0.2, channel: 1, note: 60 },
    ]);
    expect(take.notes.map((n) => n.end)).toEqual([null, 0.2]);
  });

  it('keeps pedal events but makes no notes from them', () => {
    const take = Take.from([{ kind: 'pedal', t: 0, channel: 0, controller: 64, value: 127 }]);
    expect(take.events).toHaveLength(1);
    expect(take.notes).toHaveLength(0);
  });
});
