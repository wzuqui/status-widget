import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('configApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  selectFile: () => ipcRenderer.invoke('config:selectFile'),
  save: (data: Record<string, string>) => ipcRenderer.invoke('config:save', data),
  cancel: () => ipcRenderer.send('config:cancel'),
});
