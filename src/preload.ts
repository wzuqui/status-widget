import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('statusWidget', {
  close: () => ipcRenderer.send('window:close'),
  getCards: () => ipcRenderer.invoke('config:getCards'),
  getStatus: (id: 'claude' | 'codex' | 'opencodego') => ipcRenderer.invoke('status:get', id),
});
