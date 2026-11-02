# hammerlight

A MIDI piano visualizer for macOS and Windows, built for two jobs:

- **Streaming.** Play, and your notes light up the keyboard and rise away from it.
  Add one URL as a browser source in OBS and it composites over your camera with a
  transparent background.
- **Video.** Replay a take with the notes falling onto the keys and landing exactly
  when they sound.

> Status: early. Live input, the OBS overlay and replay are in place. Saving takes,
> video export and visual effects are next.

## How it works

Rendering is split in two:

- `layout(notes, t, options)` in [`src/render/layout.ts`](src/render/layout.ts) turns
  a take and a time into a flat list of shapes. It reads no clock and no randomness.
- `ScenePainter` in [`src/render/paint.ts`](src/render/paint.ts) draws those shapes with PixiJS.

The live view, the OBS overlay and (later) frame-by-frame video export all call the
same `layout`, so they all draw the same thing for the same `t`. The only real
difference between the modes is whether the future is known: live notes rise after
they are played, video notes fall before they sound.

```
MIDI keyboard ─▶ app window (Web MIDI) ─▶ take ─▶ layout(t) ─▶ preview
                        │
                        └─ WebSocket on 127.0.0.1 ─▶ OBS browser source ─▶ layout(t) ─▶ overlay
```

OBS browser sources cannot open MIDI devices, so the app reads the keyboard and
forwards events to the overlay page over a local WebSocket.

## Use it

```sh
npm install
npm run dev
```

Pick your keyboard under **MIDI input**. The header shows the overlay URL
(`http://127.0.0.1:17321/` by default; set `HAMMERLIGHT_PORT` to change it). In
OBS, add a **Browser** source with that URL and set its width and height to the
area you want covered.

On Windows, a MIDI input port can usually be opened by one app at a time. If
another app needs the keyboard too, route it through a virtual MIDI port such as
loopMIDI.

## Develop

```sh
npm run typecheck
npm test        # includes golden scenes in test/golden/
npm run build
```

If you change what gets drawn on purpose, update the golden scenes with
`npx vitest run -u` and review the diff.

If `npm run dev` fails with `Cannot read properties of undefined (reading 'whenReady')`,
your shell has `ELECTRON_RUN_AS_NODE` set (VS Code's integrated terminal does
this); unset it first.

## License

MIT
