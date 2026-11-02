// Times are in seconds on the session clock (0 = when the take started).

export type MidiEvent =
  | { kind: 'noteOn'; t: number; channel: number; note: number; velocity: number }
  | { kind: 'noteOff'; t: number; channel: number; note: number }
  | { kind: 'pedal'; t: number; channel: number; controller: number; value: number };

// Sustain, sostenuto, soft.
const PEDAL_CONTROLLERS = new Set([64, 66, 67]);

export function parseMidiMessage(data: ArrayLike<number>, t: number): MidiEvent | null {
  if (data.length < 3) return null;
  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const a = data[1];
  const b = data[2];
  // A note-on with velocity 0 is a note-off (running-status keyboards send these).
  if (status === 0x90 && b > 0) return { kind: 'noteOn', t, channel, note: a, velocity: b };
  if (status === 0x80 || status === 0x90) return { kind: 'noteOff', t, channel, note: a };
  if (status === 0xb0 && PEDAL_CONTROLLERS.has(a)) return { kind: 'pedal', t, channel, controller: a, value: b };
  return null;
}
