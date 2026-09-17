const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'db', {
    getState: () => ipcRenderer.invoke('db:getState'),
    saveState: (stateJSON) => ipcRenderer.invoke('db:saveState', stateJSON),
  }
);
contextBridge.exposeInMainWorld(
  'electron', {
    getBackupData: () => ipcRenderer.invoke('get-backup-data'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    reload: () => ipcRenderer.invoke('app:reload')
  }
);

// Expose APIs directly to window to match index.tsx usage
contextBridge.exposeInMainWorld('getAppVersion', () => ipcRenderer.invoke('get-app-version'));
contextBridge.exposeInMainWorld('checkForUpdates', () => ipcRenderer.invoke('check-for-updates'));
contextBridge.exposeInMainWorld('onDownloadProgress', (callback) => ipcRenderer.on('download-progress', (event, value) => callback(value)));
contextBridge.exposeInMainWorld('readSmartCard', (mockData) => ipcRenderer.invoke('smart-card:read', mockData));
contextBridge.exposeInMainWorld('getSmartCardStatus', () => ipcRenderer.invoke('smart-card:status'));
contextBridge.exposeInMainWorld('readControlCard', () => ipcRenderer.invoke('control-card:read'));
contextBridge.exposeInMainWorld('renewControlCard', (cardId, generationType, vendorCode) => ipcRenderer.invoke('control-card:renew', cardId, generationType, vendorCode));
contextBridge.exposeInMainWorld('getControlCardMetadata', () => ipcRenderer.invoke('control-card:metadata'));
contextBridge.exposeInMainWorld('getMeterTypesByCompany', (companyId) => ipcRenderer.invoke('control-card:meter-types', companyId));
contextBridge.exposeInMainWorld('issueControlCard', (params) => ipcRenderer.invoke('control-card:issue', params));
contextBridge.exposeInMainWorld('readCustomerCard', () => ipcRenderer.invoke('customer-card:read'));
contextBridge.exposeInMainWorld('writeCustomerCard', (params) => ipcRenderer.invoke('customer-card:write', params));
contextBridge.exposeInMainWorld('clearSmartCard', (params) => ipcRenderer.invoke('customer-card:clear', params));
contextBridge.exposeInMainWorld('issueReplacementWithoutCharge', (params) => ipcRenderer.invoke('customer-card:replace-no-charge', params));
contextBridge.exposeInMainWorld('issueReplacementWithCharge', (params) => ipcRenderer.invoke('customer-card:replace-with-charge', params));
contextBridge.exposeInMainWorld('getCustomerChargingDetails', (customerId) => ipcRenderer.invoke('customer-card:charging-details', customerId));