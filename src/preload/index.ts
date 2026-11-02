import { contextBridge, ipcRenderer } from 'electron';
import type { HammerlightApi } from '../core/protocol';

const api: HammerlightApi = {
  broadcast: (msg) => ipcRenderer.send('hl:broadcast', msg),
  overlayStatus: () => ipcRenderer.invoke('hl:overlay-status'),
  setOverlayPort: (port) => ipcRenderer.invoke('hl:set-overlay-port', port),
};

contextBridge.exposeInMainWorld('hammerlight', api);
