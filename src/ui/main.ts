import { Application } from 'pixi.js';
// Lets PixiJS run under the page's CSP, which forbids eval.
import 'pixi.js/unsafe-eval';
import { parseMidiMessage } from '../core/midi';
import type { HammerlightApi, OverlayStatus } from '../core/protocol';
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
const portInput = $<HTMLInputElement>('port');
const status = $<HTMLSpanElement>('status');

let take = new Take();
// performance.now() (ms) at which the take's clock reads 0.
let takeOrigin = performance.now();
let replayOrigin = 0;

const sessionTime = (nowMs: number): number => (nowMs - takeOrigin) / 1000;

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

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
    setStatus(`MIDI unavailable: ${String(err)}`, true);
    return;
  }

  // Open the chosen input explicitly and close the rest, so other apps can use
  // them. On Windows a MIDI input can usually be open in only one app at a time,
  // and opening one that is taken fails here rather than silently.
  const connect = async (): Promise<void> => {
    for (const input of access.inputs.values()) {
      if (input.id === inputSelect.value) continue;
      input.onmidimessage = null;
      if (input.connection === 'open') await input.close();
    }
    const chosen = access.inputs.get(inputSelect.value);
    if (!chosen) {
      setStatus('No MIDI input found', true);
      return;
    }
    try {
      await chosen.open();
      if (chosen.connection !== 'open') throw new Error(`connection is ${chosen.connection}`);
      chosen.onmidimessage = onMidiMessage;
      setStatus('');
    } catch (err) {
      setStatus(`Could not open ${chosen.name ?? 'the MIDI input'}. Is another app using it? (${String(err)})`, true);
    }
  };

  const connected = (): MIDIInput[] => [...access.inputs.values()].filter((i) => i.state === 'connected');
  let listed = '';
  // Our own open/close also fires statechange, so rebuild only when the set of
  // plugged-in inputs changes.
  const refresh = (): void => {
    const inputs = connected();
    const ids = inputs.map((i) => i.id).join('\n');
    if (ids === listed) return;
    listed = ids;
    const current = inputSelect.value;
    inputSelect.replaceChildren(...inputs.map((i) => new Option(i.name ?? i.id, i.id)));
    if (inputs.some((i) => i.id === current)) inputSelect.value = current;
    void connect();
  };

  inputSelect.addEventListener('change', () => void connect());
  access.onstatechange = refresh;
  // Force the first listing even when no inputs are connected.
  listed = '\0';
  refresh();
}

function showOverlay(s: OverlayStatus): void {
  portInput.value = String(s.port);
  const box = $('overlay');
  if (s.url) {
    const code = document.createElement('code');
    code.textContent = s.url;
    box.replaceChildren('Add to OBS as a browser source: ', code);
  } else {
    const err = document.createElement('span');
    err.className = 'error';
    err.textContent = s.error ?? 'OBS overlay is not running';
    box.replaceChildren(err);
  }
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
  $('apply-port').addEventListener('click', async () => {
    showOverlay(await window.hammerlight.setOverlayPort(Number(portInput.value)));
  });

  showOverlay(await window.hammerlight.overlayStatus());

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
