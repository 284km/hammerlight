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

## Install (Windows)

Download the installer from the [latest release](https://github.com/284km/hammerlight/releases/latest):

- `hammerlight-<version>-setup-x64.exe` for most PCs
- `hammerlight-<version>-setup-arm64.exe` for Windows on Arm (Snapdragon and similar)

Run it. It installs for your user only, so it needs no administrator rights, and
starts hammerlight when done.

The installer is not code-signed yet, so Windows SmartScreen may say
"Windows protected your PC". Choose **More info**, then **Run anyway**.

## Use it

1. Connect your keyboard and pick it under **MIDI input**.
2. In OBS, add a **Browser** source with the URL shown in the header
   (`http://127.0.0.1:17321/` by default) and set its width and height to the
   area you want covered. The background is transparent.
3. **View → Replay take** plays back what you just played with the notes falling.

If another app already uses port 17321, change **OBS port** and press **Apply**;
the port is remembered.

On Windows, a MIDI input can usually be open in only one app at a time. If
hammerlight says it could not open your keyboard, close the other app (a DAW,
for example), or route the keyboard through a virtual MIDI port such as loopMIDI.

## Run from source

```sh
npm install
npm run dev
```

`HAMMERLIGHT_PORT` overrides the overlay port for that run without saving it.

## Develop

```sh
npm run typecheck
npm test        # includes golden scenes in test/golden/
npm run build
```

If you change what gets drawn on purpose, update the golden scenes with
`npx vitest run -u` and review the diff.

`npm run dist:win` builds the Windows installers into `dist/` (this works on
macOS too). Releases: bump `version` in `package.json`, then push a tag
`v<version>`; the Release workflow attaches the installers to a draft release.

The icon is drawn by `scripts/make-icon.mjs` (`npm run icon`).

If `npm run dev` fails with `Cannot read properties of undefined (reading 'whenReady')`,
your shell has `ELECTRON_RUN_AS_NODE` set (VS Code's integrated terminal does
this); unset it first.

## License

MIT
