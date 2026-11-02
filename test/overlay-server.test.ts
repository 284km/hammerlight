import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startOverlayServer, type OverlayServer } from '../src/main/overlay-server';

describe('overlay server', () => {
  let dir: string;
  let server: OverlayServer;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hammerlight-'));
    await mkdir(join(dir, 'renderer', 'overlay'), { recursive: true });
    await writeFile(join(dir, 'renderer', 'overlay', 'index.html'), '<p>overlay</p>');
    await writeFile(join(dir, 'secret.txt'), 'not served');
    server = await startOverlayServer({ port: 0, staticRoot: join(dir, 'renderer') });
  });

  afterEach(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('redirects / to the overlay page and serves it', async () => {
    const res = await fetch(server.url, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/overlay/index.html');
    const page = await fetch(new URL('/overlay/index.html', server.url));
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toBe('<p>overlay</p>');
  });

  it('does not serve files outside the static root', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
      const res = await fetch(server.url.replace(/\/$/, '') + path);
      expect(res.status, path).not.toBe(200);
    }
  });

  it('sends broadcasts to connected pages', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}/events`);
    await new Promise((ok) => ws.once('open', ok));
    const received = new Promise<string>((ok) => ws.once('message', (data) => ok(String(data))));
    server.broadcast({ type: 'clock', t: 3.25 });
    expect(JSON.parse(await received)).toEqual({ type: 'clock', t: 3.25 });
    ws.close();
  });
});
