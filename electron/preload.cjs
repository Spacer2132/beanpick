const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beanpick', {
  platform: process.platform,
  fetchTerarosaProducts: () => ipcRenderer.invoke('beanpick:fetch-terarosa-products'),
  fetchMomosProducts: () => ipcRenderer.invoke('beanpick:fetch-momos-products'),
  fetchOfficialMallProducts: (sourceId) => ipcRenderer.invoke('beanpick:fetch-official-mall-products', sourceId),
  fetchSmartStoreProducts: (sourceId) => ipcRenderer.invoke('beanpick:fetch-smartstore-products', sourceId),
  publishToGithub: (payload) => ipcRenderer.invoke('beanpick:publish-iphone', payload),
  testSmartStoreSearch: () => ipcRenderer.invoke('beanpick:test-smartstore-search'),
});
