import type { OverlayStatus, WireMessage } from '../core/protocol';
import { startOverlayServer, type OverlayServer, type OverlayServerOptions } from './overlay-server';

// Owns the running overlay server and moves it to another port on request.
// A failed move leaves no server running and reports why, so the user can
// pick a different port.
export class OverlayController {
  private server: OverlayServer | null = null;
  private port: number;
  private error: string | null = null;

  constructor(private base: Omit<OverlayServerOptions, 'port'>, port: number) {
    this.port = port;
  }

  status(): OverlayStatus {
    return { port: this.port, url: this.server?.url ?? null, error: this.error };
  }

  async listen(port: number): Promise<OverlayStatus> {
    await this.close();
    this.port = port;
    try {
      this.server = await startOverlayServer({ ...this.base, port });
      this.error = null;
    } catch (err) {
      this.error = describeListenError(err, port);
    }
    return this.status();
  }

  broadcast(msg: WireMessage): void {
    this.server?.broadcast(msg);
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    await server?.close();
  }
}

function describeListenError(err: unknown, port: number): string {
  const code = (err as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'EADDRINUSE') return `Port ${port} is already in use by another app. Choose a different port.`;
  if (code === 'EACCES') return `Not allowed to use port ${port}. Choose a different port.`;
  return `Could not start on port ${port}: ${String(err)}`;
}
