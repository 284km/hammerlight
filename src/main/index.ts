import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'node:path';
import type { WireMessage } from '../core/protocol';
import { startOverlayServer, type OverlayServer } from './overlay-server';

const OVERLAY_PORT = Number(process.env.HAMMERLIGHT_PORT ?? 17321);

let overlay: OverlayServer | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    backgroundColor: '#111114',
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  });
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void win.loadURL(`${devUrl}/ui/index.html`);
  else void win.loadFile(join(__dirname, '../renderer/ui/index.html'));
}

app.whenReady().then(async () => {
  const isMidi = (permission: string): boolean => permission === 'midi' || permission === 'midiSysex';
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(isMidi(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => isMidi(permission));

  try {
    overlay = await startOverlayServer({
      port: OVERLAY_PORT,
      staticRoot: join(__dirname, '../renderer'),
      devUrl: process.env.ELECTRON_RENDERER_URL,
    });
  } catch (err) {
    console.error(`overlay server could not start on port ${OVERLAY_PORT}:`, err);
  }

  ipcMain.on('hl:broadcast', (_e, msg: WireMessage) => overlay?.broadcast(msg));
  ipcMain.handle('hl:overlay-url', () => overlay?.url ?? null);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  void overlay?.close();
});
