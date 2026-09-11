const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beanpick', {
  platform: process.platform,
  listCollectionSources: () => ipcRenderer.invoke('beanpick:list-collection-sources'),
  fetchCollectionSource: (sourceId) => ipcRenderer.invoke('beanpick:fetch-collection-source', sourceId),
  promoteCollectionProducts: (sourceId, products) => ipcRenderer.invoke('beanpick:promote-collection-products', sourceId, products),
  // 기존 어댑터도 모두 등록부 기반 엔진을 통과하게 한다.
  fetchTerarosaProducts: () => ipcRenderer.invoke('beanpick:fetch-collection-source', 'terarosa'),
  fetchMomosProducts: () => ipcRenderer.invoke('beanpick:fetch-collection-source', 'momos'),
  fetchOfficialMallProducts: (sourceId) => ipcRenderer.invoke('beanpick:fetch-collection-source', sourceId),
  fetchSmartStoreProducts: (sourceId) => ipcRenderer.invoke('beanpick:fetch-collection-source', sourceId),
  publishToGithub: (payload) => ipcRenderer.invoke('beanpick:publish-iphone', payload),
  testSmartStoreSearch: () => ipcRenderer.invoke('beanpick:test-smartstore-search'),
});
