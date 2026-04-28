const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beanpick', {
  platform: process.platform,
  fetchTerarosaProducts: () => ipcRenderer.invoke('beanpick:fetch-terarosa-products'),
  fetchMomosProducts: () => ipcRenderer.invoke('beanpick:fetch-momos-products'),
  fetchOfficialMallProducts: (sourceId) => ipcRenderer.invoke('beanpick:fetch-official-mall-products', sourceId),
});
