import { Application } from 'pixi.js';
// Lets PixiJS run under the page's CSP, which forbids eval.
import 'pixi.js/unsafe-eval';
import { parseMidiMessage } from '../core/midi';
import type { HammerlightApi } from '../core/protocol';
import { Take } from '../core/take';
import { defaultLayoutOptions, layout } from '../render/layout';
import { ScenePainter } from '../render/paint';

declare global {
  interface Window {
    hammerlight: HammerlightApi;
  }
}

const WIDTH = 1280;
const HEIGHT = 400;
// In replay, start this many seconds before the first note so it has room to fall.
const REPLAY_LEAD = 2;
const CLOCK_INTERVAL_MS = 500;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const inputSelect = $<HTMLSelectElement>('input');
const modeSelect = $<HTMLSelectElement>('mode');
const status = $<HTMLSpanElement>('status');

let take = new Take();
// performance.now() (ms) at which the take's clock reads 0.
let takeOrigin = performance.now();
let replayOrigin = 0;

const sessionTime = (nowMs: number): number => (nowMs - takeOrigin) / 1000;

function newTake(): void {
  take = new Take();
  takeOrigin = performance.now();
  window.hammerlight.broadcast({ type: 'reset' });
}

function onMidiMessage(e: MIDIMessageEvent): void {
  if (!e.data) return;
  // e.timeStamp is on the same clock as performance.now().
  const ev = parseMidiMessage(e.data, sessionTime(e.timeStamp));
  if (!ev) return;
  take.push(ev);
  window.hammerlight.broadcast({ type: 'events', events: [ev] });
}

async function setupMidi(): Promise<void> {
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  } catch (err) {
    status.textContent = `MIDI unavailable: ${String(err)}`;
    return;
  }
  const refresh = (): void => {
    const current = inputSelect.value;
    inputSelect.replaceChildren();
    for (const input of access.inputs.values()) {
      inputSelect.add(new Option(input.name ?? input.id, input.id));
    }
    if ([...access.inputs.keys()].includes(current)) inputSelect.value = current;
    connect();
  };
  const connect = (): void => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = input.id === inputSelect.value ? onMidiMessage : null;
    }
    status.textContent = access.inputs.size === 0 ? 'No MIDI input found' : '';
  };
  inputSelect.addEventListener('change', connect);
  access.onstatechange = refresh;
  refresh();
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({ width: WIDTH, height: HEIGHT, backgroundAlpha: 0, antialias: true, autoStart: false });
  $('stage').appendChild(app.canvas);
  const painter = new ScenePainter();
  app.stage.addChild(painter.view);

  modeSelect.addEventListener('change', () => {
    replayOrigin = performance.now();
  });
  $('clear').addEventListener('click', newTake);

  const url = await window.hammerlight.overlayUrl();
  const code = document.createElement('code');
  code.textContent = url;
  if (url) $('overlay').replaceChildren('OBS browser source: ', code);
  else $('overlay').textContent = 'OBS overlay server is not running';

  setInterval(() => window.hammerlight.broadcast({ type: 'clock', t: sessionTime(performance.now()) }), CLOCK_INTERVAL_MS);

  const frame = (): void => {
    const now = performance.now();
    if (modeSelect.value === 'replay') {
      const t = take.firstTime - REPLAY_LEAD + (now - replayOrigin) / 1000;
      painter.paint(layout(take.notes, t, defaultLayoutOptions(WIDTH, HEIGHT, 'video')));
    } else {
      painter.paint(layout(take.notes, sessionTime(now), defaultLayoutOptions(WIDTH, HEIGHT, 'live')));
    }
    app.renderer.render(app.stage);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  await setupMidi();
}

void main();
