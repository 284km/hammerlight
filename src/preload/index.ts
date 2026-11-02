import { contextBridge, ipcRenderer } from 'electron';
import type { HammerlightApi } from '../core/protocol';

const api: HammerlightApi = {
  broadcast: (msg) => ipcRenderer.send('hl:broadcast', msg),
  overlayUrl: () => ipcRenderer.invoke('hl:overlay-url'),
};

contextBridge.exposeInMainWorld('hammerlight', api);
