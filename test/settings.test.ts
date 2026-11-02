import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OverlayController } from '../src/main/overlay-controller';
import { DEFAULT_SETTINGS, isValidPort, loadSettings, saveSettings } from '../src/main/settings';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hammerlight-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('settings', () => {
  it('falls back to defaults when the file is missing or damaged', async () => {
    expect(await loadSettings(join(dir, 'none.json'))).toEqual(DEFAULT_SETTINGS);
    await writeFile(join(dir, 'bad.json'), '{ not json');
    expect(await loadSettings(join(dir, 'bad.json'))).toEqual(DEFAULT_SETTINGS);
    await writeFile(join(dir, 'odd.json'), '{"overlayPort": 80}');
    expect(await loadSettings(join(dir, 'odd.json'))).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through a directory that does not exist yet', async () => {
    const file = join(dir, 'nested', 'settings.json');
    await saveSettings(file, { overlayPort: 18000 });
    expect(await loadSettings(file)).toEqual({ overlayPort: 18000 });
    expect(await readFile(file, 'utf8')).toContain('"overlayPort": 18000');
  });

  it('accepts only whole ports from 1024 to 65535', () => {
    expect([1024, 17321, 65535].every(isValidPort)).toBe(true);
    expect([80, 1023, 65536, 1.5, Number.NaN, '17321', null].some(isValidPort)).toBe(false);
  });
});

describe('OverlayController', () => {
  let blocker: Server | null = null;
  afterEach(() => {
    blocker?.close();
    blocker = null;
  });

  it('reports a taken port and recovers on a free one', async () => {
    blocker = createServer();
    const taken = await new Promise<number>((ok) =>
      blocker!.listen(0, '127.0.0.1', () => ok((blocker!.address() as { port: number }).port)),
    );
    const overlay = new OverlayController({ staticRoot: dir }, taken);

    const failed = await overlay.listen(taken);
    expect(failed.url).toBeNull();
    expect(failed.error).toMatch(/already in use/);

    const ok = await overlay.listen(0);
    expect(ok.error).toBeNull();
    expect(ok.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    await overlay.close();
    expect(overlay.status().url).toBeNull();
  });
});
