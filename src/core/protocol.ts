import type { MidiEvent } from './midi';

// Messages from the app to overlay pages (OBS browser sources) over WebSocket.
// `clock` lets a page that joins mid-session line its clock up with the take.
export type WireMessage =
  | { type: 'events'; events: MidiEvent[] }
  | { type: 'clock'; t: number }
  | { type: 'reset' };

export interface OverlayStatus {
  port: number;
  // null when the server is not running.
  url: string | null;
  error: string | null;
}

// What the preload script exposes to the app window as `window.hammerlight`.
export interface HammerlightApi {
  broadcast(msg: WireMessage): void;
  overlayStatus(): Promise<OverlayStatus>;
  // Moves the overlay server and remembers the port for next time.
  setOverlayPort(port: number): Promise<OverlayStatus>;
}
