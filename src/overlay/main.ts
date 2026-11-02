import { Application } from 'pixi.js';
import 'pixi.js/unsafe-eval';
import type { WireMessage } from '../core/protocol';
import { Take } from '../core/take';
import { defaultLayoutOptions, layout } from '../render/layout';
import { ScenePainter } from '../render/paint';

// Loaded by an OBS browser source. Size the source in OBS; the page fills it.

const params = new URLSearchParams(location.search);
// In development the page comes from the Vite dev server, so the app's port is passed in.
const wsHost = params.has('ws') ? `127.0.0.1:${params.get('ws')}` : location.host;

let take = new Take();
// Estimate of (take clock - local clock) in seconds. Every message arrives after
// it was sent, so the largest difference seen is the closest to the truth.
let offset = Number.NEGATIVE_INFINITY;
const localNow = (): number => performance.now() / 1000;

function observe(t: number): void {
  offset = Math.max(offset, t - localNow());
}

function onMessage(msg: WireMessage): void {
  switch (msg.type) {
    case 'reset':
      take = new Take();
      offset = Number.NEGATIVE_INFINITY;
      break;
    case 'clock':
      observe(msg.t);
      break;
    case 'events':
      for (const ev of msg.events) {
        observe(ev.t);
        take.push(ev);
      }
      break;
  }
}

function connect(): void {
  const ws = new WebSocket(`ws://${wsHost}/events`);
  ws.onmessage = (e) => onMessage(JSON.parse(String(e.data)) as WireMessage);
  ws.onclose = () => setTimeout(connect, 1000);
}

async function main(): Promise<void> {
  const app = new Application();
  await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoStart: false });
  document.body.appendChild(app.canvas);
  const painter = new ScenePainter();
  app.stage.addChild(painter.view);

  const frame = (): void => {
    if (Number.isFinite(offset)) {
      const { width, height } = app.screen;
      painter.paint(layout(take.notes, localNow() + offset, defaultLayoutOptions(width, height, 'live')));
    }
    app.renderer.render(app.stage);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  connect();
}

void main();
