import type { MidiEvent } from './midi';

export interface Note {
  channel: number;
  note: number;
  velocity: number;
  start: number;
  // null while the key is still held.
  end: number | null;
}

// A take is everything played in one session, kept as raw events (for saving)
// and as notes (for drawing). Events must be pushed in time order.
export class Take {
  readonly events: MidiEvent[] = [];
  readonly notes: Note[] = [];
  private held = new Map<number, Note>();

  static from(events: readonly MidiEvent[]): Take {
    const take = new Take();
    for (const ev of events) take.push(ev);
    return take;
  }

  push(ev: MidiEvent): void {
    this.events.push(ev);
    if (ev.kind === 'pedal') return;
    const key = ev.channel * 128 + ev.note;
    const prev = this.held.get(key);
    // A second note-on without a note-off in between ends the first one.
    if (prev) {
      prev.end = ev.t;
      this.held.delete(key);
    }
    if (ev.kind === 'noteOn') {
      const n: Note = { channel: ev.channel, note: ev.note, velocity: ev.velocity, start: ev.t, end: null };
      this.notes.push(n);
      this.held.set(key, n);
    }
  }

  get firstTime(): number {
    return this.events.length > 0 ? this.events[0].t : 0;
  }

  get lastTime(): number {
    return this.events.length > 0 ? this.events[this.events.length - 1].t : 0;
  }
}
