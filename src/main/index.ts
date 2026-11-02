import { app, BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'node:path';
import type { WireMessage } from '../core/protocol';
import { OverlayController } from './overlay-controller';
import { isValidPort, loadSettings, saveSettings } from './settings';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    backgroundColor: '#111114',
    webPreferences: { preload: join(__dirname, '../preload/index.js') },
  });
  win.removeMenu();
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void win.loadURL(`${devUrl}/ui/index.html`);
  else void win.loadFile(join(__dirname, '../renderer/ui/index.html'));
}

app.whenReady().then(async () => {
  const isMidi = (permission: string): boolean => permission === 'midi' || permission === 'midiSysex';
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(isMidi(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => isMidi(permission));

  const settingsFile = join(app.getPath('userData'), 'settings.json');
  const settings = await loadSettings(settingsFile);
  // HAMMERLIGHT_PORT is for development; it is not saved.
  const envPort = Number(process.env.HAMMERLIGHT_PORT);
  const overlay = new OverlayController(
    { staticRoot: join(__dirname, '../renderer'), devUrl: process.env.ELECTRON_RENDERER_URL },
    settings.overlayPort,
  );
  await overlay.listen(isValidPort(envPort) ? envPort : settings.overlayPort);

  ipcMain.on('hl:broadcast', (_e, msg: WireMessage) => overlay.broadcast(msg));
  ipcMain.handle('hl:overlay-status', () => overlay.status());
  ipcMain.handle('hl:set-overlay-port', async (_e, port: unknown) => {
    if (!isValidPort(port)) return { ...overlay.status(), error: 'Port must be a whole number from 1024 to 65535.' };
    const status = await overlay.listen(port);
    if (!status.error) {
      settings.overlayPort = port;
      await saveSettings(settingsFile, settings);
    }
    return status;
  });

  app.on('will-quit', () => void overlay.close());

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
