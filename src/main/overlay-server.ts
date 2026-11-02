import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import type { WireMessage } from '../core/protocol';

// Serves the overlay page to OBS browser sources and pushes MIDI to them over
// WebSocket. OBS browser sources cannot open MIDI devices themselves.

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export interface OverlayServerOptions {
  // 0 picks a free port.
  port: number;
  // Built renderer output; the overlay lives at <staticRoot>/overlay/index.html.
  staticRoot: string;
  // In development the overlay is served by the Vite dev server instead.
  devUrl?: string;
}

export interface OverlayServer {
  url: string;
  port: number;
  broadcast(msg: WireMessage): void;
  close(): Promise<void>;
}

export async function startOverlayServer(opts: OverlayServerOptions): Promise<OverlayServer> {
  const root = resolve(opts.staticRoot);
  let port = opts.port;

  const http = createServer(async (req, res) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path === '/') {
      const target = opts.devUrl ? `${opts.devUrl}/overlay/index.html?ws=${port}` : '/overlay/index.html';
      res.writeHead(302, { location: target }).end();
      return;
    }
    if (opts.devUrl) {
      res.writeHead(404).end();
      return;
    }
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  const wss = new WebSocketServer({ server: http, path: '/events' });

  await new Promise<void>((ok, fail) => {
    http.once('error', fail);
    http.listen(opts.port, '127.0.0.1', () => ok());
  });
  port = (http.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/`,
    port,
    broadcast(msg) {
      const data = JSON.stringify(msg);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    },
    close() {
      for (const client of wss.clients) client.terminate();
      wss.close();
      return new Promise((ok) => http.close(() => ok()));
    },
  };
}
