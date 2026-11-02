import type { MidiEvent } from './midi';

// Messages from the app to overlay pages (OBS browser sources) over WebSocket.
// `clock` lets a page that joins mid-session line its clock up with the take.
export type WireMessage =
  | { type: 'events'; events: MidiEvent[] }
  | { type: 'clock'; t: number }
  | { type: 'reset' };

// What the preload script exposes to the app window as `window.hammerlight`.
export interface HammerlightApi {
  broadcast(msg: WireMessage): void;
  overlayUrl(): Promise<string | null>;
}
