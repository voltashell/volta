const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('aiFlock', {
  version: '1.0.0'
});
